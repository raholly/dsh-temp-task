import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { TempTaskStore, OWNER_MARKER, validatePrefix } from '../store.js';
import { TempTaskService } from '../service.js';

async function temporaryRoot() {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'ttz-test-'));
  const root = path.join(base, 'deepseek-harness');
  const stateDir = path.join(base, 'state');
  return { base, root, stateDir };
}

function storeFor({ root, stateDir }, prefix = '临时') {
  return new TempTaskStore({ stateDir, rootDirectory: root, prefix });
}

test('directory name and title are deterministic local-time labels', () => {
  const store = new TempTaskStore({ stateDir: 'C:/s', rootDirectory: 'C:/r' });
  const date = new Date(2026, 10, 5, 16, 44, 26);
  assert.equal(store.formatDirName(date), '临时-20261105-164426');
  assert.equal(store.titleFor(date), '临时 · 11-05 16:44');
});

test('prefix is sanitised, never empty', () => {
  const plain = new TempTaskStore({ stateDir: 'C:/s', rootDirectory: 'C:/r', prefix: '' });
  assert.equal(plain.prefix, '临时');
  const unsafe = new TempTaskStore({ stateDir: 'C:/s', rootDirectory: 'C:/r', prefix: 'a/b' });
  assert.equal(unsafe.prefix, 'ab');
});

test('prefix validation follows the host platform', () => {
  // Windows forbids the reserved punctuation; POSIX only the separators and
  // control characters, so a colon is a legitimate name there.
  assert.equal(validatePrefix('a:b', 'darwin'), 'a:b');
  assert.equal(validatePrefix('a:b', 'linux'), 'a:b');
  assert.throws(() => validatePrefix('a:b', 'win32'), /不能包含/);
  assert.throws(() => validatePrefix('a:b', 'win32'), error => error.code === 'temp-task/prefix-invalid-chars');
  assert.throws(() => validatePrefix('a/b', 'darwin'), error => error.code === 'temp-task/prefix-invalid-chars');
  assert.throws(() => validatePrefix('', 'darwin'), error => error.code === 'temp-task/prefix-empty');
  assert.throws(() => validatePrefix('..', 'darwin'), error => error.code === 'temp-task/prefix-dot');
  assert.throws(
    () => validatePrefix('x'.repeat(41), 'darwin'),
    error => error.code === 'temp-task/prefix-too-long' && error.params.max === 40,
  );
  assert.throws(() => validatePrefix('a/b', 'darwin'), /不能包含/);
  assert.throws(() => validatePrefix('a\\b', 'linux'), /不能包含/);
  assert.throws(() => validatePrefix('a\u0007b', 'linux'), /不能包含/);
});

test('makeDirectory creates the root and de-duplicates same-second names', async () => {
  const options = await temporaryRoot();
  const store = storeFor(options);
  const date = new Date(2026, 10, 5, 16, 44, 26);

  const first = await store.makeDirectory(date);
  const second = await store.makeDirectory(date);

  assert.equal(first.name, '临时-20261105-164426');
  assert.equal(second.name, '临时-20261105-164426-2');
  assert.ok((await fs.stat(first.dir)).isDirectory());
  assert.ok((await fs.stat(second.dir)).isDirectory());
});

test('ownership marker round-trips and rejects foreign markers', async () => {
  const options = await temporaryRoot();
  const store = storeFor(options);
  const { dir } = await store.makeDirectory(new Date());
  const record = { id: 'task-1', createdAt: new Date().toISOString() };

  await store.writeMarker(dir, record);
  assert.deepEqual((await store.readMarker(dir)).id, 'task-1');
  assert.equal((await store.readMarker(dir)).plugin, 'dsh-temp-task');

  // Directories created before the rename still carry the legacy plugin name.
  await fs.writeFile(path.join(dir, OWNER_MARKER), JSON.stringify({ plugin: 'dsh-temp-task-zone', id: 'task-legacy' }));
  assert.equal((await store.readMarker(dir)).id, 'task-legacy');

  await fs.writeFile(path.join(dir, OWNER_MARKER), JSON.stringify({ plugin: 'someone-else', id: 'x' }));
  assert.equal(await store.readMarker(dir), null);
});

test('state round-trips atomically and quarantines a corrupt file', async () => {
  const options = await temporaryRoot();
  const store = storeFor(options);
  const state = {
    version: 1,
    tasks: [{ id: 'a', workspaceId: 'w', sessionId: 's', dirName: 'n', path: 'p', createdAt: 'c' }],
  };

  await store.write(state);
  assert.deepEqual(await store.read(), state);
  assert.deepEqual(await fs.readdir(options.stateDir), ['tasks.json']);

  await fs.writeFile(store.stateFile, '{ not json');
  assert.deepEqual(await store.read(), { version: 1, tasks: [] });
  const entries = await fs.readdir(options.stateDir);
  assert.ok(entries.some(name => name.startsWith('tasks.json.corrupt-')));
});

test('isUnderRoot accepts strict descendants only', async () => {
  const options = await temporaryRoot();
  const store = storeFor(options);
  const inside = path.join(options.root, '临时-1');
  assert.equal(store.isUnderRoot(inside), true);
  assert.equal(store.isUnderRoot(options.root), false);
  assert.equal(store.isUnderRoot(path.dirname(options.root)), false);
  assert.equal(store.isUnderRoot(path.join(options.root, '..', 'elsewhere')), false);
  assert.equal(store.isUnderRoot(''), false);
});

function fakeContext(registry) {
  return {
    workspaceRegistry: registry,
    sessionController: {
      create: async ({ workspaceId }) => ({ sessionId: `session-${workspaceId}` }),
    },
  };
}

function fakeRegistry(workspaces = []) {
  for (const workspace of workspaces) {
    workspace.attachSession = async sessionId => {
      if (!workspace.sessionIds.includes(sessionId)) workspace.sessionIds.push(sessionId);
    };
  }
  const map = new Map(workspaces.map(workspace => [workspace.id, workspace]));
  return {
    get: id => map.get(id),
    resolveByPath: value => workspaces.find(workspace => workspace.path === value),
    list: () => [...map.values()],
    delete: async id => map.delete(id),
    archiveSession: async () => {},
    unarchiveSession: async () => {},
    create: async (dir, title) => {
      const existing = [...map.values()].find(workspace => workspace.path === dir);
      if (existing) return existing;
      const workspace = {
        id: `w-${map.size + 1}`,
        path: dir,
        title,
        sessionIds: [],
        attachSession: async sessionId => {
          if (!workspace.sessionIds.includes(sessionId)) workspace.sessionIds.push(sessionId);
        },
      };
      map.set(workspace.id, workspace);
      return workspace;
    },
  };
}

test('list omits tasks whose workspace registration disappeared', async () => {
  const options = await temporaryRoot();
  const store = storeFor(options);
  await store.write({
    version: 1,
    tasks: [
      { id: 'a', workspaceId: 'wa', sessionId: 's', dirName: 'n', path: path.join(options.root, 'a'), createdAt: 'c' },
      { id: 'b', workspaceId: 'wb', sessionId: 's', dirName: 'n', path: path.join(options.root, 'b'), createdAt: 'c' },
    ],
  });
  const registry = fakeRegistry([{ id: 'wa', path: path.join(options.root, 'a'), title: '临时 · 1', sessionIds: [] }]);
  const service = new TempTaskService(fakeContext(registry), store);
  await service.init();

  const listed = await service.list();
  assert.deepEqual(listed.tasks.map(task => task.workspaceId), ['wa']);
  assert.equal(listed.root, options.root);
});

test('reconcile adopts a marked directory that has a registration but no record', async () => {
  const options = await temporaryRoot();
  const store = storeFor(options);
  const { dir, name } = await store.makeDirectory(new Date());
  await store.writeMarker(dir, { id: 'adopted', createdAt: '2026-11-05T00:00:00.000Z' });
  const registry = fakeRegistry([{ id: 'w-adopted', path: dir, title: '临时 · x', sessionIds: [] }]);

  const service = new TempTaskService(fakeContext(registry), store);
  await service.init();

  assert.equal(service.state.tasks.length, 1);
  assert.equal(service.state.tasks[0].id, 'adopted');
  assert.equal(service.state.tasks[0].dirName, name);
  const persisted = await store.read();
  assert.equal(persisted.tasks.length, 1);
});

test('create registers a directory, makes a session and persists the record', async () => {
  const options = await temporaryRoot();
  const store = storeFor(options);
  const registry = fakeRegistry();
  const ctx = fakeContext(registry);
  const created = [];
  registry.create = async (dir, title) => {
    created.push({ dir, title });
    const workspace = { id: 'w-1', path: dir, title, sessionIds: [] };
    registry.get = id => (id === workspace.id ? workspace : undefined);
    return workspace;
  };
  const service = new TempTaskService(ctx, store);
  await service.init();

  const record = await service.create();
  assert.equal(record.workspaceId, 'w-1');
  assert.equal(record.sessionId, 'session-w-1');
  assert.match(created[0].title, /^临时 · \d{2}-\d{2} \d{2}:\d{2}$/);
  assert.ok((await fs.stat(record.path)).isDirectory());
  assert.equal((await store.readMarker(record.path)).id, record.id);
  assert.equal((await store.read()).tasks.length, 1);
});

test('create rolls back the directory and registration when the session fails', async () => {
  const options = await temporaryRoot();
  const store = storeFor(options);
  const registry = fakeRegistry();
  const deleted = [];
  registry.delete = async id => { deleted.push(id); };
  const ctx = fakeContext(registry);
  ctx.sessionController.create = async () => { throw new Error('session boom'); };
  const service = new TempTaskService(ctx, store);
  await service.init();

  await assert.rejects(() => service.create(), /session boom/);
  assert.equal((await store.read()).tasks.length, 0);
  const remaining = await fs.readdir(options.root).catch(() => []);
  assert.deepEqual(remaining, []);
  assert.equal(deleted.length, 1);
});

test('remove archives sessions, trashes the marked directory and drops the record', async () => {
  const options = await temporaryRoot();
  const root = path.join(options.base, 'trash');
  process.env.DSH_TEMP_TASK_TRASH_DIR = root;
  try {
    const store = storeFor(options);
    const { dir, name } = await store.makeDirectory(new Date());
    await store.writeMarker(dir, { id: 'own-1', createdAt: new Date().toISOString() });
    const archived = [];
    const registry = fakeRegistry([{ id: 'w1', path: dir, title: '临时', sessionIds: ['s1', 's2'] }]);
    registry.archiveSession = async (id, options) => { archived.push([id, options]); };
    const service = new TempTaskService(fakeContext(registry), store);
    service.state = {
      version: 1,
      tasks: [{ id: 'own-1', workspaceId: 'w1', sessionId: 's1', dirName: name, path: dir, createdAt: 'c' }],
    };
    await service.remove('w1', { keepDirectory: false });

    assert.deepEqual(archived, [['s1', { stopActivity: true }], ['s2', { stopActivity: true }]]);
    assert.equal((await store.read()).tasks.length, 0);
    assert.equal(await fs.stat(dir).then(() => 'present', () => 'gone'), 'gone');
    assert.equal(await fs.stat(path.join(root, name)).then(() => 'present', () => 'gone'), 'present');
  } finally {
    delete process.env.DSH_TEMP_TASK_TRASH_DIR;
  }
});

test('remove refuses to trash a directory it does not own', async () => {
  const options = await temporaryRoot();
  const store = storeFor(options);
  const foreign = path.join(options.root, '临时-foreign');
  await fs.mkdir(foreign, { recursive: true });
  const service = new TempTaskService(fakeContext(fakeRegistry()), store);
  service.state = {
    version: 1,
    tasks: [{ id: 'x', workspaceId: 'wx', sessionId: null, dirName: '临时-foreign', path: foreign, createdAt: 'c' }],
  };

  await assert.rejects(() => service.remove('wx', { keepDirectory: false }), /归属标记/);
  assert.ok((await fs.stat(foreign)).isDirectory());
  assert.equal(service.state.tasks.length, 1);
});

test('remove with keepDirectory archives sessions but keeps the folder', async () => {
  const options = await temporaryRoot();
  const store = storeFor(options);
  const { dir, name } = await store.makeDirectory(new Date());
  await store.writeMarker(dir, { id: 'own-2', createdAt: 'c' });
  const registry = fakeRegistry([{ id: 'w2', path: dir, title: '临时', sessionIds: ['s9'] }]);
  const service = new TempTaskService(fakeContext(registry), store);
  service.state = {
    version: 1,
    tasks: [{ id: 'own-2', workspaceId: 'w2', sessionId: 's9', dirName: name, path: dir, createdAt: 'c' }],
  };

  await service.remove('w2', { keepDirectory: true });
  assert.ok((await fs.stat(dir)).isDirectory());
  assert.equal((await store.read()).tasks.length, 0);
});

test('remove keeps working after the storage root moves', async () => {
  const options = await temporaryRoot();
  const trash = path.join(options.base, 'trash-moved');
  process.env.DSH_TEMP_TASK_TRASH_DIR = trash;
  try {
    const store = storeFor(options);
    const { dir, name } = await store.makeDirectory(new Date());
    await store.writeMarker(dir, { id: 'old-1', createdAt: 'c', root: options.root });
    const registry = fakeRegistry([{ id: 'w-old', path: dir, title: '临时', sessionIds: [] }]);
    const service = new TempTaskService(fakeContext(registry), store);
    service.state = {
      version: 1,
      tasks: [{ id: 'old-1', root: options.root, workspaceId: 'w-old', sessionId: null, dirName: name, path: dir, createdAt: 'c' }],
    };

    await service.saveSettings({ rootDirectory: path.join(options.base, 'moved-root'), dirPrefix: 'new' });
    await service.remove('w-old', { keepDirectory: false });

    assert.equal(await fs.stat(dir).then(() => 'present', () => 'gone'), 'gone');
    assert.equal(await fs.stat(path.join(trash, name)).then(() => 'present', () => 'gone'), 'present');
  } finally {
    delete process.env.DSH_TEMP_TASK_TRASH_DIR;
  }
});

test('changing the root keeps existing tasks listed and openable', async () => {
  const options = await temporaryRoot();
  const store = storeFor(options);
  const dirName = '临时-20260101-010101';
  const oldDir = path.join(options.root, dirName);
  const registry = fakeRegistry([
    { id: 'w-old', path: oldDir, title: '临时 · 01-01 01:01', sessionIds: ['s-old'] },
  ]);
  const service = new TempTaskService(fakeContext(registry), store);
  service.state = {
    version: 1,
    tasks: [{
      id: 'old',
      root: options.root,
      workspaceId: 'w-old',
      sessionId: 's-old',
      dirName,
      path: oldDir,
      createdAt: 'c',
    }],
  };

  const moved = path.join(options.base, 'moved-root');
  const saved = await service.saveSettings({ rootDirectory: moved, dirPrefix: 'new' });

  // New tasks use the new root; the old record keeps its own location.
  assert.equal(saved.rootDirectory, path.normalize(moved));
  assert.equal(service.state.tasks[0].path, oldDir);

  const listed = await service.list();
  assert.equal(listed.root, path.normalize(moved));
  assert.equal(listed.tasks.length, 1);
  assert.equal(listed.tasks[0].path, oldDir);
  assert.equal(listed.tasks[0].title, '临时 · 01-01 01:01');

  // Opening still goes through the recorded workspace/session, not the root.
  const opened = await service.open('w-old');
  assert.equal(opened.sessionId, 's-old');
});

test('open reuses the recorded session, else falls back, else creates one', async () => {
  const options = await temporaryRoot();
  const store = storeFor(options);
  const registry = fakeRegistry([
    { id: 'w3', path: path.join(options.root, 'a'), title: '临时', sessionIds: ['s-old', 's-new'] },
  ]);
  const service = new TempTaskService(fakeContext(registry), store);
  service.state = {
    version: 1,
    tasks: [{ id: 'r3', workspaceId: 'w3', sessionId: 's-old', dirName: 'a', path: path.join(options.root, 'a'), createdAt: 'c' }],
  };

  assert.equal((await service.open('w3')).sessionId, 's-old');

  service.state.tasks[0].sessionId = 's-missing';
  assert.equal((await service.open('w3')).sessionId, 's-old');

  registry.get('w3').sessionIds = [];
  assert.equal((await service.open('w3')).sessionId, 'session-w3');
  assert.equal(service.state.tasks[0].sessionId, 'session-w3');
});

test('unknown ids are rejected before touching the filesystem', async () => {
  const options = await temporaryRoot();
  const service = new TempTaskService(fakeContext(fakeRegistry()), storeFor(options));
  await service.init();
  await assert.rejects(() => service.open('nope'), /临时任务/);
  await assert.rejects(() => service.remove('nope', {}), /临时任务/);
});

test('settings persist and drive new directory names', async () => {
  const options = await temporaryRoot();
  const store = storeFor(options);
  const other = path.join(options.base, 'other-root');
  const saved = await store.saveSettings({ rootDirectory: other, dirPrefix: 'scratch' });

  assert.equal(saved.rootDirectory, path.normalize(other));
  assert.equal(saved.dirPrefix, 'scratch');
  assert.equal(saved.defaults.rootDirectory, options.root);
  assert.equal(saved.defaults.dirPrefix, '临时');

  const second = storeFor(options);
  await second.loadSettings();
  assert.equal(second.rootDirectory, path.normalize(other));
  assert.equal(second.prefix, 'scratch');
  const { name } = await second.makeDirectory(new Date(2026, 10, 5, 1, 2, 3));
  assert.equal(name, 'scratch-20261105-010203');
});

test('settings reject a relative root, an empty prefix and illegal characters', async () => {
  const options = await temporaryRoot();
  const store = storeFor(options);
  await assert.rejects(() => store.saveSettings({ rootDirectory: 'relative/path', dirPrefix: '临时' }), /绝对路径/);
  await assert.rejects(() => store.saveSettings({ rootDirectory: options.root, dirPrefix: '   ' }), /不能为空/);
  await assert.rejects(() => store.saveSettings({ rootDirectory: options.root, dirPrefix: 'a/b' }), /不能包含/);
  assert.equal((await fs.readdir(options.stateDir).catch(() => [])).includes('settings.json'), false);
});

test('a leading ~ in a saved settings file expands to the home directory', async () => {
  const options = await temporaryRoot();
  const store = storeFor(options);
  await fs.mkdir(options.stateDir, { recursive: true });
  await fs.writeFile(store.settingsFile, JSON.stringify({ version: 1, rootDirectory: '~/ttz-test', dirPrefix: 'p' }));

  const second = storeFor(options);
  await second.loadSettings();
  assert.equal(second.rootDirectory, path.normalize(path.join(os.homedir(), 'ttz-test')));
});

test('an unreadable settings file leaves the configured defaults untouched', async () => {
  const options = await temporaryRoot();
  const store = storeFor(options);
  await store.saveSettings({ rootDirectory: options.root, dirPrefix: 'x' });
  await fs.writeFile(store.settingsFile, '{ broken');

  const second = storeFor(options);
  assert.equal(await second.loadSettings(), null);
  assert.equal(second.prefix, '临时');
  assert.equal(second.settingsSnapshot().defaults.dirPrefix, '临时');
});

test('service exposes saved settings and switches the root used by list', async () => {
  const options = await temporaryRoot();
  const store = storeFor(options);
  const service = new TempTaskService(fakeContext(fakeRegistry()), store);
  await service.init();

  assert.equal(service.getSettings().dirPrefix, '临时');
  const moved = path.join(options.base, 'moved');
  const saved = await service.saveSettings({ rootDirectory: moved, dirPrefix: 't' });

  assert.equal(saved.rootDirectory, path.normalize(moved));
  assert.equal(saved.dirPrefix, 't');
  assert.equal((await service.list()).root, path.normalize(moved));

  const record = await service.create();
  assert.equal(path.dirname(record.path), path.normalize(moved));
  assert.match(path.basename(record.path), /^t-\d{8}-\d{6}$/);
});

test('the hero new-task switch defaults on and persists independently', async () => {
  const options = await temporaryRoot();
  const store = storeFor(options);
  assert.equal(store.settingsSnapshot().heroNewTask, true);
  assert.equal(store.settingsSnapshot().defaults.heroNewTask, true);

  const saved = await store.saveSettings({ rootDirectory: options.root, dirPrefix: '临时', heroNewTask: false });
  assert.equal(saved.heroNewTask, false);

  const second = storeFor(options);
  await second.loadSettings();
  assert.equal(second.heroNewTask, false);

  // Omitting the switch preserves the saved value instead of resetting it.
  const kept = await second.saveSettings({ rootDirectory: options.root, dirPrefix: '临时' });
  assert.equal(kept.heroNewTask, false);
});

test('a settings file without the hero switch keeps it on', async () => {
  const options = await temporaryRoot();
  const store = storeFor(options);
  await fs.mkdir(options.stateDir, { recursive: true });
  await fs.writeFile(store.settingsFile, JSON.stringify({ version: 1, rootDirectory: options.root, dirPrefix: 'p' }));

  const second = storeFor(options);
  await second.loadSettings();
  assert.equal(second.heroNewTask, true);
});

test('a non-boolean hero switch in the file is ignored', async () => {
  const options = await temporaryRoot();
  const store = storeFor(options);
  await fs.mkdir(options.stateDir, { recursive: true });
  await fs.writeFile(store.settingsFile, JSON.stringify({ version: 1, rootDirectory: options.root, dirPrefix: 'p', heroNewTask: 'off' }));

  const second = storeFor(options);
  await second.loadSettings();
  assert.equal(second.heroNewTask, true);
});

test('service forwards the hero new-task switch through saveSettings', async () => {
  const options = await temporaryRoot();
  const store = storeFor(options);
  const service = new TempTaskService(fakeContext(fakeRegistry()), store);
  await service.init();

  const saved = await service.saveSettings({ rootDirectory: options.root, dirPrefix: '临时', heroNewTask: false });
  assert.equal(saved.heroNewTask, false);
  assert.equal(service.getSettings().heroNewTask, false);
});

function contextWithSummaries(registry, summaries) {
  const base = fakeContext(registry);
  return {
    ...base,
    sessionController: {
      ...base.sessionController,
      list: async () => ({ items: summaries }),
    },
  };
}

test('sweepBlank discards an unused blank task and its empty directory', async () => {
  const options = await temporaryRoot();
  const store = storeFor(options);
  const old = new Date(Date.now() - 60_000);
  const { dir } = await store.makeDirectory(old);
  const record = {
    id: 'task-blank',
    workspaceId: 'w-blank',
    sessionId: 's-blank',
    dirName: path.basename(dir),
    path: dir,
    createdAt: old.toISOString(),
  };
  await store.writeMarker(dir, record);
  await store.write({ version: 1, tasks: [record] });

  const registry = fakeRegistry([{ id: 'w-blank', path: dir, title: '临时', sessionIds: ['s-blank'] }]);
  const ctx = contextWithSummaries(registry, [{ sessionId: 's-blank', blank: true }]);
  const service = new TempTaskService(ctx, store);
  await service.init();

  const result = await service.sweepBlank({ currentSessionId: 's-live' });

  assert.deepEqual(result.removed, ['w-blank']);
  assert.equal(service.state.tasks.length, 0);
  assert.equal(registry.get('w-blank'), undefined);
  await assert.rejects(() => fs.stat(dir), /ENOENT/);
});

test('sweepBlank keeps the current, protected, recent and used tasks', async () => {
  const options = await temporaryRoot();
  const store = storeFor(options);
  const old = new Date(Date.now() - 60_000);
  const tasks = [];
  const registry = fakeRegistry();

  for (const [index, sessionId] of ['s-current', 's-protected', 's-used', 's-recent'].entries()) {
    const at = sessionId === 's-recent' ? new Date() : old;
    const { dir } = await store.makeDirectory(at);
    const record = {
      id: `task-${index}`,
      workspaceId: `w-${index}`,
      sessionId,
      dirName: path.basename(dir),
      path: dir,
      createdAt: at.toISOString(),
    };
    await store.writeMarker(dir, record);
    tasks.push(record);
    registry.create(dir, '临时');
  }
  const workspaces = registry.list();
  tasks.forEach((record, index) => { record.workspaceId = workspaces[index].id; });
  for (const record of tasks) await store.writeMarker(record.path, record);
  await store.write({ version: 1, tasks });

  const ctx = contextWithSummaries(registry, [
    { sessionId: 's-current', blank: true },
    { sessionId: 's-protected', blank: true },
    { sessionId: 's-used', blank: false },
    { sessionId: 's-recent', blank: true },
  ]);
  const service = new TempTaskService(ctx, store);
  await service.init();

  const result = await service.sweepBlank({ currentSessionId: 's-current', protectSessionId: 's-protected' });

  assert.deepEqual(result.removed, []);
  assert.equal(service.state.tasks.length, 4);
  for (const record of tasks) assert.ok(await fs.stat(record.path).then(() => true, () => false));
});

test('moveToWorkspace re-registers the folder and drops the temporary record', async () => {
  const options = await temporaryRoot();
  const store = storeFor(options);
  const { dir } = await store.makeDirectory(new Date(Date.now() - 60_000));
  const record = {
    id: 'task-move',
    workspaceId: 'w-temp',
    sessionId: 's-move',
    dirName: path.basename(dir),
    path: dir,
    createdAt: new Date(Date.now() - 60_000).toISOString(),
  };
  await store.writeMarker(dir, record);
  await store.write({ version: 1, tasks: [record] });

  const registry = fakeRegistry([{ id: 'w-temp', path: dir, title: '临时 · 11-05 10:00', sessionIds: ['s-move'] }]);
  let unarchived = null;
  const unarchive = registry.unarchiveSession;
  registry.unarchiveSession = async sessionId => { unarchived = sessionId; return unarchive(sessionId); };
  const ctx = contextWithSummaries(registry, [{ sessionId: 's-move', title: ' 修复登录 ' }]);
  const service = new TempTaskService(ctx, store);
  await service.init();

  const result = await service.moveToWorkspace('w-temp');

  assert.equal(result.sessionId, 's-move');
  assert.equal(result.title, '修复登录');
  assert.notEqual(result.workspaceId, 'w-temp');
  assert.equal(unarchived, 's-move');
  assert.equal(registry.get('w-temp'), undefined);

  const moved = registry.get(result.workspaceId);
  assert.equal(moved.path, dir);
  assert.equal(moved.title, '修复登录');
  assert.deepEqual(moved.sessionIds, ['s-move']);

  assert.equal(service.state.tasks.length, 0);
  assert.deepEqual((await store.read()).tasks, []);
  assert.equal(await store.readMarker(dir), null);
  assert.ok((await fs.stat(dir)).isDirectory());
});

test('moveToWorkspace refuses a folder without its ownership marker', async () => {
  const options = await temporaryRoot();
  const store = storeFor(options);
  const { dir } = await store.makeDirectory(new Date());
  const record = {
    id: 'task-foreign',
    workspaceId: 'w-temp',
    sessionId: 's-move',
    dirName: path.basename(dir),
    path: dir,
    createdAt: new Date().toISOString(),
  };
  await store.write({ version: 1, tasks: [record] });

  const registry = fakeRegistry([{ id: 'w-temp', path: dir, title: '临时', sessionIds: ['s-move'] }]);
  const service = new TempTaskService(fakeContext(registry), store);
  await service.init();

  await assert.rejects(() => service.moveToWorkspace('w-temp'), /归属标记/);
  assert.equal(registry.get('w-temp')?.id, 'w-temp');
  assert.equal(service.state.tasks.length, 1);
});


