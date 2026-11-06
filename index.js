import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { TempTaskStore } from './store.js';
import { TempTaskService } from './service.js';
import { pluginError, ERROR_PREFIX } from './errors.js';

export const inject = ['connection', 'webServer', 'workspaceRegistry', 'sessionController'];

const CHANNEL = '/temp-task-zone';
const DEFAULT_ROOT = path.join(os.homedir(), 'Documents', 'deepseek-harness');
const LOCALE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'locale');
const STATE_DIR_NAME = 'dsh-temp-task';
const LEGACY_STATE_DIR_NAME = 'temp-task-zone';

export async function apply(ctx, config = {}) {
  const rootDirectory = resolveRoot(config?.rootDirectory);
  const stateDir = resolveStateDir(ctx.logger);
  const store = new TempTaskStore({
    stateDir,
    rootDirectory,
    prefix: config?.dirPrefix,
  });
  const service = new TempTaskService(ctx, store, { logger: ctx.logger });
  await service.init();

  const handle = createHandler(service, () => readLocales(ctx.logger));

  // Canonical Connection RPC: transport aware, so the Desktop shell carrier and
  // the browser HTTP carrier both reach it and the Host's admission fence
  // authenticates the caller.
  let channelRegistered = false;
  try {
    ctx.effect(() => ctx.connection.rpc.handle(CHANNEL, handle), 'temp-task-zone: rpc channel');
    channelRegistered = true;
  } catch (error) {
    ctx.logger?.warn?.(`dsh-temp-task: RPC channel unavailable, falling back to HTTP route: ${error.message}`);
  }
  if (!channelRegistered) {
    ctx.effect(() => ctx.webServer.register({
      kind: 'prefix',
      path: CHANNEL,
      handler: async (req, res) => {
        const admission = ctx.connection.admit(req);
        if ('rejection' in admission) { res.writeHead(admission.rejection); res.end(); return; }
        if (req.method !== 'POST' || !String(req.headers['content-type'] || '').startsWith('application/json')) {
          res.writeHead(415); res.end(); return;
        }
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 16384) { res.writeHead(413); res.end(); return; }
          chunks.push(chunk);
        }
        let body;
        try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { res.writeHead(400); res.end(); return; }
        const expected = new URL(req.url, 'http://localhost').pathname.slice(`${CHANNEL}/`.length);
        if (body?.type !== 'client-request' || typeof body.rpcId !== 'string' || body.method !== expected) {
          res.writeHead(400); res.end(); return;
        }
        const result = await handle(body.method, body.payload, new AbortController().signal, admission.peer);
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
        res.end(JSON.stringify({ type: 'server-response', rpcId: body.rpcId, result }));
      },
    }), 'temp-task-zone: authenticated user route (fallback)');
  }

  ctx.logger?.info?.(`dsh-temp-task: root=${store.rootDirectory} prefix=${store.prefix} state=${stateDir} tasks=${service.state.tasks.length}`);
}

function createHandler(service, locales) {
  return async function handle(method, payload, signal, peer) {
    try {
      assertInteractive(peer);
      if (signal?.aborted) throw pluginError('cancelled', '操作已取消。');
      const value = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
      let result;
      if (method === 'list') result = await service.list();
      else if (method === 'create') result = await service.create();
      else if (method === 'open') result = await service.open(value.workspaceId);
      else if (method === 'getSettings') result = service.getSettings();
      else if (method === 'getLocales') result = locales();
      else if (method === 'saveSettings') result = await service.saveSettings(value);
      else if (method === 'sweepBlank') result = await service.sweepBlank(value);
      else if (method === 'moveToWorkspace') result = await service.moveToWorkspace(value.workspaceId);
      else if (method === 'delete') {
        result = await service.remove(value.workspaceId, { keepDirectory: value.keepDirectory === true });
      } else throw pluginError('unknown-method', '未知临时任务操作。');
      return { ok: true, value: result };
    } catch (error) {
      const code = typeof error?.code === 'string' && error.code.startsWith(ERROR_PREFIX)
        ? error.code
        : 'temp-task/unknown';
      return {
        ok: false,
        error: { code, message: String(error?.message ?? error), details: error?.params ?? {} },
      };
    }
  };
}

function assertInteractive(peer) {
  if (!peer) throw pluginError('forbidden', '此操作仅对已认证的交互用户开放。');
  const principal = peer.principal;
  if (principal && principal.kind !== 'owner') throw pluginError('forbidden', '此操作仅对已认证的交互用户开放。');
  if (peer.interactions && peer.interactions !== 'answer') throw pluginError('no-interaction', '当前会话不接受交互操作。');
}

function resolveRoot(value) {
  const candidate = typeof value === 'string' && value.trim().length > 0 ? value.trim() : DEFAULT_ROOT;
  const expanded = candidate.startsWith('~/') || candidate.startsWith('~\\')
    ? path.join(os.homedir(), candidate.slice(2))
    : candidate;
  if (!path.isAbsolute(expanded)) return DEFAULT_ROOT;
  return path.normalize(expanded);
}

function dshHome() {
  const configured = process.env.DSH_HOME;
  if (typeof configured === 'string' && configured.length > 0) return configured;
  return path.join(os.homedir(), '.dsh');
}

function profileHash() {
  const identity = process.env.DSH_PROFILE_DIR || process.env.DSH_PROFILE || 'default';
  return createHash('sha256').update(identity).digest('hex').slice(0, 12);
}

/**
 * State lives under `<DSH_HOME>/dsh-temp-task/<profile-hash>`. Older releases
 * used `<DSH_HOME>/temp-task-zone/<profile-hash>`; move it in place on first
 * start so upgrades keep their task list and settings.
 */
function resolveStateDir(logger) {
  const home = dshHome();
  const hash = profileHash();
  const stateDir = path.join(home, STATE_DIR_NAME, hash);
  const legacyDir = path.join(home, LEGACY_STATE_DIR_NAME, hash);
  try {
    migrateStateDir(legacyDir, stateDir, logger);
  } catch (error) {
    logger?.warn?.(`dsh-temp-task: state migration failed: ${error.message}`);
  }
  return stateDir;
}

function migrateStateDir(legacyDir, stateDir, logger) {
  let legacy;
  try {
    legacy = fs.statSync(legacyDir);
  } catch {
    return;
  }
  if (!legacy.isDirectory()) return;
  try {
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(path.dirname(stateDir), { recursive: true });
      try {
        fs.renameSync(legacyDir, stateDir);
      } catch {
        // Different volume or a locked file: copy first, then drop the source.
        fs.cpSync(legacyDir, stateDir, { recursive: true });
        fs.rmSync(legacyDir, { recursive: true, force: true });
      }
      logger?.info?.(`dsh-temp-task: migrated state ${legacyDir} -> ${stateDir}`);
    } else {
      // Both folders exist: adopt only files the new folder is missing.
      let copied = 0;
      for (const name of fs.readdirSync(legacyDir)) {
        const target = path.join(stateDir, name);
        if (fs.existsSync(target)) continue;
        fs.cpSync(path.join(legacyDir, name), target, { recursive: true });
        copied += 1;
      }
      if (copied > 0) {
        logger?.info?.(`dsh-temp-task: merged ${copied} legacy state file(s) into ${stateDir}`);
      }
    }
    try { fs.rmdirSync(legacyDir); } catch { /* not empty: keep it for inspection */ }
    try { fs.rmdirSync(path.dirname(legacyDir)); } catch { /* other profiles still use it */ }
  } catch (error) {
    logger?.warn?.(`dsh-temp-task: could not migrate ${legacyDir}: ${error.message}`);
  }
}

/**
 * Read `locale/<language>.json` into `{ language: dictionary }` for the
 * client. Reading on demand keeps edits to the JSON files visible without a
 * plugin reload.
 */
function readLocales(logger) {
  const dictionaries = {};
  let names;
  try {
    names = fs.readdirSync(LOCALE_DIR);
  } catch (error) {
    logger?.warn?.(`dsh-temp-task: locale directory is unreadable: ${error.message}`);
    return dictionaries;
  }
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    const language = name.slice(0, -'.json'.length);
    if (!/^[a-z]{2}(-[A-Za-z]{2,4})?$/.test(language)) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(LOCALE_DIR, name), 'utf8'));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) dictionaries[language] = parsed;
    } catch (error) {
      logger?.warn?.(`dsh-temp-task: skipping locale/${name}: ${error.message}`);
    }
  }
  return dictionaries;
}
