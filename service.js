import * as fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { moveToTrash } from './trash.js';
import { OWNER_MARKER } from './store.js';
import { pluginError } from './errors.js';

/**
 * Orchestrates the host-side task lifecycle. Every mutating operation runs on a
 * single promise chain so two clicks cannot race the same directory or state
 * file. The registry is the source of truth for "does this task still have a
 * sidebar row"; this table only remembers which workspaces are temporary and
 * which directory belongs to them.
 */
export class TempTaskService {
  constructor(ctx, store, { logger } = {}) {
    this.ctx = ctx;
    this.store = store;
    this.logger = logger;
    this.state = { version: 1, tasks: [] };
    this.chain = Promise.resolve();
  }

  /** Run `fn` after every previously queued operation settled. */
  queue(fn) {
    const run = this.chain.then(fn, fn);
    this.chain = run.then(() => undefined, () => undefined);
    return run;
  }

  async init() {
    this.state = await this.store.read();
    // Settings saved from the UI win over the configured defaults; an absent
    // or unreadable file simply leaves the defaults in place.
    await this.store.loadSettings();
    await this.queue(() => this.reconcile());
    return this;
  }

  getSettings() {
    return this.store.settingsSnapshot();
  }

  async saveSettings(value) {
    return this.queue(() => this.store.saveSettings({
      rootDirectory: value?.rootDirectory,
      dirPrefix: value?.dirPrefix,
      heroNewTask: value?.heroNewTask,
    }));
  }

  /** Public task list; unregistered workspaces are omitted (they have no row). */
  async list() {
    return this.queue(async () => {
      const tasks = [];
      for (const record of this.state.tasks) {
        const workspace = this.ctx.workspaceRegistry.get(record.workspaceId);
        if (!workspace) continue;
        tasks.push({ ...record, title: workspace.title, missing: false });
      }
      return { root: this.store.rootDirectory, tasks };
    });
  }

  async create() {
    return this.queue(async () => {
      const createdAt = new Date();
      const record = {
        id: randomUUID(),
        root: this.store.rootDirectory,
        workspaceId: null,
        sessionId: null,
        dirName: null,
        path: null,
        createdAt: createdAt.toISOString(),
      };
      const { name, dir } = await this.store.makeDirectory(createdAt);
      record.dirName = name;
      record.path = dir;
      await this.store.writeMarker(dir, record);

      let workspaceId = null;
      try {
        const workspace = await this.ctx.workspaceRegistry.create(dir, this.store.titleFor(createdAt));
        workspaceId = workspace.id;
        record.workspaceId = workspaceId;
        const created = await this.ctx.sessionController.create({ workspaceId });
        record.sessionId = created?.sessionId ?? null;
        this.state.tasks.unshift(record);
        await this.store.write(this.state);
        return { ...record };
      } catch (error) {
        this.state.tasks = this.state.tasks.filter(task => task.id !== record.id);
        if (workspaceId) {
          try { await this.ctx.workspaceRegistry.delete(workspaceId); } catch {}
        }
        try { await fs.rm(dir, { recursive: true, force: true }); } catch {}
        throw error;
      }
    });
  }

  /** Idempotent "open this task's conversation": returns the session to reveal. */
  async open(workspaceId) {
    return this.queue(async () => {
      const record = this.requireRecord(workspaceId);
      const workspace = this.ctx.workspaceRegistry.get(workspaceId);
      if (!workspace) throw pluginError('workspace-missing', '该临时任务已从侧栏移除。');

      const sessionIds = Array.isArray(workspace.sessionIds) ? workspace.sessionIds : [];
      let sessionId = record.sessionId && sessionIds.includes(record.sessionId)
        ? record.sessionId
        : (sessionIds[0] ?? null);

      if (!sessionId) {
        const created = await this.ctx.sessionController.create({ workspaceId });
        sessionId = created?.sessionId ?? null;
        if (!sessionId) throw pluginError('session-create-failed', '无法为该临时任务创建会话。');
      }
      if (sessionId !== record.sessionId) {
        record.sessionId = sessionId;
        await this.store.write(this.state);
      }
      return { sessionId, task: { ...record } };
    });
  }

  /**
   * Hand a temporary task over to the regular workspace list: the same
   * directory becomes a normal workspace, the conversation is attached to it,
   * and the temp-task record/ownership marker are removed. The directory is
   * never moved, so an already-running file watcher or open editor keeps
   * working, and the moved session keeps its cwd.
   */
  async moveToWorkspace(workspaceId) {
    return this.queue(async () => {
      const record = this.requireRecord(workspaceId);
      const workspace = this.ctx.workspaceRegistry.get(workspaceId);
      if (!workspace) throw pluginError('workspace-missing', '该临时任务已从侧栏移除。');

      const sessionIds = Array.isArray(workspace.sessionIds) ? [...workspace.sessionIds] : [];
      const sessionId = record.sessionId && sessionIds.includes(record.sessionId)
        ? record.sessionId
        : (sessionIds[0] ?? null);
      if (!sessionId) throw pluginError('move-no-session', '该临时任务还没有会话，无法移动。');
      await this.assertIdle(sessionId);

      const marker = await this.store.readMarker(record.path);
      if (!marker || marker.id !== record.id) {
        throw pluginError('move-marker-mismatch', '拒绝移动：目录缺少归属标记，或标记与记录不匹配。');
      }
      const roots = [record.root, marker.root, this.store.rootDirectory, this.store.defaultRootDirectory]
        .filter(value => typeof value === 'string' && value.length > 0);
      if (!roots.some(root => this.store.isUnderRoot(record.path, root))) {
        throw pluginError('move-outside-root', '拒绝移动：目录不在临时任务根目录下。');
      }

      const previousTitle = workspace.title;
      const title = await this.titleForMove(sessionId, previousTitle);
      // An archived conversation would be hidden by the default workspace
      // filter right after the move, so bring it back before handing it over.
      try {
        await this.ctx.workspaceRegistry.unarchiveSession?.(sessionId);
      } catch (error) {
        if (error?.name !== 'WorkspaceUnknownSessionError') throw error;
      }

      const targetPath = await fs.realpath(record.path).catch(() => record.path);
      await this.ctx.workspaceRegistry.delete(workspaceId);

      let target = this.ctx.workspaceRegistry.list().find(candidate => candidate.path === targetPath) ?? null;
      let createdNew = false;
      try {
        if (!target) {
          target = await this.ctx.workspaceRegistry.create(record.path, title);
          createdNew = true;
        }
        await target.attachSession(sessionId);
      } catch (error) {
        // Put the temporary workspace back so a failed move never strands the
        // directory without a registration (and without a visible row).
        try {
          if (createdNew && target) await this.ctx.workspaceRegistry.delete(target.id);
        } catch {}
        let restored = null;
        try {
          restored = await this.ctx.workspaceRegistry.create(record.path, previousTitle);
          await restored.attachSession(sessionId);
        } catch {}
        if (restored) {
          record.workspaceId = restored.id;
          await this.store.write(this.state);
        }
        throw pluginError('move-failed', `无法移动到工作区：${error?.message || error}`, { message: String(error?.message || error) });
      }

      try {
        await this.store.removeMarker(record.path);
      } catch (error) {
        this.log('warn', `临时任务移动到工作区后未能删除归属标记：${error?.message || error}`);
      }
      this.state.tasks = this.state.tasks.filter(task => task.id !== record.id);
      await this.store.write(this.state);
      this.log('info', `临时任务已移动到工作区：${record.dirName} → ${title}`);
      return { workspaceId: target.id, sessionId, title };
    });
  }

  /** Prefer the conversation's own title for the new workspace. */
  async titleForMove(sessionId, fallback) {
    try {
      const listed = await this.ctx.sessionController.list({});
      const item = (listed?.items ?? []).find(entry => entry.sessionId === sessionId);
      const text = typeof item?.title === 'string' ? item.title.trim() : '';
      if (text) return text;
    } catch {}
    return fallback;
  }

  async remove(workspaceId, { keepDirectory = false } = {}) {
    return this.queue(async () => {
      const record = this.requireRecord(workspaceId);
      const workspace = this.ctx.workspaceRegistry.get(workspaceId);

      if (workspace) {
        const sessionIds = Array.isArray(workspace.sessionIds) ? [...workspace.sessionIds] : [];
        for (const sessionId of sessionIds) {
          await this.assertIdle(sessionId);
          try {
            await this.ctx.workspaceRegistry.archiveSession(sessionId, { stopActivity: true });
          } catch (error) {
            if (error?.name !== 'WorkspaceUnknownSessionError') throw error;
          }
        }
      }

      if (!keepDirectory) {
        // The root may have moved since this task was created, so accept any
        // root this task can prove: its own record, its marker, or a configured
        // default. The ownership marker still has to match the record.
        await this.discardDirectory(record, { permanentIfEmpty: false });
      }

      if (workspace) await this.ctx.workspaceRegistry.delete(workspaceId);
      this.state.tasks = this.state.tasks.filter(task => task.id !== record.id);
      await this.store.write(this.state);
      return { removed: true };
    });
  }

  /**
   * Mirror the official blank-Session lifecycle: a temporary task whose
   * conversation never received a message is discarded as soon as it stops
   * being the visible main Session. The Host decides blankness from the
   * published summary, so a task that already has a turn is never touched.
   */
  async sweepBlank({ currentSessionId = null, protectSessionId = null } = {}) {
    return this.queue(async () => {
      if (typeof currentSessionId !== 'string' || currentSessionId.length === 0) {
        return { removed: [] };
      }
      let listed;
      try {
        listed = await this.ctx.sessionController.list({});
      } catch {
        return { removed: [] };
      }
      const summaries = new Map(
        (Array.isArray(listed?.items) ? listed.items : [])
          .filter(item => typeof item?.sessionId === 'string')
          .map(item => [item.sessionId, item]),
      );
      const removed = [];
      const now = Date.now();
      for (const record of [...this.state.tasks]) {
        const sessionId = record.sessionId;
        if (typeof sessionId !== 'string' || sessionId.length === 0) continue;
        if (sessionId === currentSessionId || sessionId === protectSessionId) continue;
        const summary = summaries.get(sessionId);
        // Only a summary the Host reports as blank is safe to discard. An
        // unknown Session stays untouched: it may be loading or retained.
        if (!summary || summary.blank !== true) continue;
        const createdAt = Date.parse(record.createdAt);
        // A Session is published a moment before the client can open it; keep
        // a short guard so a still-being-created task is never swept.
        if (Number.isFinite(createdAt) && now - createdAt < 1000) continue;
        try {
          const workspace = this.ctx.workspaceRegistry.get(record.workspaceId);
          if (workspace) await this.ctx.workspaceRegistry.delete(record.workspaceId);
          await this.discardDirectory(record, { permanentIfEmpty: true });
          this.state.tasks = this.state.tasks.filter(task => task.id !== record.id);
          await this.store.write(this.state);
          removed.push(record.workspaceId);
          this.log('info', `已自动清理未使用的临时任务：${record.dirName}`);
        } catch (error) {
          this.log('warn', `自动清理临时任务失败（${record.dirName}）：${error?.message ?? error}`);
        }
      }
      return { removed };
    });
  }

  /** Drop an owned directory, permanently when it only contains the marker. */
  async discardDirectory(record, { permanentIfEmpty = false } = {}) {
    const marker = await this.store.readMarker(record.path);
    if (!marker || marker.id !== record.id) {
      throw pluginError('delete-marker-mismatch', '拒绝删除：目录缺少归属标记，可能不是本插件创建的目录。');
    }
    const roots = [record.root, marker.root, this.store.rootDirectory, this.store.defaultRootDirectory]
      .filter(root => typeof root === 'string' && root.length > 0);
    if (!roots.some(root => this.store.isUnderRoot(record.path, root))) {
      throw pluginError('delete-outside-root', '拒绝删除：目录不在临时任务根目录下。');
    }
    if (permanentIfEmpty) {
      const entries = await fs.readdir(record.path).catch(() => null);
      if (Array.isArray(entries) && entries.every(name => name === OWNER_MARKER)) {
        await fs.rm(record.path, { recursive: true, force: true });
        return;
      }
    }
    await moveToTrash(record.path);
  }

  /** Drop records whose workspace and directory are both gone; adopt strays. */
  async reconcile() {
    const before = this.state.tasks.length;
    let changed = false;
    const kept = [];
    const seen = new Set();
    for (const record of this.state.tasks) {
      if (seen.has(record.workspaceId)) continue;
      seen.add(record.workspaceId);
      const workspace = this.ctx.workspaceRegistry.get(record.workspaceId);
      if (workspace) {
        kept.push(record);
        continue;
      }
      const exists = await fs.stat(record.path).then(stat => stat.isDirectory(), () => false);
      if (exists) {
        // Directory survives without a registration: keep the directory, drop the
        // record so the sidebar never shows a task that cannot be opened.
        this.log('warn', `临时任务记录已失效（工作区已移除），保留目录：${record.path}`);
      }
    }
    this.state.tasks = kept;
    if (kept.length !== before) changed = true;

    for (const owned of await this.store.listOwnedDirectories()) {
      if (this.state.tasks.some(record => record.path === owned.dir)) continue;
      let workspace;
      try {
        workspace = this.ctx.workspaceRegistry.resolveByPath(owned.dir);
      } catch {
        workspace = undefined;
      }
      if (!workspace) continue;
      if (this.state.tasks.some(record => record.workspaceId === workspace.id)) continue;
      const createdAt = typeof owned.marker.createdAt === 'string'
        ? owned.marker.createdAt
        : new Date().toISOString();
      this.state.tasks.push({
        id: owned.marker.id,
        workspaceId: workspace.id,
        sessionId: null,
        dirName: owned.name,
        path: owned.dir,
        createdAt,
      });
      changed = true;
    }

    if (changed) await this.store.write(this.state);
  }

  requireRecord(workspaceId) {
    if (typeof workspaceId !== 'string' || workspaceId.length === 0) {
      throw pluginError('task-id-missing', '缺少临时任务标识。');
    }
    const record = this.state.tasks.find(task => task.workspaceId === workspaceId);
    if (!record) throw pluginError('not-a-task', '这不是一个临时任务。');
    return record;
  }

  /** Refuse destructive work while the session is actually running. */
  async assertIdle(sessionId) {
    if (typeof this.ctx.waterfall !== 'function') return;
    let activity;
    try {
      activity = await this.ctx.waterfall('workspace/session-activity', { sessionId }, () => Promise.resolve([]));
    } catch {
      return;
    }
    if (Array.isArray(activity) && activity.length > 0) {
      throw pluginError('task-busy', '该临时任务正在运行，请先停止对话再删除。');
    }
  }

  log(level, message) {
    try { this.logger?.[level]?.(message); } catch {}
  }
}
