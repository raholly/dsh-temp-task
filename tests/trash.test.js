import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { moveToTrash } from '../trash.js';

const ENV = 'DSH_TEMP_TASK_TRASH_DIR';

async function scratch() {
  const base = await mkdtemp(path.join(os.tmpdir(), 'dsh-temp-task-trash-'));
  return {
    base,
    dispose: () => rm(base, { recursive: true, force: true }),
  };
}

function withOverride(value, body) {
  const previous = process.env[ENV];
  process.env[ENV] = value;
  return body().finally(() => {
    if (previous === undefined) delete process.env[ENV];
    else process.env[ENV] = previous;
  });
}

test('moves the folder into the override directory', async () => {
  const { base, dispose } = await scratch();
  try {
    const folder = path.join(base, '任务-20260101-010101');
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, 'note.txt'), 'keep me');
    const bin = path.join(base, 'bin');

    const result = await withOverride(bin, () => moveToTrash(folder));

    assert.equal(result.trashed, true);
    assert.equal(result.location, path.join(bin, '任务-20260101-010101'));
    assert.equal(await stat(folder).then(() => 'present', () => 'gone'), 'gone');
    assert.equal(await stat(result.location).then(() => 'present', () => 'gone'), 'present');
  } finally {
    await dispose();
  }
});

test('adds a suffix instead of overwriting a same-named folder in the bin', async () => {
  const { base, dispose } = await scratch();
  try {
    const folder = path.join(base, '任务-20260101-010101');
    await mkdir(folder, { recursive: true });
    const bin = path.join(base, 'bin');
    await mkdir(path.join(bin, '任务-20260101-010101'), { recursive: true });
    await writeFile(path.join(bin, '任务-20260101-010101', 'older.txt'), 'older');

    const result = await withOverride(bin, () => moveToTrash(folder));

    assert.equal(result.location, path.join(bin, '任务-20260101-010101 (2)'));
    assert.equal(await stat(path.join(bin, '任务-20260101-010101', 'older.txt')).then(() => 'present'), 'present');
    assert.equal(await stat(result.location).then(() => 'present'), 'present');
  } finally {
    await dispose();
  }
});
