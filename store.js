import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { pluginError } from './errors.js';

/** Marks a directory as owned by this plugin. Deletion refuses without it. */
export const OWNER_MARKER = '.dsh-temp-task-owner.json';
export const OWNER_PLUGIN = 'dsh-temp-task';
const LEGACY_OWNER_PLUGINS = new Set(['dsh-temp-task-zone']);
const STATE_VERSION = 1;

const pad = value => String(value).padStart(2, '0');

/**
 * Durable task table plus the on-disk naming/ownership rules. Pure Node: no
 * Cordis, no DSH services, so it can be exercised by `node --test`.
 */
export class TempTaskStore {
  /**
   * @param {object} options
   * @param {string} options.stateDir directory holding tasks.json
   * @param {string} options.rootDirectory default parent for temporary directories
   * @param {string} [options.prefix] directory name prefix
   */
  constructor({ stateDir, rootDirectory, prefix = '临时' }) {
    this.stateDir = stateDir;
    this.stateFile = path.join(stateDir, 'tasks.json');
    this.settingsFile = path.join(stateDir, 'settings.json');
    this.rootDirectory = rootDirectory;
    this.prefix = sanitizePrefix(prefix);
    this.heroNewTask = true;
    this.defaultRootDirectory = rootDirectory;
    this.defaultPrefix = this.prefix;
    this.defaultHeroNewTask = true;
  }

  /** Local-time directory name: `<prefix>-YYYYMMDD-HHmmss`. */
  formatDirName(date) {
    return `${this.prefix}-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  }

  /** Sidebar title for a task: `<prefix> · MM-DD HH:mm`. */
  titleFor(date) {
    return `${this.prefix} · ${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  dirPath(name) {
    return path.join(this.rootDirectory, name);
  }

  /** True when `value` is a strict descendant of the task root. */
  isUnderRoot(value, rootDirectory = this.rootDirectory) {
    if (typeof value !== 'string' || value.length === 0) return false;
    if (typeof rootDirectory !== 'string' || rootDirectory.length === 0) return false;
    const relative = path.relative(rootDirectory, value);
    if (relative.length === 0) return false;
    return !relative.startsWith('..') && !path.isAbsolute(relative);
  }

  async read() {
    let raw;
    try {
      raw = await fs.readFile(this.stateFile, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') return { version: STATE_VERSION, tasks: [] };
      throw error;
    }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== STATE_VERSION || !Array.isArray(parsed.tasks)) {
        throw new Error('unexpected state shape');
      }
      return { version: STATE_VERSION, tasks: parsed.tasks.filter(isRecord) };
    } catch {
      // Never lose user data silently: keep the unreadable file for inspection.
      await fs.rename(this.stateFile, `${this.stateFile}.corrupt-${Date.now()}`).catch(() => {});
      return { version: STATE_VERSION, tasks: [] };
    }
  }

  async write(state) {
    await fs.mkdir(this.stateDir, { recursive: true });
    const temporary = `${this.stateFile}.${process.pid}.${randomUUID().slice(0, 8)}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(state, null, 2), 'utf8');
    await fs.rename(temporary, this.stateFile);
  }

  /** Current settings plus the defaults they can be reset to. */
  settingsSnapshot() {
    return {
      rootDirectory: this.rootDirectory,
      dirPrefix: this.prefix,
      heroNewTask: this.heroNewTask,
      defaults: {
        rootDirectory: this.defaultRootDirectory,
        dirPrefix: this.defaultPrefix,
        heroNewTask: this.defaultHeroNewTask,
      },
    };
  }

  /**
   * Apply settings saved from the Settings page. A missing/unreadable file is
   * not an error: the plugin keeps the configured defaults.
   */
  async loadSettings() {
    let raw;
    try {
      raw = await fs.readFile(this.settingsFile, 'utf8');
    } catch {
      return null;
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
    const root = resolveDirectory(parsed?.rootDirectory);
    let prefix = null;
    try {
      prefix = parsed?.dirPrefix === undefined ? null : validatePrefix(parsed.dirPrefix);
    } catch {
      prefix = null;
    }
    const heroNewTask = typeof parsed?.heroNewTask === 'boolean' ? parsed.heroNewTask : null;
    if (!root && !prefix && heroNewTask === null) return null;
    if (root) this.rootDirectory = root;
    if (prefix) this.prefix = prefix;
    if (heroNewTask !== null) this.heroNewTask = heroNewTask;
    return this.settingsSnapshot();
  }

  /**
   * Validate and persist the settings, then switch runtime values. Existing
   * tasks keep the directories they were created in; only new tasks move.
   */
  async saveSettings({ rootDirectory, dirPrefix, heroNewTask } = {}) {
    const root = resolveDirectory(rootDirectory);
    if (!root) throw pluginError('root-not-absolute', `存放位置必须是绝对路径，例如 ${absolutePathExample()}。`, { example: absolutePathExample() });
    const prefix = validatePrefix(dirPrefix);
    const hero = typeof heroNewTask === 'boolean' ? heroNewTask : this.heroNewTask;
    try {
      await fs.mkdir(root, { recursive: true });
    } catch (error) {
      throw pluginError('mkdir-failed', `无法创建目录：${root}（${error?.code ?? error?.message ?? error}）`, { path: root, reason: String(error?.code ?? error?.message ?? error) });
    }
    const value = { version: STATE_VERSION, rootDirectory: root, dirPrefix: prefix, heroNewTask: hero };
    await fs.mkdir(this.stateDir, { recursive: true });
    const temporary = `${this.settingsFile}.${process.pid}.${randomUUID().slice(0, 8)}.tmp`;
    await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await fs.rename(temporary, this.settingsFile);
    this.rootDirectory = root;
    this.prefix = prefix;
    this.heroNewTask = hero;
    return this.settingsSnapshot();
  }

  /**
   * Create a fresh directory. Concurrent/same-second creations get `-2`, `-3`…
   * so the name is deterministic and never random.
   * @returns {Promise<{name: string, dir: string, createdAt: Date}>}
   */
  async makeDirectory(createdAt = new Date()) {
    await fs.mkdir(this.rootDirectory, { recursive: true });
    const base = this.formatDirName(createdAt);
    for (let index = 1; index <= 50; index += 1) {
      const name = index === 1 ? base : `${base}-${index}`;
      const dir = path.join(this.rootDirectory, name);
      try {
        await fs.mkdir(dir, { mode: 0o700 });
        return { name, dir, createdAt };
      } catch (error) {
        if (error.code === 'EEXIST') continue;
        throw error;
      }
    }
    throw pluginError('too-many-directories', `无法创建临时目录：${this.rootDirectory} 下同名目录过多。`, { path: this.rootDirectory });
  }

  async writeMarker(dir, record) {
    const marker = {
      plugin: OWNER_PLUGIN,
      version: 1,
      id: record.id,
      createdAt: record.createdAt,
      ...(typeof record.root === 'string' && record.root ? { root: record.root } : {}),
    };
    await fs.writeFile(path.join(dir, OWNER_MARKER), JSON.stringify(marker, null, 2), 'utf8');
    return marker;
  }

  async readMarker(dir) {
    try {
      const raw = await fs.readFile(path.join(dir, OWNER_MARKER), 'utf8');
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.id !== 'string') return null;
      if (parsed.plugin !== OWNER_PLUGIN && !LEGACY_OWNER_PLUGINS.has(parsed.plugin)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Drop our ownership marker. Used when a directory is handed over to a real
   * workspace: the directory and its sessions stay, but the temp-task plugin
   * must no longer re-adopt it as an orphan during reconcile().
   */
  async removeMarker(dir) {
    try {
      await fs.unlink(path.join(dir, OWNER_MARKER));
      return true;
    } catch (error) {
      if (error?.code === 'ENOENT') return false;
      throw error;
    }
  }

  /** Directories directly under the root that carry our ownership marker. */
  async listOwnedDirectories() {
    let entries;
    try {
      entries = await fs.readdir(this.rootDirectory, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
    const owned = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dir = path.join(this.rootDirectory, entry.name);
      const marker = await this.readMarker(dir);
      if (marker) owned.push({ name: entry.name, dir, marker });
    }
    return owned;
  }
}

/** Expand `~` and require an absolute path; anything else is rejected. */
function resolveDirectory(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return null;
  const windowsHome = text.startsWith('~\\') && process.platform === 'win32';
  let expanded = text;
  if (text === '~') expanded = os.homedir();
  else if (text.startsWith('~/') || windowsHome) expanded = path.join(os.homedir(), text.slice(2));
  if (!path.isAbsolute(expanded)) return null;
  return path.normalize(expanded);
}

/** Example path shown in the "must be absolute" error, in the host platform's shape. */
function absolutePathExample() {
  return path.join(os.homedir(), 'Documents');
}

/**
 * Characters that cannot appear in a directory-name prefix. Windows forbids
 * more than POSIX; the platform's own rule is used so the setting matches what
 * the local filesystem accepts.
 */
function illegalPrefixPattern(platform = process.platform) {
  return platform === 'win32'
    ? /[\\/:*?"<>|\u0000-\u001f]/
    : /[\\/\u0000-\u001f]/;
}

/** Exposed so the settings validation can be checked per platform by tests. */
export function validatePrefix(value, platform = process.platform) {
  const text = String(value ?? '').trim();
  if (!text) throw pluginError('prefix-empty', '目录前缀不能为空。');
  if (text === '.' || text === '..') throw pluginError('prefix-dot', '目录前缀不能是 . 或 ..。');
  if (illegalPrefixPattern(platform).test(text)) {
    throw pluginError('prefix-invalid-chars', platform === 'win32'
      ? '目录前缀不能包含 \\ / : * ? " < > | 等字符。'
      : '目录前缀不能包含 \\ / 或控制字符。', { platform });
  }
  if (text.length > 40) throw pluginError('prefix-too-long', '目录前缀最多 40 个字符。', { max: 40 });
  return text;
}

function sanitizePrefix(value, platform = process.platform) {
  const text = String(value ?? '').trim();
  const pattern = illegalPrefixPattern(platform);
  const safe = text.replace(new RegExp(pattern.source, 'g'), '').slice(0, 40);
  return safe.length > 0 ? safe : '临时';
}

function isRecord(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && typeof value.id === 'string'
    && typeof value.workspaceId === 'string'
    && typeof value.dirName === 'string'
    && typeof value.path === 'string'
    && typeof value.createdAt === 'string',
  );
}
