window.__ModuleLoader__.load({
  id: 'dsh-temp-task',
  factory(require) {
    const NS = 'local.tempTaskZone';
    const CHANNEL = '/temp-task-zone';


    // Menu entries render inside the official React context menu, so their
    // icons may be React elements. The row icons below must be plain markup
    // because the temporary-task rows are DOM nodes, not React.
    let React = null;
    let ReactDOM = null;
    let primitives = null;
    try { React = require('react'); } catch { React = null; }
    try { ReactDOM = require('react-dom/client'); } catch { ReactDOM = null; }
    // The module loader may hand back an interop namespace ({ default: ... }).
    if (ReactDOM && typeof ReactDOM.createRoot !== 'function'
      && ReactDOM.default && typeof ReactDOM.default.createRoot === 'function') {
      ReactDOM = ReactDOM.default;
    }
    try { primitives = require('@deepseek-ai/dsh-client-ui-primitives'); } catch { primitives = null; }

    const h = (...args) => React.createElement(...args);

    const ICONS = {
      // Copied verbatim from the official icon sprite
      // (`folder-close` / regular, stroke width 1) so the row matches a
      // collapsed workspace row's folder exactly.
      folder: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke-width="1" aria-hidden="true"><path d="M1.50439 3.11059C1.50439 2.55831 1.95211 2.1106 2.50439 2.1106H5.43389C5.67773 2.1106 5.91318 2.19969 6.09593 2.36113L7.71649 3.79265C7.89924 3.95409 8.1347 4.04319 8.3785 4.04319H13.4958C14.0481 4.04319 14.4958 4.4909 14.4958 5.04319V12.8894C14.4958 13.4417 14.0481 13.8894 13.4958 13.8894H2.50439C1.95211 13.8894 1.50439 13.4417 1.50439 12.8894V4.04319V3.11059Z" stroke="currentColor"></path><path d="M3.63501 7.66614H12.3647" stroke="currentColor"></path></svg>',
      folderOpen: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2.55912 7.93683C2.67584 7.49906 3.0723 7.19446 3.52536 7.19446H13.6491C14.3061 7.19446 14.7846 7.81725 14.6153 8.45209L13.4411 12.856C13.3244 13.2938 12.9279 13.5984 12.4748 13.5984H2.35113C1.69411 13.5984 1.21562 12.9756 1.38489 12.3407L2.55912 7.93683Z" fill="currentColor" opacity="0.16"></path><path d="M13.6491 6.69446C14.6346 6.69453 15.3522 7.62895 15.0983 8.58118L13.9245 12.9845C13.7494 13.6412 13.1539 14.0988 12.4743 14.0988H2.35126C1.36574 14.0988 0.648153 13.1643 0.902044 12.212L2.07587 7.80774C2.25102 7.15128 2.84567 6.69455 3.52509 6.69446H13.6491ZM3.52509 7.69446C3.29865 7.69455 3.10004 7.84674 3.04169 8.06555L1.86786 12.4698C1.78345 12.7872 2.02285 13.0988 2.35126 13.0988H12.4743C12.7007 13.0988 12.8992 12.9463 12.9577 12.7277L14.1325 8.32336C14.2171 8.00598 13.9776 7.69453 13.6491 7.69446H3.52509Z" fill="currentColor"></path><path d="M4.7666 1.90137C5.13227 1.90144 5.48571 2.03525 5.75977 2.27734L7.27246 3.61328C7.36379 3.69382 7.48174 3.73828 7.60352 3.73828H12.3994C13.2276 3.73841 13.8993 4.41005 13.8994 5.23828V6.7168C13.8183 6.70327 13.735 6.69436 13.6494 6.69434H12.8994V5.23828C12.8993 4.96233 12.6754 4.73841 12.3994 4.73828H7.60352C7.23781 4.73828 6.88446 4.60438 6.61035 4.3623L5.09766 3.02637C5.00636 2.94576 4.88838 2.90144 4.7666 2.90137H2.0498C1.77366 2.90137 1.5498 3.12523 1.5498 3.40137V9.78223L0.902344 12.2119C0.648452 13.1642 1.36604 14.0986 2.35156 14.0986H2.0498C1.2214 14.0986 0.549838 13.427 0.549805 12.5986V3.40137C0.549805 2.57294 1.22138 1.90137 2.0498 1.90137H4.7666Z" fill="currentColor"></path></svg>',
      // The remaining glyphs are copied verbatim from the official sprite
      // (`pin-outline`, `pin-fill`, `archive-outline`, `unarchive-outline`,
      // `ellipsis-outline`, `plus-outline`, `triangle-right-fill`; regular
      // variant = stroke width 1) so row buttons match the official ones.
      pin: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke-width="1" aria-hidden="true"><path d="M9.96976 1.70572L13.1554 3.93629L10.9019 8.12317L11.5158 11.605L10.7192 12.7427L2.52767 7.00693L3.3243 5.86922L6.80612 5.25528L9.96976 1.70572Z" stroke="currentColor" stroke-linejoin="round"></path><path d="M6.05285 9.47511C6.27284 9.16094 6.70586 9.08458 7.02003 9.30457C7.3342 9.52455 7.41055 9.95757 7.19057 10.2717L3.98587 14.4708L3.21223 13.9291L6.05285 9.47511Z" fill="currentColor"></path></svg>',
      pinFill: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke-width="1" aria-hidden="true"><path d="M9.96976 1.70572L13.1554 3.93629L10.9019 8.12317L11.5158 11.605L10.7192 12.7427L2.52767 7.00693L3.3243 5.86922L6.80612 5.25528L9.96976 1.70572Z" fill="currentColor" stroke="currentColor" stroke-linejoin="round"></path><path d="M6.05285 9.47511C6.27284 9.16094 6.70586 9.08458 7.02003 9.30457C7.3342 9.52455 7.41055 9.95757 7.19057 10.2717L3.98587 14.4708L3.21223 13.9291L6.05285 9.47511Z" fill="currentColor"></path></svg>',
      ellipsis: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke-width="1" aria-hidden="true"><path d="M3 9C3.55228 9 4 8.55228 4 8C4 7.44772 3.55228 7 3 7C2.44772 7 2 7.44772 2 8C2 8.55228 2.44772 9 3 9Z" fill="currentColor"></path><path d="M8 9C8.55228 9 9 8.55228 9 8C9 7.44772 8.55228 7 8 7C7.44772 7 7 7.44772 7 8C7 8.55228 7.44772 9 8 9Z" fill="currentColor"></path><path d="M13 9C13.5523 9 14 8.55228 14 8C14 7.44772 13.5523 7 13 7C12.4477 7 12 7.44772 12 8C12 8.55228 12.4477 9 13 9Z" fill="currentColor"></path></svg>',
      plus: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke-width="1" aria-hidden="true"><path d="M5.54492 2.06738C5.91034 2.06754 6.26318 2.20149 6.53711 2.44336L7.94043 3.68164V4.7998C7.71462 4.74105 7.50367 4.63139 7.32617 4.47461L5.87598 3.19238C5.78477 3.11185 5.66658 3.06754 5.54492 3.06738H2.94922C2.67322 3.06738 2.44946 3.29145 2.44922 3.56738V12.4326C2.44927 12.7087 2.67311 12.9326 2.94922 12.9326H12.9326C13.2086 12.9325 13.4326 12.7086 13.4326 12.4326V8.53613H14.4326V12.4326C14.4326 13.2609 13.7609 13.9325 12.9326 13.9326H2.94922C2.12083 13.9326 1.44927 13.261 1.44922 12.4326V3.56738C1.44946 2.73916 2.12094 2.06738 2.94922 2.06738H5.54492Z" fill="currentColor"></path><path d="M9.75977 4.50208H14.5509" stroke="currentColor"></path><path d="M12.1492 6.89758L12.1492 2.10642" stroke="currentColor"></path></svg>',
      // `search-outline` / `close-fill` copied from the official sprite, so the
      // header search button and its clear affordance match the workspace one.
      search: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke-width="1" aria-hidden="true"><path d="M6.58727 11.8586C9.55061 11.8586 11.9529 9.45637 11.9529 6.49304C11.9529 3.5297 9.55061 1.12744 6.58727 1.12744C3.62394 1.12744 1.22168 3.5297 1.22168 6.49304C1.22168 9.45637 3.62394 11.8586 6.58727 11.8586Z" stroke="currentColor"></path><path d="M10.2991 10.3933L14.7783 14.8725" stroke="currentColor"></path></svg>',
      searchSmall: '<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke-width="1" aria-hidden="true"><path d="M6.58727 11.8586C9.55061 11.8586 11.9529 9.45637 11.9529 6.49304C11.9529 3.5297 9.55061 1.12744 6.58727 1.12744C3.62394 1.12744 1.22168 3.5297 1.22168 6.49304C1.22168 9.45637 3.62394 11.8586 6.58727 11.8586Z" stroke="currentColor"></path><path d="M10.2991 10.3933L14.7783 14.8725" stroke="currentColor"></path></svg>',
      clear: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke-width="1" aria-hidden="true"><path d="M3.5 3.5L12.5 12.5" stroke="currentColor"></path><path d="M12.5 3.5L3.5 12.5" stroke="currentColor"></path></svg>',
      triangle: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke-width="1" aria-hidden="true"><path d="M5.5 4.5C5.5 4.40714 5.52586 4.31612 5.57467 4.23713C5.62349 4.15815 5.69334 4.09431 5.77639 4.05279C5.85945 4.01126 5.95242 3.99368 6.0449 4.00202C6.13738 4.01036 6.22572 4.04429 6.3 4.1L10.967 7.6C11.0291 7.64657 11.0795 7.70697 11.1142 7.77639C11.1489 7.84582 11.167 7.92238 11.167 8C11.167 8.07762 11.1489 8.15418 11.1142 8.22361C11.0795 8.29303 11.0291 8.35343 10.967 8.4L6.3 11.9C6.22572 11.9557 6.13738 11.9896 6.0449 11.998C5.95242 12.0063 5.85945 11.9887 5.77639 11.9472C5.69334 11.9057 5.62349 11.8419 5.57467 11.7629C5.52586 11.6839 5.5 11.5929 5.5 11.5V4.5Z" fill="currentColor"></path></svg>',
      pin14: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke-width="1" aria-hidden="true"><path d="M9.96976 1.70572L13.1554 3.93629L10.9019 8.12317L11.5158 11.605L10.7192 12.7427L2.52767 7.00693L3.3243 5.86922L6.80612 5.25528L9.96976 1.70572Z" stroke="currentColor" stroke-linejoin="round"></path><path d="M6.05285 9.47511C6.27284 9.16094 6.70586 9.08458 7.02003 9.30457C7.3342 9.52455 7.41055 9.95757 7.19057 10.2717L3.98587 14.4708L3.21223 13.9291L6.05285 9.47511Z" fill="currentColor"></path></svg>',
      pinFill14: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke-width="1" aria-hidden="true"><path d="M9.96976 1.70572L13.1554 3.93629L10.9019 8.12317L11.5158 11.605L10.7192 12.7427L2.52767 7.00693L3.3243 5.86922L6.80612 5.25528L9.96976 1.70572Z" fill="currentColor" stroke="currentColor" stroke-linejoin="round"></path><path d="M6.05285 9.47511C6.27284 9.16094 6.70586 9.08458 7.02003 9.30457C7.3342 9.52455 7.41055 9.95757 7.19057 10.2717L3.98587 14.4708L3.21223 13.9291L6.05285 9.47511Z" fill="currentColor"></path></svg>',
      archive14: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke-width="1" aria-hidden="true"><path d="M13.5 2.5H2.5C1.94772 2.5 1.5 2.94772 1.5 3.5V4.5C1.5 5.05228 1.94772 5.5 2.5 5.5H13.5C14.0523 5.5 14.5 5.05228 14.5 4.5V3.5C14.5 2.94772 14.0523 2.5 13.5 2.5Z" stroke="currentColor"></path><path d="M2.5 5.5V13.5C2.5 13.7652 2.60536 14.0196 2.79289 14.2071C2.98043 14.3946 3.23478 14.5 3.5 14.5H12.5C12.7652 14.5 13.0196 14.3946 13.2071 14.2071C13.3946 14.0196 13.5 13.7652 13.5 13.5V5.5" stroke="currentColor"></path><path d="M6.5 9.5H9.5" stroke="currentColor"></path></svg>',
      unarchive14: '<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke-width="1" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M15.8659 2.05975C17.2603 2.05995 18.3913 3.19096 18.3914 4.58527V5.4874C18.3914 6.02747 18.2192 6.52672 17.9303 6.93735C17.9336 6.96524 17.9388 6.99318 17.9388 7.02195V12.8884C17.9388 13.6345 17.9395 14.2379 17.8996 14.7254C17.8642 15.1593 17.7936 15.5499 17.6373 15.9141L17.5654 16.0685C17.278 16.6328 16.8405 17.1046 16.3038 17.434L16.0679 17.5661C15.66 17.7739 15.2196 17.8598 14.7237 17.9003C14.2362 17.9401 13.6327 17.9405 12.8867 17.9405H7.11122C6.36511 17.9405 5.76171 17.9401 5.27418 17.9003C4.84051 17.8649 4.44949 17.7952 4.08545 17.6391L3.93104 17.5661C3.36673 17.2785 2.89392 16.8414 2.56465 16.3044L2.43245 16.0685C2.22473 15.6608 2.13878 15.2211 2.09825 14.7254C2.05841 14.2379 2.05912 13.6345 2.05912 12.8884V7.02195C2.05912 6.99284 2.06422 6.96449 2.06758 6.93629C1.77931 6.52592 1.60858 6.02687 1.60858 5.4874V4.58527C1.60876 3.19084 2.73962 2.05975 4.1341 2.05975H15.8659ZM16.4984 7.92936C16.296 7.98169 16.0847 8.01288 15.8659 8.01291H4.1341C3.91478 8.01291 3.70246 7.98194 3.49955 7.92936V12.8884C3.49955 13.6582 3.50053 14.1927 3.53445 14.608C3.56769 15.0146 3.62923 15.244 3.71635 15.415L3.7925 15.5514C3.98339 15.8627 4.25749 16.1165 4.58464 16.2833L4.72529 16.3435C4.88095 16.3993 5.08638 16.4402 5.39158 16.4651C5.80685 16.4991 6.34138 16.5001 7.11122 16.5001H12.8867C13.6564 16.5001 14.1911 16.499 14.6063 16.4651C15.0128 16.432 15.2423 16.3703 15.4133 16.2833L15.5508 16.2061C15.8618 16.0152 16.116 15.7419 16.2827 15.415L16.3429 15.2732C16.3985 15.1177 16.4396 14.9128 16.4645 14.608C16.4985 14.1927 16.4984 13.6583 16.4984 12.8884V7.92936ZM4.1341 3.50019C3.53511 3.50019 3.0492 3.98631 3.04902 4.58527V5.4874C3.04902 6.08649 3.535 6.57248 4.1341 6.57248H15.8659C16.4648 6.57228 16.951 6.08638 16.951 5.4874V4.58527C16.9509 3.98644 16.4647 3.50038 15.8659 3.50019H4.1341Z" fill="currentColor"></path><path d="M10 14.1V10.1M7.85 12.05L10 9.9L12.15 12.05" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"></path></svg>',
    };

    // Context-menu icons are rendered by the official menu through keyed
    // `contextMenu.icon` slot cells: an action must carry `{ key }`, not a
    // React element. We register our own keys with the official primitive
    // glyphs so every entry matches the official session/workspace menus.
    const MENU_ICON_CELLS = [
      ['tempTask.pin', 'IconPinOutlineRegular'],
      ['tempTask.unpin', 'IconPinFillRegular'],
      ['tempTask.rename', 'IconEditOutlineRegular'],
      ['tempTask.copy', 'IconCopyOutlineRegular'],
      ['tempTask.archive', 'IconArchiveOutlineRegular'],
      ['tempTask.unarchive', 'IconUnarchiveOutlineRegular'],
      ['tempTask.move', 'IconProjectAddOutlineRegular'],
      ['tempTask.remove', 'IconCloseOutlineRegular'],
      ['tempTask.delete', 'IconTrashOutlineRegular'],
    ];

    function menuIconRef(key) {
      return { key };
    }

    return {
      inject: ['locale', 'connection', 'uiWorkspace', 'contextMenus', 'workspaces', 'sessions', 'slots'],
      apply(ctx) {
        const t = ctx.locale.bind(NS);

        // UI text lives in `locale/<language>.json`. The Host reads those files
        // and serves them over RPC; we register the dictionaries before the
        // first paint so raw keys never reach the sidebar.
        // (loadLocales is declared below, next to the RPC helpers.)

        // Register one keyed `contextMenu.icon` cell per menu entry, using the
        // exact glyph components the official menus use.
        ctx.effect(() => {
          if (!primitives) return undefined;
          return ctx.slots.inject('contextMenu.icon', function* menuIcons() {
            for (const [key, name] of MENU_ICON_CELLS) {
              const Icon = primitives[name];
              if (!Icon) continue;
              try {
                yield ctx.slots.register({ name: 'contextMenu.icon', key }, Icon);
              } catch {
                // A key collision must not take the whole sidebar plugin down.
              }
            }
          });
        }, 'temp-task-zone: menu icons');

        const state = {
          disposed: false,
          localesReady: false,
          loading: false,
          loaded: false,
          tasks: [],
          byWorkspace: new Map(),
          sessionIds: new Set(),
          archived: new Set(),
          pinned: new Set(),
          pinOrder: new Map(),
          collapsed: readFlag('collapsed', false),
          orderBy: readPreference('order-by', ['manual', 'updated'], 'manual'),
          archivedFilter: readPreference('archived-filter', ['default', 'show', 'only'], 'default'),
          searchOpen: false,
          query: '',
          creating: false,
          moving: false,
          renaming: null,
          committing: false,
          zone: null,
          root: null,
          list: null,
          header: null,
          observer: null,
          viewRoot: null,
          viewComponent: null,
          raf: 0,
          applying: false,
          signature: '',
          toastTimer: 0,
          tipEl: null,
          tipAnchor: null,
          tipTimer: 0,
          heroNewTask: true,
          heroObserver: null,
          heroMenus: new Set(),
          protectSessionId: null,
          protectUntil: 0,
          sweepTimer: 0,
          sweeping: false,
          marquee: null,
        };

        const style = installStyles();

        // Load the JSON dictionaries before painting the sidebar.
        void loadLocales();

        // Follow DSH's language switch. `t()` reads the live locale snapshot on
        // every call, so a change only needs every DOM surface re-rendered: the
        // zone (head + rows + empty state), the view-options menu, and the row
        // injected into an open hero picker.
        ctx.effect(() => {
          if (typeof ctx.locale?.subscribe !== 'function') return undefined;
          const dispose = ctx.locale.subscribe(() => {
            if (state.disposed) return;
            try {
              dropTip();
              refreshHeroItems();
              refreshViewMenu();
              renderZone(true);
              scheduleSync();
            } catch {
              // The sidebar may be between renders during startup; the next
              // observer pass will repaint everything.
            }
          });
          return () => {
            try { dispose?.(); } catch {}
          };
        }, 'temp-task-zone: locale refresh');

        // ---- data -----------------------------------------------------------
        // Host failures carry a stable `temp-task/<code>`; translate it in the
        // current DSH language, falling back to the Host's own message.
        function localizedError(error) {
          const code = typeof error?.code === 'string' ? error.code : '';
          if (code.startsWith('temp-task/')) {
            const key = `err_${code.slice('temp-task/'.length).replace(/-/g, '_')}`;
            const text = t(key, error?.details ?? {});
            if (text !== key) return text;
          }
          return typeof error?.message === 'string' ? error.message : '';
        }

        async function call(method, payload) {
          const response = await ctx.connection.rpc.call(CHANNEL, method, payload ?? {});
          if (!response || response.ok !== true) {
            const error = response?.error ?? {};
            const message = localizedError(error);
            const failure = new Error(
              typeof message === 'string' && /不可用|unavailable|fetch|network/i.test(message)
                ? t('unavailable')
                : (message || t('unavailable')),
            );
            failure.code = error.code;
            failure.details = error.details;
            throw failure;
          }
          return response.value;
        }

        // The Host serves `locale/*.json` verbatim. Registering the whole map
        // lets DSH resolve the active language and fall back to English for
        // languages we have no file for.
        let localeRetries = 0;
        async function loadLocales() {
          try {
            const value = await call('getLocales');
            const dictionaries = {};
            if (value && typeof value === 'object') {
              for (const [language, dictionary] of Object.entries(value)) {
                if (dictionary && typeof dictionary === 'object') dictionaries[language] = dictionary;
              }
            }
            if (Object.keys(dictionaries).length === 0) throw new Error('no locale dictionaries');
            ctx.locale.register(NS, dictionaries);
            state.localesReady = true;
            renderZone(true);
            scheduleSync();
          } catch {
            // An older Host without `getLocales` must not paint raw keys; keep
            // retrying quietly until the restarted Host answers.
            if (state.disposed || localeRetries > 150) return;
            localeRetries += 1;
            window.setTimeout(() => { void loadLocales(); }, 1000);
          }
        }

        function setTasks(list) {
          state.tasks = Array.isArray(list) ? [...list] : [];
          state.byWorkspace = new Map();
          state.sessionIds = new Set();
          for (const task of state.tasks) {
            if (!task?.workspaceId) continue;
            state.byWorkspace.set(task.workspaceId, task);
            if (task.sessionId) state.sessionIds.add(task.sessionId);
          }
          state.tasks.sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
          state.loaded = true;
        }

        async function refresh() {
          if (state.disposed || state.loading) return;
          const firstLoad = !state.loaded;
          state.loading = true;
          try {
            const value = await call('list');
            setTasks(value?.tasks);
          } catch {
            // Keep the previous list; retry on the next tick.
          } finally {
            state.loading = false;
            sync();
            if (firstLoad && state.loaded) scheduleSweep();
          }
        }

        async function createTask() {
          if (state.creating || state.disposed) return false;
          state.creating = true;
          updateHead();
          try {
            const value = await call('create');
            const task = value?.task ?? value;
            if (task?.workspaceId) {
              setTasks([task, ...state.tasks.filter(item => item.workspaceId !== task.workspaceId)]);
              renderZone(true);
            }
            if (task?.sessionId) {
              protectSession(task.sessionId);
              await ctx.uiWorkspace.openSession(task.sessionId);
            }
            refresh();
            return true;
          } catch (error) {
            toast(error.message);
            return false;
          } finally {
            state.creating = false;
            updateHead();
          }
        }

        async function openTask(workspaceId) {
          if (state.renaming === workspaceId) return;
          try {
            const value = await call('open', { workspaceId });
            if (value?.sessionId) {
              protectSession(value.sessionId);
              await ctx.uiWorkspace.openSession(value.sessionId);
            }
            if (value?.task) state.byWorkspace.set(workspaceId, value.task);
            return true;
          } catch (error) {
            toast(error.message);
            return false;
          }
        }

        // ---- blank-session sweep -------------------------------------------
        // Official DSH keeps only the *current* blank Session; a new
        // conversation that never received a prompt disappears when the user
        // moves on. Mirror that for temporary tasks so abandoned empty rows and
        // directories do not pile up.
        function protectSession(sessionId) {
          if (typeof sessionId !== 'string' || sessionId.length === 0) return;
          state.protectSessionId = sessionId;
          // Protection ends as soon as the Session is observed as the current
          // main view; the deadline is only a fallback for a failed open.
          state.protectUntil = Date.now() + 10000;
        }

        function currentMainSessionId() {
          try {
            const snapshot = ctx.sessions?.list?.getSnapshot?.();
            const rows = snapshot?.byId ?? {};
            for (const row of Object.values(rows)) {
              // Session summaries are keyed by id; older builds may expose
              // sessionId instead, so accept both.
              const id = typeof row?.id === 'string' ? row.id : row?.sessionId;
              if (typeof id === 'string' && (row.retainedBy?.mainView ?? 0) > 0) return id;
            }
          } catch {}
          return null;
        }

        function isCurrentTask(task) {
          return Boolean(task?.sessionId) && currentMainSessionId() === task.sessionId;
        }

        function scheduleSweep() {
          if (state.disposed || state.sweepTimer) return;
          state.sweepTimer = window.setTimeout(() => {
            state.sweepTimer = 0;
            sweepBlankTasks();
          }, 0);
        }

        async function sweepBlankTasks() {
          if (state.disposed || state.creating || state.loaded !== true || state.sweeping) return;
          const currentSessionId = currentMainSessionId();
          if (!currentSessionId) return;
          // Once the just-opened Session is the current main view, it no longer
          // needs protecting: leaving it must discard it immediately.
          if (state.protectSessionId && currentSessionId === state.protectSessionId) {
            state.protectSessionId = null;
            state.protectUntil = 0;
          }
          const protecting = state.protectUntil > Date.now();
          const protectSessionId = protecting ? state.protectSessionId : null;
          state.sweeping = true;
          try {
            const value = await call('sweepBlank', { currentSessionId, protectSessionId });
            if (Array.isArray(value?.removed) && value.removed.length > 0) await refresh();
          } catch {
            // A failed sweep is retried on the next Session-list change.
          } finally {
            state.sweeping = false;
          }
          if (protecting) {
            // Re-check once the just-opened Session is no longer protected; a
            // task the user opened and immediately abandoned still gets swept.
            const wait = Math.max(200, state.protectUntil - Date.now() + 100);
            if (state.sweepTimer) window.clearTimeout(state.sweepTimer);
            state.sweepTimer = window.setTimeout(() => {
              state.sweepTimer = 0;
              sweepBlankTasks();
            }, wait);
          }
        }

        // ---- new-session integration ---------------------------------------
        // The Host setting decides whether the top "New session" button starts
        // a temporary task and whether the hero workspace picker gets an extra
        // row. Both are DOM-level integrations, so every step degrades silently
        // when the upstream markup is not found.
        function applySettings(value) {
          if (!value || typeof value !== 'object') return;
          if (typeof value.heroNewTask !== 'boolean') return;
          state.heroNewTask = value.heroNewTask;
          if (!state.heroNewTask) removeHeroItems();
        }

        const NEW_SESSION_LABELS = new Set([
          '新会话', '新建会话', 'new session',
          '新規セッション', 'nueva sesión', 'nouvelle séance', 'neue sitzung', 'новая сессия', 'nova sessão',
        ]);

        // Icon-based fallback: the label follows the DSH language, while the
        // new-chat sprite id does not.
        function hasNewChatIcon(button) {
          const use = button.querySelector('svg use');
          if (!use) return false;
          const href = use.getAttribute('href') || use.getAttribute('xlink:href') || '';
          return href.includes('new-chat');
        }

        function isNewSessionButton(button) {
          const label = (button.getAttribute('aria-label') || '').trim().toLowerCase();
          const byLabel = NEW_SESSION_LABELS.has(label);
          const byClass = /newSession/.test(button.className || '');
          if (!byLabel && !byClass && !hasNewChatIcon(button)) return false;
          if (button.closest('[role="menu"], [role="dialog"], [data-row-key]')) return false;
          return true;
        }

        function onDocumentClick(event) {
          try {
            if (state.disposed || state.creating || !state.heroNewTask) return;
            if (event.defaultPrevented) return;
            if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
            const target = event.target instanceof Element ? event.target : null;
            if (!target || target.closest('[data-copy-version]')) return;
            const button = target.closest('button[aria-label]');
            if (!button || !isNewSessionButton(button)) return;
            if (button.disabled || button.getAttribute('aria-disabled') === 'true') return;
            event.preventDefault();
            event.stopImmediatePropagation();
            void claimNewSession();
          } catch {
            // Never break the sidebar's own click handling.
          }
        }

        async function claimNewSession() {
          if (state.disposed || state.creating) return;
          const created = await createTask();
          if (!created && !state.disposed) {
            try { ctx.uiWorkspace.startSession?.(); } catch {}
          }
        }

        const HERO_ITEM = 'data-dsh-ttz-hero-item';
        const HERO_SEPARATOR = 'data-dsh-ttz-hero-separator';

        function createHeroSeparator() {
          const separator = document.createElement('div');
          separator.setAttribute(HERO_SEPARATOR, 'true');
          separator.className = 'dsh-ttz-hero-sep';
          separator.setAttribute('role', 'separator');
          return separator;
        }

        // The workspace picker is the only menu whose footer carries the
        // "add workspace" entry. Match every language DSH ships so the row is
        // injected regardless of the active locale.
        const ADD_WORKSPACE_HINTS = [
          '添加工作区', 'Add workspace', 'ワークスペースを追加',
          'Agregar espacio de trabajo', 'Ajouter un espace de travail',
          'Arbeitsbereich hinzufügen', 'Добавить рабочее пространство',
          'Adicionar espaço de trabalho',
        ];

        function isHeroPickerMenu(menu) {
          if (!menu?.querySelector) return false;
          if (!menu.querySelector('button[role="menuitem"]')) return false;
          const footer = menu.querySelector('[class*="footer"]');
          if (!footer) return false;
          const text = footer.textContent || '';
          return ADD_WORKSPACE_HINTS.some(hint => text.includes(hint));
        }

        function ensureHeroItem(menu) {
          if (!state.localesReady) return;
          try {
            if (state.disposed || !state.heroNewTask || !menu?.isConnected) return;
            if (menu.querySelector(`[${HERO_ITEM}]`)) return;
            if (!isHeroPickerMenu(menu)) return;
            const viewport = menu.querySelector('[role="presentation"]') || menu.querySelector('[class*="viewport"]');
            const sourceButton = viewport?.querySelector('button[role="menuitem"]');
            const sourceWrap = sourceButton?.parentElement;
            if (!viewport || !sourceWrap || sourceWrap === viewport) return;

            const clone = sourceWrap.cloneNode(true);
            const button = clone.querySelector('button[role="menuitem"]') || clone.querySelector('button');
            if (!button) return;
            clone.setAttribute(HERO_ITEM, 'true');
            button.setAttribute(HERO_ITEM, 'true');
            button.setAttribute('aria-label', t('newTask'));
            button.removeAttribute('aria-checked');
            button.removeAttribute('aria-selected');
            button.removeAttribute('aria-haspopup');

            // The source row may be the currently selected workspace: drop its
            // selected/check decoration so our row never claims that state.
            for (const node of [...clone.querySelectorAll('[class*="check"]')]) node.remove();
            for (const node of [button, ...clone.querySelectorAll('*')]) {
              for (const name of [...node.classList]) {
                if (/selected|check/i.test(name)) node.classList.remove(name);
              }
            }

            const label = button.querySelector('[class*="itemLabel"]') || [...button.querySelectorAll('span')].pop();
            if (label) label.textContent = t('newTask');
            const icon = button.querySelector('[class*="itemIcon"]');
            if (icon) icon.innerHTML = ICONS.folder;

            button.addEventListener('click', (event) => {
              event.preventDefault();
              event.stopPropagation();
              void claimNewSession();
            });

            // Only a divider above our row: the footer already draws its own
            // top border, so adding one below produced a double line.
            const beforeSeparator = createHeroSeparator();
            for (const node of viewport.querySelectorAll(`[${HERO_SEPARATOR}]`)) node.remove();
            viewport.appendChild(beforeSeparator);
            viewport.appendChild(clone);
            if (!menu.__dshTtzObserver) {
              const observer = new MutationObserver(() => {
                if (!menu.isConnected) { observer.disconnect(); state.heroMenus.delete(menu); return; }
                ensureHeroItem(menu);
              });
              observer.observe(menu, { childList: true, subtree: true });
              menu.__dshTtzObserver = observer;
            }
            state.heroMenus.add(menu);
          } catch {
            // Injection is best-effort only.
          }
        }

        function removeHeroItems() {
          for (const menu of [...state.heroMenus]) {
            try { menu.__dshTtzObserver?.disconnect(); } catch {}
            try { delete menu.__dshTtzObserver; } catch {}
          }
          state.heroMenus.clear();
          for (const node of document.querySelectorAll(`[${HERO_ITEM}], [${HERO_SEPARATOR}]`)) node.remove();
        }

        // Locale changes keep the menu node mounted; retitle the injected row
        // in place instead of waiting for the next open.
        function refreshHeroItems() {
          for (const button of document.querySelectorAll(`button[${HERO_ITEM}]`)) {
            button.setAttribute('aria-label', t('newTask'));
            const label = button.querySelector('[class*="itemLabel"]');
            if (label) label.textContent = t('newTask');
          }
        }

        function watchHeroMenus() {
          if (state.heroObserver || state.disposed || typeof MutationObserver !== 'function') return;
          state.heroObserver = new MutationObserver((records) => {
            for (const record of records) {
              for (const node of record.addedNodes) {
                if (!(node instanceof Element)) continue;
                const menus = node.matches('[role="menu"]') ? [node] : [...node.querySelectorAll('[role="menu"]')];
                for (const menu of menus) window.requestAnimationFrame(() => ensureHeroItem(menu));
              }
            }
          });
          state.heroObserver.observe(document.body, { childList: true });
        }

        async function removeTask(workspaceId, keepDirectory) {
          const question = keepDirectory ? t('confirmRemove') : t('confirmDelete');
          if (!window.confirm(question)) return;
          try {
            await call('delete', { workspaceId, keepDirectory });
            state.byWorkspace.delete(workspaceId);
            state.sessionIds.delete(state.tasks.find(task => task.workspaceId === workspaceId)?.sessionId);
            setTasks(state.tasks.filter(task => task.workspaceId !== workspaceId));
            renderZone(true);
            refresh();
          } catch (error) {
            toast(error.message);
          }
        }

        /**
         * Hand the task over to the regular workspace list. The Host keeps the
         * directory in place, re-registers it as a workspace and attaches the
         * conversation to it; here we only drop the row and refresh.
         */
        async function moveTask(task) {
          if (!task?.sessionId || state.moving || state.disposed) return;
          state.moving = true;
          try {
            const result = await call('moveToWorkspace', { workspaceId: task.workspaceId });
            state.byWorkspace.delete(task.workspaceId);
            state.sessionIds.delete(task.sessionId);
            setTasks(state.tasks.filter(entry => entry.workspaceId !== task.workspaceId));
            renderZone(true);
            const title = typeof result?.title === 'string' ? result.title.trim() : '';
            toast(title ? `${t('moved')}：${title}` : t('moved'));
            refresh();
          } catch (error) {
            toast(error.message);
          } finally {
            state.moving = false;
          }
        }

        // The sessions service exposes no `rename`; a Session face does
        // (`session.rename(title)`), reached by retaining one reference. The
        // reference source is only a bookkeeping label, so a plugin-owned one
        // keeps our counts separate from the controller and the gateway.
        const RENAME_SOURCE = 'temp-task';

        function canRename() {
          return typeof ctx.sessions?.using === 'function' || typeof ctx.sessions?.rename === 'function';
        }

        function renameSession(sessionId, title) {
          if (typeof ctx.sessions?.using === 'function') {
            return ctx.sessions.using(sessionId, { source: RENAME_SOURCE }, reference => reference.binding.session.rename(title));
          }
          return ctx.sessions.rename(sessionId, title);
        }

        function startRename(workspaceId) {
          const task = state.byWorkspace.get(workspaceId);
          if (!task?.sessionId || !canRename()) return;
          state.renaming = workspaceId;
          renderZone(true);
        }

        function cancelRename() {
          if (state.renaming === null) return;
          state.renaming = null;
          renderZone(true);
        }

        async function commitRename(workspaceId, rawTitle) {
          const title = String(rawTitle ?? '').trim();
          const task = state.byWorkspace.get(workspaceId);
          if (!task) { state.renaming = null; renderZone(true); return; }
          if (!title || !task.sessionId || title === displayTitle(task)) {
            state.renaming = null;
            renderZone(true);
            return;
          }
          if (state.committing) return;
          state.committing = true;
          try {
            // Rename the Session, not the workspace: the display label is the
            // Session title now, and an explicit user title pins it so the
            // automatic summarizer stops overwriting it.
            const result = await renameSession(task.sessionId, title);
            if (result && result.ok === false) {
              throw new Error(result.error?.message || t('failed'));
            }
          } catch (error) {
            toast(error?.message || t('failed'));
          } finally {
            state.committing = false;
            state.renaming = null;
            renderZone(true);
            scheduleSync();
          }
        }

        // ---- sidebar state --------------------------------------------------
        // The host is the single source of truth for pin/archive; read it from
        // the sidebar's workspace model on every render so changes made in the
        // official UI (or by our own actions) stay reflected.
        function readSidebarState() {
          let snapshot;
          try { snapshot = ctx.workspaces?.list?.getSnapshot?.(); } catch { snapshot = undefined; }
          const archived = Array.isArray(snapshot?.archivedSessionIds) ? snapshot.archivedSessionIds : [];
          const pinned = Array.isArray(snapshot?.pinnedSessionIds) ? snapshot.pinnedSessionIds : [];
          state.archived = new Set(archived);
          state.pinned = new Set(pinned);
          state.pinOrder = new Map(pinned.map((id, index) => [id, index]));
        }

        function isArchived(task) {
          return Boolean(task?.sessionId && state.archived.has(task.sessionId));
        }

        function isPinned(task) {
          return Boolean(task?.sessionId && state.pinned.has(task.sessionId));
        }

        function pinRank(task) {
          return state.pinOrder.has(task.sessionId) ? state.pinOrder.get(task.sessionId) : Number.MAX_SAFE_INTEGER;
        }

        // Row labels follow the Session's own title — the same auto-summarized
        // projection the official session rows show — falling back to the
        // workspace title while the session has no title yet (blank or fresh).
        function sessionTitleOf(task) {
          if (!task?.sessionId) return '';
          try {
            const row = ctx.sessions?.list?.getSnapshot?.()?.byId?.[task.sessionId];
            if (!row || row.blank) return '';
            return typeof row.title === 'string' ? row.title.trim() : '';
          } catch {
            return '';
          }
        }

        function displayTitle(task) {
          return sessionTitleOf(task) || task?.title || '';
        }

        function sessionUpdatedAt(task) {
          try {
            const row = ctx.sessions?.list?.getSnapshot?.()?.byId?.[task.sessionId];
            const value = Number(row?.updatedAt);
            if (Number.isFinite(value) && value > 0) return value;
          } catch {}
          const created = Date.parse(String(task?.createdAt ?? ''));
          return Number.isFinite(created) ? created : 0;
        }

        function matchesFilter(task) {
          const archived = isArchived(task);
          if (state.archivedFilter === 'only') return archived;
          if (state.archivedFilter === 'show') return true;
          return !archived;
        }

        function matchesQuery(task) {
          const query = state.query.trim().toLowerCase();
          if (!query) return true;
          return displayTitle(task).toLowerCase().includes(query)
            || String(task?.title ?? '').toLowerCase().includes(query);
        }

        // Ordering mirrors the workspace view options: pinned members lead,
        // then either the manual order (newest first, what drag order means
        // for us) or the session's own last-updated stamp.
        function visibleTasks() {
          return state.tasks
            .filter(task => matchesFilter(task) && matchesQuery(task))
            .sort((a, b) => {
              const rankA = pinRank(a);
              const rankB = pinRank(b);
              if (rankA !== rankB) return rankA - rankB;
              if (state.orderBy === 'updated') return sessionUpdatedAt(b) - sessionUpdatedAt(a);
              return String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''));
            });
        }

        async function togglePin(task) {
          if (!task?.sessionId || typeof ctx.uiWorkspace?.pinSession !== 'function') return;
          try {
            if (isPinned(task)) await ctx.uiWorkspace.unpinSession(task.sessionId);
            else await ctx.uiWorkspace.pinSession(task.sessionId);
            readSidebarState();
            renderZone(true);
          } catch (error) {
            toast(error?.message || t('failed'));
          }
        }

        async function toggleArchive(task) {
          if (!task?.sessionId || typeof ctx.uiWorkspace?.archiveSession !== 'function') return;
          try {
            if (isArchived(task)) await ctx.uiWorkspace.unarchiveSession(task.sessionId);
            else await ctx.uiWorkspace.archiveSession(task.sessionId);
            readSidebarState();
            renderZone(true);
          } catch (error) {
            toast(error?.message || t('failed'));
          }
        }

        async function copySessionId(task) {
          if (!task?.sessionId) return;
          try {
            await navigator.clipboard.writeText(task.sessionId);
            toast(t('copied'));
          } catch {
            toast(t('failed'));
          }
        }

        // ---- DOM injection --------------------------------------------------
        // The sidebar renders: <root> <sectionHeader/> <listArea>…<tree list/>… </root>.
        // We mount the temporary-task zone as a sibling *above* the workspace
        // section header, so it reads as its own area next to "工作区", and we
        // hide the official rows/sections that belong to temporary tasks.
        function locate() {
          const row = document.querySelector('[data-row-key^="workspace:"], [data-row-key^="session:"]');
          if (!row) return null;
          const list = row.closest('[role="tree"]');
          if (!list) return null;
          let el = list.parentElement;
          for (let depth = 0; el && el !== document.body && depth < 8; depth += 1, el = el.parentElement) {
            const header = el.querySelector(':scope > [class*="sectionHeader"]');
            if (header) return { root: el, header, list };
          }
          return null;
        }

        function modeOf(root) {
          const cls = String(root?.className || '');
          const listCls = String(state.list?.className || '');
          if (/rail/.test(cls)) return 'rail';
          if (listCls.includes('searchTree')) return 'search';
          if (listCls.includes('flatList')) return 'flat';
          return 'grouped';
        }

        function ensureZone(root) {
          const existing = state.zone;
          if (existing && existing.isConnected && existing.parentElement === root) {
            // React may re-insert its own children ahead of our node; keep the
            // zone pinned as the first child so it stays above "工作区".
            if (root.firstElementChild !== existing) root.insertBefore(existing, root.firstElementChild);
            return existing;
          }
          if (existing) { discardViewRoot(); existing.remove(); }

          const zone = document.createElement('div');
          zone.className = 'dsh-ttz-zone';
          zone.setAttribute('data-dsh-temp-zone', 'zone');
          zone.innerHTML = [
            '<div class="dsh-ttz-head">',
            '  <span class="dsh-ttz-label"></span>',
            '  <button type="button" class="dsh-ttz-toggle" aria-expanded="true">',
            `    <span class="dsh-ttz-chevron" aria-hidden="true">${ICONS.triangle}</span>`,
            '  </button>',
            '  <div class="dsh-ttz-searchslot">',
            '    <button type="button" class="dsh-ttz-headbtn dsh-ttz-searchbtn">',
            `      ${ICONS.search}`,
            '    </button>',
            '    <div class="dsh-ttz-searchbox">',
            `      <span class="dsh-ttz-searchicon" aria-hidden="true">${ICONS.searchSmall}</span>`,
            '      <input type="text" class="dsh-ttz-searchinput" spellcheck="false" autocomplete="off" />',
            '      <button type="button" class="dsh-ttz-clear">',
            `        ${ICONS.clear}`,
            '      </button>',
            '    </div>',
            '  </div>',
            '  <div class="dsh-ttz-headactions">',
            '    <span class="dsh-ttz-viewslot"></span>',
            '    <button type="button" class="dsh-ttz-headbtn dsh-ttz-add">',
            `      ${ICONS.plus}`,
            '    </button>',
            '  </div>',
            '</div>',
            '<div class="dsh-ttz-rows"></div>',
          ].join('');
          root.insertBefore(zone, root.firstElementChild);
          state.zone = zone;
          bindZone(zone);
          mountViewMenu(zone.querySelector('.dsh-ttz-viewslot'));
          state.signature = '';
          renderZone(true);
          return zone;
        }

        function openRowMenu(workspaceId, x, y) {
          if (!state.byWorkspace.has(workspaceId)) return;
          ctx.contextMenus.open(
            { kind: 'temp-task', value: { workspaceId } },
            { x, y },
          );
        }

        // ---- view options ---------------------------------------------------
        // The header's ⋯-style view menu must be the official primitives Menu
        // (label rows, radio checks, dense spacing), so a tiny React root is
        // mounted just for [sliders button + menu]; every other header node
        // stays plain DOM. Without react-dom the button degrades away.
        function filterOptionId(value) {
          return { default: 'hide-archived', show: 'show-archived', only: 'only-archived' }[value]
            ?? 'hide-archived';
        }

        function createViewOptions() {
          const {
            Menu, Tooltip, IconSlidersTwoOutlineRegular,
            IconChevronsUpDownOutlineRegular, IconClockOutlineRegular,
            IconArchiveOffOutlineRegular, IconQueueOutlineRegular,
            IconArchiveCheckOutlineRegular,
          } = primitives ?? {};
          if (!React || !Menu || !Tooltip || !IconSlidersTwoOutlineRegular) return null;

          return function ViewOptionsMenu() {
            const [open, setOpen] = React.useState(false);
            return h(Menu, {
              open,
              onClose: () => { setOpen(false); },
              items: [
                { type: 'label', id: 'order-by', text: t('filterOrderBy') },
                { id: 'manual', label: t('orderManual'), icon: h(IconChevronsUpDownOutlineRegular) },
                { id: 'updated', label: t('orderUpdated'), icon: h(IconClockOutlineRegular) },
                { type: 'separator', id: 'archived-filter-separator' },
                { type: 'label', id: 'filter-by', text: t('filterBy') },
                { id: 'hide-archived', label: t('filterHideArchived'), icon: h(IconArchiveOffOutlineRegular) },
                { id: 'show-archived', label: t('filterShowArchived'), icon: h(IconQueueOutlineRegular) },
                { id: 'only-archived', label: t('filterOnlyArchived'), icon: h(IconArchiveCheckOutlineRegular) },
              ],
              selectedIds: [state.orderBy, filterOptionId(state.archivedFilter)],
              onSelect: (id) => { setOpen(false); pickViewOption(id); },
              align: 'end',
              dense: true,
              portal: true,
              listClassName: 'dsh-ttz-viewmenu',
              anchor: h(Tooltip, {
                label: t('viewOptions'),
                side: 'bottom',
                delayMs: 500,
                portal: true,
              }, h('button', {
                type: 'button',
                className: 'dsh-ttz-headbtn dsh-ttz-viewbtn',
                'aria-label': t('viewOptions'),
                onClick: () => setOpen(value => !value),
              }, h(IconSlidersTwoOutlineRegular, {}))),
            });
          };
        }

        function mountViewMenu(container) {
          discardViewRoot();
          if (!container) return;
          const component = createViewOptions();
          if (!component || typeof ReactDOM?.createRoot !== 'function') return;
          try {
            const root = ReactDOM.createRoot(container);
            root.render(h(component));
            state.viewRoot = root;
            state.viewComponent = component;
          } catch {
            state.viewRoot = null;
            state.viewComponent = null;
          }
        }

        function refreshViewMenu() {
          if (!state.viewRoot || !state.viewComponent) return;
          try { state.viewRoot.render(h(state.viewComponent)); } catch {}
        }

        function discardViewRoot() {
          const root = state.viewRoot;
          state.viewRoot = null;
          state.viewComponent = null;
          if (root) {
            try { root.unmount(); } catch {}
          }
        }

        function pickViewOption(id) {
          if (id === 'manual' || id === 'updated') {
            if (state.orderBy === id) return;
            state.orderBy = id;
            writePreference('order-by', id);
          } else {
            const next = {
              'hide-archived': 'default',
              'show-archived': 'show',
              'only-archived': 'only',
            }[id];
            if (!next || state.archivedFilter === next) return;
            state.archivedFilter = next;
            writePreference('archived-filter', next);
          }
          renderZone(true);
          refreshViewMenu();
        }

        function openSearch() {
          state.searchOpen = true;
          renderZone(true);
          const input = state.zone?.querySelector('.dsh-ttz-searchinput');
          if (input) {
            input.focus();
            input.select?.();
          }
        }

        function closeSearch() {
          state.searchOpen = false;
          state.query = '';
          const input = state.zone?.querySelector('.dsh-ttz-searchinput');
          if (input) input.value = '';
          renderZone(true);
        }

        function bindZone(zone) {
          zone.addEventListener('click', event => {
            const target = event.target;
            if (!(target instanceof Element)) return;
            const add = target.closest('.dsh-ttz-add');
            if (add) {
              event.preventDefault();
              event.stopPropagation();
              createTask();
              return;
            }
            const toggle = target.closest('.dsh-ttz-toggle');
            if (toggle) {
              event.preventDefault();
              event.stopPropagation();
              state.collapsed = !state.collapsed;
              writeFlag('collapsed', state.collapsed);
              renderZone(true);
              return;
            }
            const searchButton = target.closest('.dsh-ttz-searchbtn');
            if (searchButton) {
              event.preventDefault();
              event.stopPropagation();
              if (state.searchOpen) closeSearch();
              else openSearch();
              return;
            }
            const clearButton = target.closest('.dsh-ttz-clear');
            if (clearButton) {
              event.preventDefault();
              event.stopPropagation();
              closeSearch();
              return;
            }
            const archiveButton = target.closest('.dsh-ttz-archive');
            if (archiveButton) {
              event.preventDefault();
              event.stopPropagation();
              const row = archiveButton.closest('.dsh-ttz-row');
              const task = row && state.byWorkspace.get(row.dataset.workspaceId);
              if (task) toggleArchive(task);
              return;
            }
            const pinButton = target.closest('.dsh-ttz-pin');
            if (pinButton) {
              event.preventDefault();
              event.stopPropagation();
              const row = pinButton.closest('.dsh-ttz-row');
              const task = row && state.byWorkspace.get(row.dataset.workspaceId);
              if (task) togglePin(task);
              return;
            }
            const menuButton = target.closest('.dsh-ttz-menu');
            if (menuButton) {
              event.preventDefault();
              event.stopPropagation();
              const row = menuButton.closest('.dsh-ttz-row');
              const rect = menuButton.getBoundingClientRect();
              if (row) openRowMenu(row.dataset.workspaceId, rect.left, rect.bottom + 4);
              return;
            }
            const row = target.closest('.dsh-ttz-row');
            if (!row || row.dataset.editing === '1') return;
            event.preventDefault();
            const workspaceId = row.dataset.workspaceId;
            if (workspaceId) openTask(workspaceId);
          });

          zone.addEventListener('pointerover', onRowPointerOver);
          zone.addEventListener('pointerout', onRowPointerOut);

          zone.addEventListener('contextmenu', event => {
            const target = event.target;
            if (!(target instanceof Element)) return;
            if (target.closest('.dsh-ttz-rename')) return;
            const row = target.closest('.dsh-ttz-row');
            if (!row || row.dataset.editing === '1') return;
            const workspaceId = row.dataset.workspaceId;
            if (!workspaceId) return;
            event.preventDefault();
            event.stopPropagation();
            openRowMenu(workspaceId, event.clientX, event.clientY);
          });

          zone.addEventListener('input', event => {
            const target = event.target;
            if (!(target instanceof HTMLInputElement) || !target.classList.contains('dsh-ttz-searchinput')) return;
            state.query = target.value;
            renderZone(true);
          });

          zone.addEventListener('keydown', event => {
            const target = event.target;
            if (target instanceof HTMLInputElement) {
              if (target.classList.contains('dsh-ttz-searchinput')) {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  closeSearch();
                }
                return;
              }
              if (!target.classList.contains('dsh-ttz-rename')) return;
              if (event.key === 'Enter') {
                event.preventDefault();
                commitRename(target.dataset.workspaceId, target.value);
              } else if (event.key === 'Escape') {
                event.preventDefault();
                cancelRename();
              }
              return;
            }
            if (!(target instanceof Element) || !target.classList.contains('dsh-ttz-row')) return;
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              const workspaceId = target.dataset.workspaceId;
              if (workspaceId) openTask(workspaceId);
            }
          });

          zone.addEventListener('blur', event => {
            const target = event.target;
            if (!(target instanceof HTMLInputElement) || !target.classList.contains('dsh-ttz-rename')) return;
            cursorRename(target);
          }, true);
        }

        function cursorRename(input) {
          // Blur means the user clicked elsewhere: drop the edit, unless a commit
          // is already in flight (in which case the input is being torn down).
          if (state.committing) return;
          if (state.renaming !== input.dataset.workspaceId) return;
          state.renaming = null;
          renderZone(true);
        }

        // Session rows marquee their clipped title while hovered. Our rows are
        // plain DOM, so the same behaviour is reproduced with the official
        // constants: crawl right at 0.03px/ms once hovered, fade the clipped
        // edge, and jump back to the start in one step on leave.
        const MIN_TITLE_REVEAL_PX = 8;
        const TITLE_MARQUEE_PX_PER_MS = 0.03;

        function placeTitle(title, left, range) {
          if (typeof title.scrollTo === 'function') title.scrollTo({ left, behavior: 'instant' });
          else title.scrollLeft = left;
          if (left > 0) title.dataset.scrolled = '';
          else delete title.dataset.scrolled;
          if (left < range) title.dataset.clipped = '';
          else delete title.dataset.clipped;
        }

        function restTitle(title) {
          if (!title) return;
          if (typeof title.scrollTo === 'function') title.scrollTo({ left: 0, behavior: 'instant' });
          else title.scrollLeft = 0;
          delete title.dataset.scrolled;
          delete title.dataset.clipped;
        }

        function stopTitleMarquee() {
          const current = state.marquee;
          if (!current) return;
          if (current.frame) cancelAnimationFrame(current.frame);
          state.marquee = null;
          if (current.label?.isConnected) restTitle(current.label);
        }

        function startTitleMarquee(row) {
          const label = row?.querySelector('.dsh-ttz-row-label');
          if (!label) return;
          const range = label.scrollWidth - label.clientWidth;
          if (range <= MIN_TITLE_REVEAL_PX) return;
          const marquee = { label, frame: 0, position: 0, previous: 0, range };
          state.marquee = marquee;
          if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
            placeTitle(label, range, range);
            return;
          }
          const step = now => {
            if (state.marquee !== marquee || !label.isConnected) return;
            if (marquee.previous > 0) {
              marquee.position += (now - marquee.previous) * TITLE_MARQUEE_PX_PER_MS;
            }
            marquee.previous = now;
            marquee.position = Math.min(marquee.position, marquee.range);
            placeTitle(label, marquee.position, marquee.range);
            if (marquee.position < marquee.range) marquee.frame = requestAnimationFrame(step);
          };
          marquee.frame = requestAnimationFrame(step);
        }

        function onRowPointerOver(event) {
          if (event.pointerType === 'touch') return;
          const target = event.target;
          if (!(target instanceof Element)) return;
          const row = target.closest('.dsh-ttz-row');
          if (!row) return;
          if (state.marquee?.label && row.contains(state.marquee.label)) return;
          stopTitleMarquee();
          startTitleMarquee(row);
        }

        function onRowPointerOut(event) {
          const target = event.target;
          if (!(target instanceof Element)) return;
          const row = target.closest('.dsh-ttz-row');
          if (!row) return;
          const next = event.relatedTarget;
          if (next instanceof Node && row.contains(next)) return;
          stopTitleMarquee();
        }

        function updateHead() {
          const zone = state.zone;
          if (!zone) return;
          zone.classList.toggle('is-collapsed', state.collapsed);
          const head = zone.querySelector('.dsh-ttz-head');
          if (head) head.classList.toggle('is-searching', state.searchOpen);
          const label = zone.querySelector('.dsh-ttz-label');
          if (label) {
            const labelText = t('title');
            if (label.textContent !== labelText) label.textContent = labelText;
          }
          const toggle = zone.querySelector('.dsh-ttz-toggle');
          const add = zone.querySelector('.dsh-ttz-add');
          const searchButton = zone.querySelector('.dsh-ttz-searchbtn');
          const searchInput = zone.querySelector('.dsh-ttz-searchinput');
          const clearButton = zone.querySelector('.dsh-ttz-clear');
          if (toggle) {
            toggle.setAttribute('aria-expanded', state.collapsed ? 'false' : 'true');
            toggle.setAttribute('aria-label', state.collapsed ? t('expand') : t('collapse'));
            toggle.removeAttribute('title');
          }
          if (searchButton) {
            const iconKey = state.searchOpen ? 'small' : 'normal';
            if (searchButton.dataset.icon !== iconKey) {
              searchButton.dataset.icon = iconKey;
              searchButton.innerHTML = state.searchOpen ? ICONS.searchSmall : ICONS.search;
            }
            searchButton.setAttribute('aria-label', t('search'));
            searchButton.setAttribute('aria-expanded', state.searchOpen ? 'true' : 'false');
            searchButton.removeAttribute('title');
          }
          if (searchInput) {
            searchInput.placeholder = t('searchPlaceholder');
            searchInput.setAttribute('aria-label', t('searchPlaceholder'));
          }
          if (clearButton) {
            clearButton.setAttribute('aria-label', t('searchClear'));
            clearButton.removeAttribute('title');
          }
          if (add) {
            add.disabled = state.creating;
            add.setAttribute('aria-label', state.creating ? t('creating') : t('newTask'));
            add.removeAttribute('title');
          }
        }

        function iconNode(markup, className) {
          const span = document.createElement('span');
          span.className = className;
          span.setAttribute('aria-hidden', 'true');
          span.innerHTML = markup;
          return span;
        }

        function buildRow(task) {
          const archived = isArchived(task);
          const pinned = isPinned(task);
          const editing = state.renaming === task.workspaceId;
          const active = isCurrentTask(task);
          const row = document.createElement('div');
          row.className = 'dsh-ttz-row';
          if (archived) row.classList.add('is-archived');
          if (editing) row.classList.add('is-editing');
          if (active) row.classList.add('is-active');
          row.dataset.workspaceId = task.workspaceId;
          row.setAttribute('role', 'button');
          row.tabIndex = 0;
          if (!editing) {
            row.title = displayTitle(task);
            row.setAttribute('aria-label', displayTitle(task));
          }
          row.append(iconNode(active ? ICONS.folderOpen : ICONS.folder, 'dsh-ttz-row-icon'));

          if (editing) {
            row.dataset.editing = '1';
            const input = document.createElement('input');
            input.className = 'dsh-ttz-rename';
            input.type = 'text';
            input.value = displayTitle(task);
            input.dataset.workspaceId = task.workspaceId;
            input.setAttribute('aria-label', t('menuRename'));
            input.spellcheck = false;
            row.append(input);
            window.setTimeout(() => {
              if (!input.isConnected || state.renaming !== task.workspaceId) return;
              input.focus();
              input.select();
            }, 0);
            return row;
          }

          const label = document.createElement('span');
          label.className = 'dsh-ttz-row-label';
          label.textContent = displayTitle(task);
          row.append(label);

          if (pinned) {
            const badge = iconNode(ICONS.pinFill, 'dsh-ttz-pin-badge');
            badge.title = t('pinnedBadge');
            row.append(badge);
          }

          const actions = document.createElement('span');
          actions.className = 'dsh-ttz-actions';

          const menuButton = document.createElement('button');
          menuButton.type = 'button';
          menuButton.className = 'dsh-ttz-action dsh-ttz-menu';
          menuButton.title = t('more');
          menuButton.setAttribute('aria-label', menuButton.title);
          menuButton.innerHTML = ICONS.ellipsis;
          actions.append(menuButton);

          if (task.sessionId) {
            const archiveButton = document.createElement('button');
            archiveButton.type = 'button';
            archiveButton.className = 'dsh-ttz-action dsh-ttz-archive';
            archiveButton.title = archived ? t('menuUnarchive') : t('menuArchive');
            archiveButton.setAttribute('aria-label', archiveButton.title);
            archiveButton.innerHTML = archived ? ICONS.unarchive14 : ICONS.archive14;
            actions.append(archiveButton);
          }

          if (!archived) {
            const pinButton = document.createElement('button');
            pinButton.type = 'button';
            pinButton.className = 'dsh-ttz-action dsh-ttz-pin';
            pinButton.title = pinned ? t('unpin') : t('pin');
            pinButton.setAttribute('aria-label', pinButton.title);
            pinButton.innerHTML = pinned ? ICONS.pinFill14 : ICONS.pin14;
            actions.append(pinButton);
          }
          row.append(actions);
          return row;
        }

        function renderZone(force) {
          if (!state.localesReady) return;
          const zone = state.zone;
          if (!zone) return;
          readSidebarState();
          updateHead();
          const rows = zone.querySelector('.dsh-ttz-rows');
          if (!rows) return;
          rows.style.display = state.collapsed ? 'none' : '';

          const tasks = visibleTasks();
          const signature = state.tasks
            .map(task => `${task.workspaceId}\u0000${displayTitle(task)}\u0000${isArchived(task) ? 1 : 0}\u0000${isPinned(task) ? 1 : 0}\u0000${isCurrentTask(task) ? 1 : 0}`)
            .join('\u0001')
            + `\u0002${state.renaming ?? ''}\u0002${state.orderBy}\u0002${state.archivedFilter}\u0002${state.query}`;
          if (!force && signature === state.signature) return;
          state.signature = signature;
          stopTitleMarquee();

          if (tasks.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'dsh-ttz-empty';
            empty.textContent = state.tasks.length === 0
              ? t('empty')
              : state.query.trim() ? t('noMatches') : t('emptyFiltered');
            rows.replaceChildren(empty);
            return;
          }

          rows.replaceChildren(...tasks.map(buildRow));
        }

        function markHidden(element) {
          if (!element) return;
          element.style.display = 'none';
          element.setAttribute('data-dsh-ttz-hidden', '1');
        }

        function clearHidden() {
          if (!state.list) return;
          for (const element of state.list.querySelectorAll('[data-dsh-ttz-hidden]')) {
            element.style.display = '';
            element.removeAttribute('data-dsh-ttz-hidden');
          }
        }

        function applyHiding(mode) {
          if (!state.list) return;
          clearHidden();
          if (mode !== 'grouped' && mode !== 'flat') return;

          if (mode === 'grouped') {
            for (const row of state.list.querySelectorAll('[data-row-key^="workspace:"]')) {
              const workspaceId = row.getAttribute('data-row-key').slice('workspace:'.length);
              if (!state.byWorkspace.has(workspaceId)) continue;
              markHidden(row.closest('[class*="groupSection"]') || row.parentElement);
            }
          }
          for (const row of state.list.querySelectorAll('[data-row-key^="session:"]')) {
            const sessionId = row.getAttribute('data-row-key').slice('session:'.length);
            if (!state.sessionIds.has(sessionId)) continue;
            markHidden(row.closest('[class*="groupSection"]') || row);
          }
        }

        function attachObserver(root) {
          if (state.observer) state.observer.disconnect();
          state.observer = new MutationObserver(() => {
            if (state.applying || state.disposed) return;
            scheduleSync();
          });
          state.observer.observe(root, { childList: true, subtree: true });
        }

        function teardownDom() {
          stopTitleMarquee();
          if (state.observer) { state.observer.disconnect(); state.observer = null; }
          clearHidden();
          discardViewRoot();
          if (state.zone?.isConnected) state.zone.remove();
          state.zone = null;
          state.root = null;
          state.list = null;
          state.header = null;
          state.signature = '';
        }

        // The zone and the official header share a column, but React may place
        // them in containers whose right padding differs by a few pixels. Rather
        // than trusting the stylesheet math, measure the official action cluster
        // and nudge the zone header so both rows of buttons end at the same x.
        function alignHead(zone) {
          const head = zone?.querySelector?.('.dsh-ttz-head');
          if (!head) return;
          const official = state.header;
          if (!official || !official.isConnected) {
            head.style.marginRight = '';
            delete head.dataset.alignMargin;
            return;
          }
          const actions = zone.querySelector('.dsh-ttz-headactions');
          const mine = actions?.lastElementChild || head;
          const theirs = official.querySelector('[class*="headerActions"]')?.lastElementChild || official;
          const delta = theirs.getBoundingClientRect().right - mine.getBoundingClientRect().right;
          if (!Number.isFinite(delta) || Math.abs(delta) > 24) return;
          const current = head.dataset.alignMargin !== undefined ? Number(head.dataset.alignMargin) : -4;
          const next = current - delta;
          if (Math.abs(next - current) < 0.5) return;
          head.dataset.alignMargin = String(next);
          head.style.marginRight = `${next}px`;
        }

        function sync() {
          if (state.disposed || !state.localesReady) return;
          const found = locate();
          if (!found) { teardownDom(); return; }
          state.applying = true;
          try {
            if (found.root !== state.root) {
              teardownDom();
              state.root = found.root;
              attachObserver(found.root);
            }
            state.list = found.list;
            state.header = found.header;
            const zone = ensureZone(found.root);
            const mode = modeOf(found.root);
            if (mode === 'rail' || mode === 'search') {
              zone.style.display = 'none';
              clearHidden();
            } else {
              zone.style.display = '';
              applyHiding(mode);
            }
            renderZone();
            alignHead(zone);
          } finally {
            state.applying = false;
            state.observer?.takeRecords();
          }
        }

        function scheduleSync() {
          if (state.raf || state.disposed) return;
          state.raf = window.requestAnimationFrame(() => {
            state.raf = 0;
            sync();
          });
        }

        // ---- toast ----------------------------------------------------------
        function toast(message) {
          if (!message || state.disposed) return;
          let node = document.querySelector('.dsh-ttz-toast');
          if (!node) {
            node = document.createElement('div');
            node.className = 'dsh-ttz-toast';
            node.setAttribute('role', 'status');
            document.body.appendChild(node);
          }
          node.textContent = message;
          node.classList.add('dsh-ttz-toast-visible');
          clearTimeout(state.toastTimer);
          state.toastTimer = window.setTimeout(() => node.classList.remove('dsh-ttz-toast-visible'), 4000);
        }

        // ---- tooltips -------------------------------------------------------
        // The shell Tooltip renders a fixed bubble 500ms after hover, 8px under
        // the anchor, using the tooltip surface. Our header is plain DOM, so
        // mirror that bubble by hand; the browser's native title tooltip looks
        // and behaves nothing like it.
        const TIP_DELAY = 500;
        const TIP_TARGETS = '.dsh-ttz-toggle,.dsh-ttz-searchbtn,.dsh-ttz-add,[data-dsh-ttz-tip]';

        function tipTarget(node) {
          const button = node && node.closest ? node.closest(TIP_TARGETS) : null;
          if (!button) return null;
          if (button.hasAttribute('data-dsh-ttz-tip')) return button;
          return button.closest('.dsh-ttz-head') ? button : null;
        }

        function tipText(button) {
          if (!button || button.disabled) return '';
          const carried = button.getAttribute('data-dsh-ttz-tip');
          if (carried) return carried;
          if (button.classList.contains('dsh-ttz-add')) return t('newTask');
          if (button.classList.contains('dsh-ttz-searchbtn')) return state.searchOpen ? '' : t('searchTip');
          return state.collapsed ? t('expand') : t('collapse');
        }

        function dropTip() {
          if (state.tipTimer) { window.clearTimeout(state.tipTimer); state.tipTimer = 0; }
          if (state.tipEl) { state.tipEl.remove(); state.tipEl = null; }
          state.tipAnchor = null;
        }

        function showTip(button) {
          const text = tipText(button);
          if (!text || state.disposed) return;
          dropTip();
          const tip = document.createElement('span');
          tip.className = 'dsh-ttz-tip';
          tip.dataset.side = 'bottom';
          tip.textContent = text;
          document.body.appendChild(tip);
          const rect = button.getBoundingClientRect();
          tip.style.left = `${rect.left + rect.width / 2}px`;
          tip.style.top = `${rect.bottom + 8}px`;
          state.tipEl = tip;
          state.tipAnchor = button;
        }

        function onTipOver(event) {
          const button = tipTarget(event.target);
          if (!button) return;
          if (event.relatedTarget && button.contains(event.relatedTarget)) return;
          if (state.tipTimer) { window.clearTimeout(state.tipTimer); state.tipTimer = 0; }
          const delay = state.tipAnchor === button || button.hasAttribute('data-dsh-ttz-tip') ? 0 : TIP_DELAY;
          state.tipTimer = window.setTimeout(() => {
            state.tipTimer = 0;
            if (state.disposed) return;
            if (button.isConnected) showTip(button);
          }, delay);
        }

        function onTipOut(event) {
          const button = tipTarget(event.target);
          if (!button) return;
          if (event.relatedTarget && button.contains(event.relatedTarget)) return;
          dropTip();
        }

        function onTipKeydown(event) {
          if (event.key === 'Escape') dropTip();
        }

        // ---- menus ----------------------------------------------------------
        ctx.effect(() => ctx.contextMenus.register({
          id: 'tempTask.row',
          target: 'temp-task',
          order: 100,
          resolve: value => {
            const task = value && state.byWorkspace.get(value.workspaceId);
            if (!task) return [];
            const archived = isArchived(task);
            const pinned = isPinned(task);
            const items = [];
            if (task.sessionId && !archived && typeof ctx.uiWorkspace?.pinSession === 'function') {
              items.push({
                id: 'pin',
                label: pinned ? t('menuUnpin') : t('menuPin'),
                icon: menuIconRef(pinned ? 'tempTask.unpin' : 'tempTask.pin'),
                run: () => { void togglePin(task); },
              });
            }
            if (task.sessionId && canRename()) {
              items.push({
                id: 'rename',
                label: t('menuRename'),
                icon: menuIconRef('tempTask.rename'),
                run: () => {
                  // Let the menu finish closing (it restores focus on close)
                  // before the row swaps into its inline editor.
                  window.setTimeout(() => { startRename(task.workspaceId); }, 200);
                },
              });
            }
            if (task.sessionId) {
              items.push({
                id: 'copyId',
                label: t('menuCopyId'),
                icon: menuIconRef('tempTask.copy'),
                run: () => { void copySessionId(task); },
              });
            }
            if (task.sessionId && typeof ctx.uiWorkspace?.archiveSession === 'function') {
              items.push({
                id: 'archive',
                label: archived ? t('menuUnarchive') : t('menuArchive'),
                icon: menuIconRef(archived ? 'tempTask.unarchive' : 'tempTask.archive'),
                separatorBefore: true,
                run: () => { void toggleArchive(task); },
              });
            }
            if (task.sessionId) {
              items.push({
                id: 'move',
                label: t('menuMove'),
                icon: menuIconRef('tempTask.move'),
                run: () => { void moveTask(task); },
              });
            }
            items.push({
              id: 'remove',
              label: t('menuRemove'),
              icon: menuIconRef('tempTask.remove'),
              separatorBefore: true,
              run: () => { void removeTask(task.workspaceId, true); },
            });
            items.push({
              id: 'delete',
              label: t('menuDelete'),
              icon: menuIconRef('tempTask.delete'),
              danger: true,
              separatorBefore: true,
              run: () => { void removeTask(task.workspaceId, false); },
            });
            return items;
          },
        }), 'temp-task-zone: row menu');

        // ---- settings page --------------------------------------------------
        // Shown both as a section of the Settings page and as this bundle's
        // configuration form on the Plugins page. Persistence lives on the Host
        // (`getSettings` / `saveSettings`); this form is only a thin client.
        function SettingsPage() {
          const [form, setForm] = React.useState(null);
          const [defaults, setDefaults] = React.useState(null);
          const [busy, setBusy] = React.useState(false);
          const [error, setError] = React.useState('');
          const [saved, setSaved] = React.useState(false);
          const [loading, setLoading] = React.useState(true);

          // DSH's language switch must also refresh this React subtree.
          const [, setLocaleRevision] = React.useState(0);
          React.useEffect(() => {
            if (typeof ctx.locale?.subscribe !== 'function') return undefined;
            const dispose = ctx.locale.subscribe(() => setLocaleRevision(revision => revision + 1));
            return () => {
              try { dispose?.(); } catch {}
            };
          }, []);

          React.useEffect(() => {
            let alive = true;
            call('getSettings').then((value) => {
              if (!alive) return;
              setForm({
                rootDirectory: String(value?.rootDirectory ?? ''),
                dirPrefix: String(value?.dirPrefix ?? ''),
                heroNewTask: value?.heroNewTask !== false,
              });
              setDefaults({
                rootDirectory: String(value?.defaults?.rootDirectory ?? ''),
                dirPrefix: String(value?.defaults?.dirPrefix ?? ''),
                heroNewTask: value?.defaults?.heroNewTask !== false,
              });
            }).catch((failure) => {
              if (alive) setError(failure.message || t('failed'));
            }).finally(() => {
              if (alive) setLoading(false);
            });
            return () => { alive = false; };
          }, []);

          const update = (key) => (event) => {
            setForm((current) => ({ ...current, [key]: event.target.value }));
            setSaved(false);
            setError('');
          };

          const submit = async (event) => {
            event?.preventDefault?.();
            if (busy || !form) return;
            setBusy(true);
            setError('');
            try {
              const value = await call('saveSettings', form);
              setForm({
                rootDirectory: String(value?.rootDirectory ?? ''),
                dirPrefix: String(value?.dirPrefix ?? ''),
                heroNewTask: value?.heroNewTask !== false,
              });
              applySettings(value);
              setSaved(true);
            } catch (failure) {
              setError(failure.message || t('failed'));
              setSaved(false);
            } finally {
              setBusy(false);
            }
          };

          const reset = () => {
            if (!defaults) return;
            setForm({ ...defaults });
            setSaved(false);
            setError('');
          };

          // Explanations live behind a "?" trigger: the text is carried as a
          // data attribute, and the shared tooltip listener renders the same
          // bubble the header buttons use.
          const hintButton = (key) => h('button', {
            className: 'dsh-ttz-hintbtn',
            type: 'button',
            'data-dsh-ttz-tip': t(key),
            'aria-label': t(key),
            onClick: (event) => {
              event.preventDefault();
              event.stopPropagation();
            },
          }, '?');

          const status = error
            ? h('div', { className: 'dsh-ttz-status is-error', role: 'alert' }, error)
            : saved
              ? h('div', { className: 'dsh-ttz-status is-ok', role: 'status' }, t('settingsSaved'))
              : null;

          if (loading && !form) {
            return h('div', { className: 'dsh-ttz-settings' }, h('div', { className: 'dsh-ttz-hint' }, t('settingsLoading')));
          }
          if (!form) return h('div', { className: 'dsh-ttz-settings' }, status);

          return h('form', { className: 'dsh-ttz-settings', onSubmit: submit },
            h('h2', { className: 'dsh-ttz-settings-title' }, t('settingsTitle')),
            h('label', { className: 'dsh-ttz-field' },
              h('span', { className: 'dsh-ttz-field-head' },
                h('span', { className: 'dsh-ttz-field-label' }, t('settingsRoot')),
                hintButton('settingsRootHint'),
              ),
              h('input', {
                className: 'dsh-ttz-input',
                value: form.rootDirectory,
                onChange: update('rootDirectory'),
                spellCheck: false,
                autoComplete: 'off',
                disabled: busy,
              }),
            ),
            h('label', { className: 'dsh-ttz-field' },
              h('span', { className: 'dsh-ttz-field-head' },
                h('span', { className: 'dsh-ttz-field-label' }, t('settingsPrefix')),
                hintButton('settingsPrefixHint'),
              ),
              h('input', {
                className: 'dsh-ttz-input',
                value: form.dirPrefix,
                onChange: update('dirPrefix'),
                spellCheck: false,
                autoComplete: 'off',
                disabled: busy,
              }),
            ),
            h('label', { className: 'dsh-ttz-check' },
              h('input', {
                type: 'checkbox',
                checked: form.heroNewTask !== false,
                disabled: busy,
                onChange: (event) => {
                  const checked = event.target.checked;
                  setForm((current) => ({ ...current, heroNewTask: checked }));
                  setSaved(false);
                  setError('');
                },
              }),
              h('span', { className: 'dsh-ttz-check-text' },
                h('span', { className: 'dsh-ttz-field-head' },
                  h('span', { className: 'dsh-ttz-field-label' }, t('settingsHeroTitle')),
                  hintButton('settingsHeroHint'),
                ),
              ),
            ),
            status,
            h('div', { className: 'dsh-ttz-settings-actions' },
              h('button', { className: 'dsh-ttz-btn dsh-ttz-btn-primary', type: 'submit', disabled: busy }, busy ? t('settingsSaving') : t('settingsSave')),
              h('button', { className: 'dsh-ttz-btn', type: 'button', disabled: busy, onClick: reset }, t('settingsReset')),
            ),
          );
        }

        if (React) {
          ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register(
            { name: 'settings.section', id: 'temp-task-zone', order: 5, label: () => t('title') },
            SettingsPage,
          )), 'temp-task-zone: settings section');
          if (primitives?.IconFolderCloseRegular) {
            ctx.effect(() => ctx.slots.inject('settings.section.icon', () => ctx.slots.register(
              { name: 'settings.section.icon', id: 'temp-task-zone' },
              (props) => h(primitives.IconFolderCloseRegular, { size: props?.size ?? 16 }),
            )), 'temp-task-zone: settings icon');
          }
          ctx.effect(() => ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register(
            { name: 'plugins.bundle.config', key: 'dsh-temp-task' },
            (props) => (props?.view === 'page' ? h(SettingsPage) : null),
          )), 'temp-task-zone: plugin config page');
        }

        // ---- lifetime -------------------------------------------------------
        call('getSettings').then(applySettings).catch(() => {});
        refresh();
        sync();
        const timer = window.setInterval(() => {
          sync();
          if (!state.loaded && !state.loading) refresh();
        }, 1000);

        ctx.effect(() => {
          state.disposed = false;
          const onFocus = () => { refresh(); scheduleSync(); };
          window.addEventListener('focus', onFocus);
          // Session titles are projections: re-render when the session list
          // publishes a new snapshot so auto-summarized titles appear without
          // waiting for the fallback tick.
          let disposeSessions;
          try {
            disposeSessions = ctx.sessions?.list?.subscribe?.(() => { scheduleSync(); scheduleSweep(); });
          } catch {
            disposeSessions = undefined;
          }
          return () => {
            state.disposed = true;
            window.clearInterval(timer);
            if (state.sweepTimer) { window.clearTimeout(state.sweepTimer); state.sweepTimer = 0; }
            state.protectSessionId = null;
            state.protectUntil = 0;
            window.removeEventListener('focus', onFocus);
            try { disposeSessions?.(); } catch {}
            clearTimeout(state.toastTimer);
            if (state.raf) { window.cancelAnimationFrame(state.raf); state.raf = 0; }
            teardownDom();
            removeHeroItems();
            style.remove();
            document.querySelector('.dsh-ttz-toast')?.remove();
            state.tasks = [];
            state.byWorkspace = new Map();
            state.sessionIds = new Set();
          };
        }, 'temp-task-zone: sidebar lifetime');

        ctx.effect(() => {
          document.addEventListener('click', onDocumentClick, true);
          return () => document.removeEventListener('click', onDocumentClick, true);
        }, 'temp-task-zone: new-session default');

        ctx.effect(() => {
          const hide = () => dropTip();
          document.addEventListener('mouseover', onTipOver, true);
          document.addEventListener('mouseout', onTipOut, true);
          document.addEventListener('focusin', onTipOver, true);
          document.addEventListener('focusout', onTipOut, true);
          document.addEventListener('scroll', hide, true);
          document.addEventListener('keydown', onTipKeydown, true);
          document.addEventListener('click', hide, true);
          window.addEventListener('resize', hide);
          return () => {
            document.removeEventListener('mouseover', onTipOver, true);
            document.removeEventListener('mouseout', onTipOut, true);
            document.removeEventListener('focusin', onTipOver, true);
            document.removeEventListener('focusout', onTipOut, true);
            document.removeEventListener('scroll', hide, true);
            document.removeEventListener('keydown', onTipKeydown, true);
            document.removeEventListener('click', hide, true);
            window.removeEventListener('resize', hide);
            dropTip();
          };
        }, 'temp-task-zone: header tooltips');

        ctx.effect(() => {
          watchHeroMenus();
          return () => {
            if (state.heroObserver) { state.heroObserver.disconnect(); state.heroObserver = null; }
            removeHeroItems();
          };
        }, 'temp-task-zone: hero picker row');
      },
    };
  },
});

function readFlag(name, fallback) {
  try {
    const value = window.localStorage.getItem(`dsh-ttz:${name}`);
    if (value === null) return fallback;
    return value === '1';
  } catch {
    return fallback;
  }
}

function writeFlag(name, value) {
  try { window.localStorage.setItem(`dsh-ttz:${name}`, value ? '1' : '0'); } catch {}
}

// View options (order / archived filter) are string preferences, so they get
// their own raw-value helpers instead of the boolean flag above.
function readPreference(name, allowed, fallback) {
  try {
    const value = window.localStorage.getItem(`dsh-ttz:${name}`);
    return allowed.includes(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function writePreference(name, value) {
  try { window.localStorage.setItem(`dsh-ttz:${name}`, String(value)); } catch {}
}

function installStyles() {
  const css = `
.dsh-ttz-zone{display:flex;flex-direction:column;flex:0 0 auto;min-height:0;max-height:min(42vh,340px);margin:0}
.dsh-ttz-head{display:flex;align-items:center;justify-content:flex-end;gap:4px;height:36px;margin:2px -4px 4px 0;padding-left:var(--dsh-sidebar-row-padding,8px);padding-right:1px;box-sizing:border-box;color:var(--dsw-alias-label-tertiary);border-radius:var(--dsw-radius-md,8px)}
.dsh-ttz-label{flex:none;max-width:45%;font-size:14px;font-weight:400;line-height:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;position:relative;left:-1px}
.dsh-ttz-searchslot{display:flex;align-items:center;flex:none;min-width:0;max-width:28px;margin-left:auto;transition:max-width .15s var(--ds-ease-in-out)}
.dsh-ttz-searchbox{display:none;align-items:center;flex:1 1 auto;min-width:0;box-sizing:border-box;height:32px;padding:0 4px 0 6px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md,8px);color:var(--dsw-alias-label-caption)}
.dsh-ttz-searchicon{display:inline-flex;align-items:center;justify-content:center;flex:none;width:16px}
.dsh-ttz-searchinput{flex:1 1 auto;min-width:0;height:100%;padding:0 4px;border:0;outline:none;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:18px}
.dsh-ttz-searchinput::placeholder{color:var(--dsw-alias-label-caption)}
.dsh-ttz-clear{display:inline-flex;align-items:center;justify-content:center;flex:none;width:24px;height:24px;padding:0;border:0;border-radius:var(--dsw-radius-xs,4px);background:transparent;color:var(--dsw-alias-label-caption);cursor:pointer}
.dsh-ttz-clear:hover{color:var(--dsw-alias-label-primary)}
.dsh-ttz-clear:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4d6bfe);outline-offset:0}
.dsh-ttz-headbtn{display:inline-flex;align-items:center;justify-content:center;flex:none;width:28px;height:28px;padding:0;border:0;border-radius:var(--dsw-radius-sm,4px);background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
@media (hover:hover){.dsh-ttz-headbtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}}
.dsh-ttz-headbtn:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary,#4d6bfe));outline-offset:-2px}
.dsh-ttz-headactions{display:flex;align-items:center;gap:4px;flex:none;max-width:60px;overflow:hidden;transition:max-width .15s var(--ds-ease-in-out),opacity .15s var(--ds-ease-in-out),transform .15s var(--ds-ease-in-out)}
.dsh-ttz-viewslot{display:flex;align-items:center;flex:none}
.dsh-ttz-viewmenu{min-width:200px}
.dsh-ttz-head.is-searching .dsh-ttz-label,.dsh-ttz-head.is-searching .dsh-ttz-toggle{display:none}
.dsh-ttz-head.is-searching .dsh-ttz-headactions{max-width:0;opacity:0;visibility:hidden;pointer-events:none;transform:translateX(4px)}
.dsh-ttz-head.is-searching .dsh-ttz-searchslot{max-width:100%;flex:1 1 auto;margin-left:0}
.dsh-ttz-head.is-searching .dsh-ttz-searchbtn{display:none}
.dsh-ttz-head.is-searching .dsh-ttz-searchbox{display:flex}
.dsh-ttz-toggle{display:inline-flex;align-items:center;justify-content:center;flex:none;width:20px;height:20px;padding:0;border:0;background:transparent;color:var(--dsw-alias-label-caption);cursor:pointer;border-radius:var(--dsw-radius-xs,4px);opacity:0;pointer-events:none;transition:opacity .12s var(--ds-ease-in-out)}
@media (hover:hover){.dsh-ttz-head:hover .dsh-ttz-toggle{opacity:1;pointer-events:auto}}
.dsh-ttz-toggle:focus-visible{opacity:1;pointer-events:auto;outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary,#4d6bfe));outline-offset:-2px}
.dsh-ttz-chevron{display:inline-flex;align-items:center;justify-content:center;transform:rotate(0deg);transition:transform .15s var(--ds-ease-in-out)}
.dsh-ttz-zone:not(.is-collapsed) .dsh-ttz-chevron{transform:rotate(90deg)}
@media (prefers-reduced-motion:reduce){.dsh-ttz-chevron{transition:none}}
.dsh-ttz-add{display:inline-flex;align-items:center;justify-content:center;flex:none;width:28px;height:28px;padding:0;border:0;border-radius:var(--dsw-radius-sm,4px);background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
@media (hover:hover){.dsh-ttz-add:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}}
.dsh-ttz-add:disabled{opacity:.5;cursor:default}
.dsh-ttz-add:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary,#4d6bfe));outline-offset:-2px}
.dsh-ttz-rows{display:flex;flex-direction:column;gap:2px;min-height:0;overflow-y:auto;overflow-x:hidden;padding-bottom:2px}
.dsh-ttz-row{display:flex;align-items:center;gap:var(--dsh-sidebar-label-gap,8px);box-sizing:border-box;width:100%;min-width:0;height:34px;min-height:34px;padding:0 8px;padding-inline-start:calc(var(--dsh-sidebar-row-padding,8px) - var(--dsh-sidebar-paint-inset,0px));border-inline:var(--dsh-sidebar-paint-inset,0px) solid transparent;background-clip:padding-box;border-radius:var(--dsw-radius-md,8px);background-color:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;font-weight:400;line-height:20px;text-align:left;cursor:default;user-select:none}
.dsh-ttz-row:hover{background-color:var(--dsw-alias-interactive-bg-hover)}
.dsh-ttz-row:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4d6bfe);outline-offset:-2px}
.dsh-ttz-row-icon{display:inline-flex;align-items:center;justify-content:center;flex:none;width:16px;height:20px;color:var(--dsw-alias-label-tertiary)}
.dsh-ttz-row.is-active .dsh-ttz-row-icon{color:var(--dsw-alias-state-business-primary,#4d6bfe)}
.dsh-ttz-row-label{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-ttz-row-label[data-scrolled]{mask-image:linear-gradient(90deg,#0000,#000 12px)}
.dsh-ttz-row-label[data-clipped]{mask-image:linear-gradient(270deg,#0000,#000 12px)}
.dsh-ttz-row-label[data-scrolled][data-clipped]{mask-image:linear-gradient(90deg,#0000,#000 12px calc(100% - 12px),#0000)}
@media (hover:hover){.dsh-ttz-row:hover .dsh-ttz-row-label{text-overflow:clip}}
.dsh-ttz-row.is-archived .dsh-ttz-row-label{color:var(--dsw-alias-label-caption)}
.dsh-ttz-pin-badge{display:inline-flex;align-items:center;justify-content:center;flex:none;width:16px;height:20px;color:var(--dsw-alias-label-caption)}
.dsh-ttz-actions{display:none;align-items:center;gap:13px;flex:none}
.dsh-ttz-row:hover .dsh-ttz-actions,.dsh-ttz-row:focus-within .dsh-ttz-actions{display:inline-flex}
.dsh-ttz-row:hover .dsh-ttz-pin-badge{display:none}
.dsh-ttz-action{display:inline-flex;align-items:center;justify-content:center;flex:none;width:24px;height:24px;margin:-4px;padding:0;border:0;border-radius:var(--dsw-radius-xs,4px);background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer}
.dsh-ttz-action:hover{color:var(--dsw-alias-label-primary)}
.dsh-ttz-action:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4d6bfe);outline-offset:0}
.dsh-ttz-empty{padding:16px 12px;color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:20px}
.dsh-ttz-rename{flex:1 1 auto;min-width:0;box-sizing:border-box;height:20px;padding:0 2px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-sm,4px);background:var(--dsw-alias-button-elevated-fill,transparent);color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;line-height:20px;outline:none}
.dsh-ttz-tip{position:fixed;z-index:1100;display:inline-flex;align-items:center;gap:8px;width:max-content;max-width:min(50vw,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;box-sizing:border-box;padding:3px 7px;border-radius:var(--dsw-radius-sm,4px);background:var(--dsw-alias-tooltip-bg,#1f2329);color:var(--dsw-static-neutral-bluish-00,#fff);font-size:13px;line-height:20px;white-space:pre-line;overflow-wrap:break-word;pointer-events:none;transform:translate(-50%);animation:dsh-ttz-tip-in .15s var(--ds-ease-in-out)}
@keyframes dsh-ttz-tip-in{0%{opacity:0}}
@media (prefers-reduced-motion:reduce){.dsh-ttz-tip{animation:none}}
.dsh-ttz-toast{position:fixed;right:16px;bottom:16px;z-index:2000;max-width:420px;padding:10px 14px;border-radius:10px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.5;box-shadow:0 8px 24px rgba(0,0,0,.16);opacity:0;transform:translateY(6px);pointer-events:none;transition:opacity .16s ease,transform .16s ease}
.dsh-ttz-toast-visible{opacity:1;transform:translateY(0)}
.dsh-ttz-settings{display:flex;flex-direction:column;gap:14px;max-width:560px;padding:2px 0 8px;box-sizing:border-box;font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary)}
.dsh-ttz-settings-intro{margin:0;color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:20px}
.dsh-ttz-settings-title{margin:0 0 4px;font-size:16px;font-weight:600;line-height:24px;color:var(--dsw-alias-label-primary)}
.dsh-ttz-field{display:flex;flex-direction:column;gap:6px}
.dsh-ttz-field-label{font-size:13px;font-weight:500;line-height:20px;color:var(--dsw-alias-label-primary)}
.dsh-ttz-field-head{display:flex;align-items:center;gap:6px;min-width:0}
.dsh-ttz-hintbtn{flex:none;display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;padding:0;margin:0;border:.5px solid var(--dsw-alias-border-l2,rgba(127,127,127,.28));border-radius:50%;background:0 0;color:var(--dsw-alias-label-caption);font:inherit;font-size:11px;line-height:1;cursor:help}
.dsh-ttz-hintbtn:hover,.dsh-ttz-hintbtn:focus-visible{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);outline:none}
.dsh-ttz-input{box-sizing:border-box;width:100%;height:32px;padding:0 8px;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;outline:none}
.dsh-ttz-input:focus{border-color:var(--dsw-alias-state-business-primary,#4d6bfe)}
.dsh-ttz-input:disabled{opacity:.6}
.dsh-ttz-hint{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.dsh-ttz-check{display:flex;align-items:flex-start;gap:8px;cursor:pointer}
.dsh-ttz-check input{margin:3px 0 0;flex:none;accent-color:var(--dsw-alias-state-business-primary,#4d6bfe);cursor:pointer}
.dsh-ttz-check input:disabled{cursor:default;opacity:.6}
.dsh-ttz-check-text{display:flex;flex-direction:column;gap:4px;min-width:0}
.dsh-ttz-hero-sep{flex:none;height:1px;margin:4px 6px;background:var(--dsw-alias-border-l2,rgba(127,127,127,.28));border-radius:1px}
.dsh-ttz-settings-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.dsh-ttz-btn{height:30px;padding:0 14px;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;cursor:pointer}
.dsh-ttz-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsh-ttz-btn:disabled{opacity:.5;cursor:default}
.dsh-ttz-btn-primary{border-color:transparent;background:var(--dsw-alias-state-business-primary,#4d6bfe);color:#fff}
.dsh-ttz-btn-primary:hover{background:var(--dsw-alias-state-business-primary-hover,#3d56d8)}
.dsh-ttz-status{font-size:12px;line-height:18px}
.dsh-ttz-status.is-error{color:var(--dsw-alias-state-danger-primary,#d64545)}
.dsh-ttz-status.is-ok{color:var(--dsw-alias-state-success-primary,#2e9e5b)}
`;
  const element = document.createElement('style');
  element.setAttribute('data-dsh-temp-zone', 'styles');
  element.textContent = css;
  document.head.appendChild(element);
  return element;
}
