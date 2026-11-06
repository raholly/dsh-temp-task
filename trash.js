import { execFile } from 'node:child_process';
import { mkdir, rename, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ERROR_PREFIX, pluginError } from './errors.js';

/**
 * Sending a task folder to the operating system's recycle bin.
 *
 * Policy: this module never permanently deletes anything. Every branch either
 * hands the folder to the platform trash (Recycle Bin / Trash / gio) or throws,
 * so a failure leaves the folder untouched.
 *
 * `DSH_TEMP_TASK_TRASH_DIR` overrides the target directory. It is meant for
 * tests and for environments without a desktop trash, and keeps the same
 * rename-only behaviour: a cross-device target is refused, never deleted.
 */

const TRASH_DIR_ENV = 'DSH_TEMP_TASK_TRASH_DIR';
const CROSS_DEVICE = 'EXDEV';

export async function moveToTrash(target) {
  const override = process.env[TRASH_DIR_ENV];
  if (override) {
    return { trashed: true, location: await relocate(override, target) };
  }

  switch (process.platform) {
    case 'win32':
      return recycleWithPowerShell(target);
    case 'darwin':
      return recycleThroughMacTrash(target);
    case 'linux':
      return recycleWithGio(target);
    default:
      throw pluginError(
        'trash-failed',
        `当前系统（${process.platform}）没有可用的回收站机制，未删除：${target}。可以手动删除。`,
        { path: target, detail: process.platform },
      );
  }
}

/** Rename into `directory`, refusing to cross filesystems. */
async function relocate(directory, target) {
  await mkdir(directory, { recursive: true });
  const destination = await unusedPath(directory, path.basename(target));
  try {
    await rename(target, destination);
  } catch (error) {
    if (error?.code === CROSS_DEVICE) {
      throw pluginError(
        'trash-cross-device',
        `临时目录与回收站不在同一磁盘，无法移入回收站：${target}。`,
        { path: target },
      );
    }
    throw error;
  }
  return destination;
}

async function unusedPath(directory, baseName) {
  for (let attempt = 1; ; attempt += 1) {
    const candidate = path.join(directory, attempt === 1 ? baseName : `${baseName} (${attempt})`);
    if (!(await pathExists(candidate))) return candidate;
  }
}

async function pathExists(value) {
  try {
    await stat(value);
    return true;
  } catch {
    return false;
  }
}

async function recycleThroughMacTrash(target) {
  try {
    return { trashed: true, location: await relocate(path.join(os.homedir(), '.Trash'), target) };
  } catch (error) {
    // ~/.Trash lives on the boot volume. A folder on an external volume cannot
    // be renamed into it, so Finder does the cross-volume move for us.
    if (!hasErrorCode(error, 'trash-cross-device')) throw error;
    return handToFinder(target);
  }
}

async function handToFinder(target) {
  const script = `tell application "Finder" to delete POSIX file "${escapeAppleScript(target)}"`;
  try {
    await runProcess('osascript', ['-e', script]);
    return { trashed: true, location: null };
  } catch (error) {
    throw trashFailed(target, error);
  }
}

function escapeAppleScript(value) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

async function recycleWithPowerShell(target) {
  const directory = `'${target.replace(/'/g, "''")}'`;
  const script = [
    'Add-Type -AssemblyName Microsoft.VisualBasic;',
    `$folder = ${directory};`,
    "[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($folder, 'OnlyErrorDialogs', 'SendToRecycleBin')",
  ].join(' ');
  try {
    await runProcess('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
    return { trashed: true, location: null };
  } catch (error) {
    throw trashFailed(target, error);
  }
}

async function recycleWithGio(target) {
  try {
    await runProcess('gio', ['trash', '--', target]);
    return { trashed: true, location: null };
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw pluginError('trash-unavailable', '此系统没有可用的回收站工具（gio），无法安全删除该目录。');
    }
    throw trashFailed(target, error);
  }
}

function trashFailed(target, error) {
  const detail = String(error?.stderr || error?.message || '').trim() || String(error);
  return pluginError(
    'trash-failed',
    `无法把目录移入回收站：${target}（${detail}）。可以手动把它移到回收站。`,
    { path: target, detail },
  );
}

function hasErrorCode(error, shortCode) {
  return error?.code === `${ERROR_PREFIX}${shortCode}`;
}

function runProcess(file, args) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true }, (error, stdout, stderr) => {
      if (!error) {
        resolve({ stdout, stderr });
        return;
      }
      error.stderr = String(stderr ?? '').trim();
      reject(error);
    });
  });
}
