import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { apply } from '../index.js';

const OWNER = { principal: { kind: 'owner' }, interactions: 'answer' };

function fakeContext(captured) {
  const workspaces = new Map();
  return {
    logger: { info() {}, warn() {} },
    effect(fn) { return fn(); },
    connection: {
      rpc: {
        handle(channel, handler) {
          captured.channel = channel;
          captured.handler = handler;
        },
      },
    },
    workspaceRegistry: {
      get: id => workspaces.get(id),
      resolveByPath: () => undefined,
      list: () => [...workspaces.values()],
      create: async (dir, title) => {
        const workspace = { id: `w-${workspaces.size + 1}`, path: dir, title, sessionIds: [] };
        workspaces.set(workspace.id, workspace);
        return workspace;
      },
      delete: async id => { workspaces.delete(id); },
      archiveSession: async () => {},
    },
    sessionController: {
      create: async ({ workspaceId }) => ({ sessionId: `session-${workspaceId}` }),
    },
  };
}

async function withPlugin(t) {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'ttz-index-'));
  const previous = process.env.DSH_HOME;
  process.env.DSH_HOME = path.join(base, 'home');
  t.after(async () => {
    if (previous === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previous;
    await fs.rm(base, { recursive: true, force: true }).catch(() => {});
  });
  const captured = {};
  const root = path.join(base, 'root');
  await apply(fakeContext(captured), { rootDirectory: root, dirPrefix: '临时' });
  return { base, root, captured };
}

function call(captured, method, payload) {
  return captured.handler(method, payload ?? {}, new AbortController().signal, OWNER);
}

test('the RPC channel exposes settings and persists them for new tasks', async (t) => {
  const { base, captured } = await withPlugin(t);

  assert.equal(captured.channel, '/temp-task-zone');
  const initial = await call(captured, 'getSettings');
  assert.equal(initial.ok, true);
  assert.equal(initial.value.dirPrefix, '临时');
  assert.equal(initial.value.heroNewTask, true);

  const moved = path.join(base, 'moved');
  const saved = await call(captured, 'saveSettings', { rootDirectory: moved, dirPrefix: 'probe', heroNewTask: false });
  assert.equal(saved.ok, true);
  assert.equal(saved.value.rootDirectory, path.normalize(moved));
  assert.equal(saved.value.dirPrefix, 'probe');
  assert.equal(saved.value.heroNewTask, false);

  const listed = await call(captured, 'list');
  assert.equal(listed.value.root, path.normalize(moved));

  const created = await call(captured, 'create');
  assert.equal(created.ok, true);
  assert.equal(path.dirname(created.value.path), path.normalize(moved));
  assert.match(path.basename(created.value.path), /^probe-\d{8}-\d{6}$/);
});

test('the RPC channel rejects invalid settings and unknown methods', async (t) => {
  const { captured } = await withPlugin(t);

  const relative = await call(captured, 'saveSettings', { rootDirectory: 'relative', dirPrefix: 'x' });
  assert.equal(relative.ok, false);
  assert.equal(relative.error.code, 'temp-task/root-not-absolute');
  assert.match(relative.error.message, /绝对路径/);
  assert.equal(typeof relative.error.details.example, 'string');
  assert.ok(path.isAbsolute(relative.error.details.example));

  const emptyPrefix = await call(captured, 'saveSettings', { rootDirectory: os.tmpdir(), dirPrefix: '  ' });
  assert.equal(emptyPrefix.ok, false);
  assert.equal(emptyPrefix.error.code, 'temp-task/prefix-empty');
  assert.match(emptyPrefix.error.message, /不能为空/);

  const unknown = await call(captured, 'nope');
  assert.equal(unknown.ok, false);
  assert.equal(unknown.error.code, 'temp-task/unknown-method');
  assert.match(unknown.error.message, /未知临时任务操作/);
});

test('the RPC channel serves every shipped locale dictionary', async (t) => {
  const { captured } = await withPlugin(t);
  const served = await call(captured, 'getLocales');
  assert.equal(served.ok, true);
  const locales = served.value;
  assert.deepEqual(Object.keys(locales).sort(), ['de', 'en', 'es', 'fr', 'ja', 'pt', 'ru', 'zh']);
  assert.equal(locales.zh.title, '临时任务');
  assert.equal(locales.en.title, 'Temporary tasks');
  assert.equal(locales.ja.title, '一時タスク');
  const keys = Object.keys(locales.en).sort();
  for (const [language, dictionary] of Object.entries(locales)) {
    assert.deepEqual(Object.keys(dictionary).sort(), keys, `${language} has the same keys as en`);
    assert.ok(dictionary.title && dictionary.title !== 'title', `${language} translates the title`);
    assert.ok(dictionary.meta?.title && dictionary.meta?.description, `${language} translates meta`);
  }
});

test('legacy temp-task-zone state is migrated into dsh-temp-task', async (t) => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'ttz-migrate-'));
  const previous = process.env.DSH_HOME;
  process.env.DSH_HOME = path.join(base, 'home');
  t.after(async () => {
    if (previous === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previous;
    await fs.rm(base, { recursive: true, force: true }).catch(() => {});
  });

  const identity = process.env.DSH_PROFILE_DIR || process.env.DSH_PROFILE || 'default';
  const hash = createHash('sha256').update(identity).digest('hex').slice(0, 12);
  const legacyDir = path.join(process.env.DSH_HOME, 'temp-task-zone', hash);
  await fs.mkdir(legacyDir, { recursive: true });
  const legacyRoot = path.join(base, 'legacy-root');
  await fs.writeFile(
    path.join(legacyDir, 'settings.json'),
    JSON.stringify({ version: 1, rootDirectory: legacyRoot, dirPrefix: '旧', heroNewTask: false }),
  );
  await fs.writeFile(path.join(legacyDir, 'tasks.json'), JSON.stringify({ version: 1, tasks: [] }));

  const captured = {};
  await apply(fakeContext(captured), {
    rootDirectory: path.join(base, 'configured-root'),
    dirPrefix: '临时',
  });

  const stateDir = path.join(process.env.DSH_HOME, 'dsh-temp-task', hash);
  const tasks = JSON.parse(await fs.readFile(path.join(stateDir, 'tasks.json'), 'utf8'));
  assert.deepEqual(tasks, { version: 1, tasks: [] });

  const settings = await call(captured, 'getSettings');
  assert.equal(settings.value.rootDirectory, path.normalize(legacyRoot));
  assert.equal(settings.value.dirPrefix, '旧');
  assert.equal(settings.value.heroNewTask, false);

  await assert.rejects(fs.stat(legacyDir));
});

test('the RPC channel refuses an anonymous peer', async (t) => {
  const { captured } = await withPlugin(t);
  const anonymous = await captured.handler('getSettings', {}, new AbortController().signal, undefined);
  assert.equal(anonymous.ok, false);
  assert.equal(anonymous.error.code, 'temp-task/forbidden');
  assert.match(anonymous.error.message, /已认证/);
});

