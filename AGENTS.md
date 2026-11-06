# AGENTS.md

Guidance for coding agents working on **dsh-temp-task** — a DeepSeek Harness (DSH) sidebar plugin that gives you throwaway tasks: one click creates a timestamped folder, a workspace registration and a conversation, all listed in a flat "临时任务" zone above the normal workspaces.

## Layout

| Path | Role |
| --- | --- |
| `index.js` | Host entry: Cordis `apply()`, RPC channel `/temp-task-zone`, settings/state-dir resolution, legacy state migration |
| `service.js` | Host business logic: create / open / remove / move / sweep / settings |
| `store.js` | Persistence: `tasks.json`, `settings.json`, folder naming, ownership markers |
| `trash.js` | Recycle-bin only deletion (Windows / macOS / Linux / `DSH_TEMP_TASK_TRASH_DIR` override) |
| `errors.js` | `pluginError(code, message, params)` → `temp-task/<code>` errors |
| `client.js` | Browser bundle: sidebar zone, task rows, menus, search/view options, settings page, new-session integration |
| `locale/*.json` | UI strings, 8 locales: `zh en ja es fr de ru pt` |
| `tests/*.test.js` | `node:test` suites (38 tests) |
| `docs/images/*.png` | README screenshots |
| `cordis.patch.yml` | Bundle patch that inserts the plugin |

Host code is plain ESM Node (`>=22`), client code is plain JS loaded by DSH's page module loader. **No build step, no runtime dependencies.**

## Golden rules

1. **Never permanently delete a task folder.** All deletions go through `trash.js` (system recycle bin, or `DSH_TEMP_TASK_TRASH_DIR` for tests). When the trash is unavailable the operation must fail and leave the folder in place. `sweepBlank()` may delete an *empty* folder permanently only when it contains just the ownership marker — keep that exception narrow.
2. **Validate before touching a directory.** Require the `.dsh-temp-task-owner.json` marker to match the record id, and the resolved path to stay under one of the allowed roots (`record.root`, marker root, current root, default root). Never trust a path from client input.
3. **Host errors carry a stable code.** Throw `pluginError('short-code', '中文兜底文案', params)`; the client translates `err_<code>`. Bare `throw new Error()` in an RPC path is a bug. `params` keys must match the `{placeholders}` in locale files.
4. **All UI text lives in `locale/*.json`.** No user-visible strings in `client.js` except the locale-detection lists (`NEW_SESSION_LABELS`, `ADD_WORKSPACE_HINTS`) and code comments. When adding a key, add it to **all 8 files**; the locale test enforces identical key sets.
5. **Persist only under `$DSH_HOME/dsh-temp-task/<profileHash>`.** Old installs used `temp-task-zone/`; `resolveStateDir()` migrates it on startup — keep that path working.
6. **Never edit the user's DSH installation or profile by hand.** Install/uninstall via `plugin_manager` (`install_bundle` / `remove_bundle`) against the package directory. Host changes need a full DSH restart; client changes only need `Ctrl+R`.

## RPC surface

Channel: `/temp-task-zone`. Methods handled in `index.js`:

`list`, `create`, `open`, `getSettings`, `getLocales`, `saveSettings`, `sweepBlank`, `moveToWorkspace`, `delete`.

- Every request is checked by `assertInteractive(peer)`; anonymous / non-interactive peers get `temp-task/forbidden` or `temp-task/no-interaction`.
- Responses are `{ ok: true, value }` or `{ ok: false, error: { code, message, details } }`.
- Client side: `call(method, payload)` in `client.js` unwraps the envelope and localizes errors via `localizedError()`.
- RPC is registered through `ctx.connection.rpc.handle`; if that fails the host falls back to a `ctx.webServer.register` prefix route with its own admit/envelope handling. Keep both paths working.
- RPC methods that mutate the sidebar (`create`, `delete`, `moveToWorkspace`, `sweepBlank`, `saveSettings`) run through the service's serialized `queue()`; do not add concurrent state writes outside it.

## Data model

- `tasks.json`: `{ version: 1, tasks: [...] }`; each record has `id`, `workspaceId`, `sessionId` (nullable), `dirName`, `path`, `createdAt`, and `root` for tasks created after settings support.
- `settings.json`: `{ version: 1, rootDirectory, dirPrefix, heroNewTask }`. Precedence: saved settings → `apply()` config → built-in defaults (`~/Documents/deepseek-harness`, prefix `临时`).
- `.dsh-temp-task-owner.json` inside each task folder: `{ plugin: 'dsh-temp-task', version, id, createdAt, root? }`. `readMarker()` also accepts the legacy plugin name `dsh-temp-task-zone`; do not drop that compatibility.
- A temp task is *workspace + session + folder*. The sidebar row title comes from the session title; the workspace title (`临时 · MM-DD HH:mm`) is the fallback.
- `sweepBlank()` removes a task whose session is still blank after the user switched away. It protects the currently viewed session and the just-opened one; the host re-checks `blank` via `sessionController.list()` before deleting.
- `moveToWorkspace()` keeps the folder where it is, deletes the temporary workspace registration, re-registers the same path as a normal workspace, attaches the session, removes the ownership marker and drops the record. Same-path `create()` returns the existing workspace, so delete first.

## Client conventions

- Inject the zone as a sibling above the official "工作区" section header; locate by `[data-row-key^="workspace:"]` → `[role="tree"]` → ancestor with a direct `[class*="sectionHeader"]` child. Never rely on hashed CSS module class names.
- Hide the official temp workspace rows (`groupSection` in grouped mode, session rows in flat mode) instead of removing React nodes.
- The zone must degrade silently: if any DOM lookup fails, do nothing rather than throw.
- UI primitives (`Menu`, `Tooltip`) come from `@deepseek-ai/dsh-client-ui-primitives` and need a small React root; load them via `try { require(...) }` and hide the affordance when unavailable. Plain rows use hand-written SVG copied from the official sprite.
- Subscribe to `ctx.sessions.list`, `ctx.workspaces.list` and `ctx.locale` and re-render; don't cache titles or language strings across changes.
- Styling uses `--dsw-alias-*` / `--dsh-sidebar-*` tokens. Copy the official 34 px row / 36 px header metrics; do not invent spacing.
- The new-session interception (`onDocumentClick` in capture phase) and the hero dropdown injection are DOM-level integrations. They are best-effort: recognize buttons by localized `aria-label`, `class*="newSession"`, or a `new-chat` icon href; skip modified clicks, menu/dialog/row targets, and when the setting is off.

## Testing

```powershell
node --check index.js; node --check service.js; node --check store.js; node --check trash.js; node --check client.js
npm test
```

- Tests use `node:test`, temporary directories, `DSH_HOME` overrides and a fake Cordis `ctx`; they must not touch the real `~/.dsh` or open network connections.
- `tests/store.test.js` covers persistence, settings, sweep, move and deletion safety; `tests/index.test.js` covers the RPC envelope and state migration; `tests/trash.test.js` covers the `DSH_TEMP_TASK_TRASH_DIR` path.
- When you change behavior, add a test next to the existing cases instead of asserting through the client.
- Locale parity is asserted in `tests/index.test.js` (`getLocales`). Keep `meta.title` translated too.

## Adding things

- **New UI text** → add the key to all 8 locale files (same key, translated value); then use `t('key')`. Placeholders (`{message}`, `{path}`, `{detail}`, `{max}`, `{example}`) must survive translation.
- **New RPC method** → `service.js` method (queued if it mutates) + `index.js` branch + client `call()` user + a fake-ctx test.
- **New language** → copy `locale/en.json`, translate values, keep keys; the host serves any `*.json` in `locale/` whose filename is a BCP-47-ish tag.
- **Version bump** → `package.json` version + README test count if tests changed. Host changes also require telling the user to restart DSH.

## Platform notes

- Windows: recycle via `Microsoft.VisualBasic.FileIO.FileSystem::DeleteDirectory(..., 'SendToRecycleBin')`; quote paths by doubling `'`.
- macOS: rename into `~/.Trash`; on `EXDEV` hand the folder to Finder via `osascript` (Finder automation may need approval).
- Linux: `gio trash --`; missing `gio` → `trash-unavailable`, never a plain `rm`.
- Paths: use `node:path` + `os.homedir()`; expand `~` yourself; prefix validation differs per platform (Windows forbids `\ / : * ? " < > |`).

## Don't

- Don't add npm dependencies; the plugin ships as plain files.
- Don't extract hashed CSS classes or byte-copy code from other plugins.
- Don't rename the RPC channel, `cordis.patch.yml` id, or the state directory without a migration.
- Don't make `client.js` throw during `apply()`; the rest of the sidebar must keep working when the plugin's DOM assumptions fail.
