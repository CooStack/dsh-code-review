import test from "node:test";
import assert from "node:assert/strict";

function createReactStub() {
  const queuedState = [];
  return {
    Fragment: Symbol("Fragment"),
    createElement(type, props, ...children) {
      return { type, props: props ?? {}, children };
    },
    queueState(...values) {
      queuedState.push(...values);
    },
    useCallback(value) {
      return value;
    },
    useEffect() {},
    useLayoutEffect() {},
    useMemo(factory) {
      return factory();
    },
    useRef(value) {
      return { current: value };
    },
    useSyncExternalStore(_subscribe, getSnapshot) {
      return getSnapshot();
    },
    useState(initial) {
      const value =
        queuedState.length > 0
          ? queuedState.shift()
          : typeof initial === "function"
            ? initial()
            : initial;
      return [value, () => {}];
    },
  };
}

function findElements(node, predicate, found = []) {
  if (node === null || node === undefined || typeof node !== "object")
    return found;
  if (predicate(node)) found.push(node);
  if (Array.isArray(node.children)) {
    for (const child of node.children.flat(Infinity))
      findElements(child, predicate, found);
  }
  return found;
}

test("client module registers the changes sidebar and completed-turn summary definition", async () => {
  let declaration;
  globalThis.window = {
    __ModuleLoader__: {
      load(value) {
        declaration = value;
      },
    },
    async queryLocalFonts() {
      return [
        { family: "Microsoft YaHei" },
        { family: "Consolas" },
        { family: "Microsoft YaHei" },
      ];
    },
  };
  const styleNodes = [];
  const rootStyles = new Map();
  const storedPreferences = new Map();
  globalThis.localStorage = {
    getItem(key) {
      return storedPreferences.get(key) ?? null;
    },
    setItem(key, value) {
      storedPreferences.set(key, value);
    },
  };
  let settingsValue = { fontFamily: "Microsoft YaHei", highlightOverrides: "" };
  const settingsListeners = new Set();
  const fontSettings = {
    getSnapshot() {
      return this.readSnapshot();
    },
    readSnapshot() {
      return {
        status: "ready",
        value: settingsValue,
        user: settingsValue,
        writable: true,
      };
    },
    subscribe(listener) {
      return this.addListener(listener);
    },
    addListener(listener) {
      settingsListeners.add(listener);
      return () => settingsListeners.delete(listener);
    },
    set(field, value) {
      assert.ok(["fontFamily", "highlightOverrides"].includes(field));
      settingsValue = { ...settingsValue, [field]: value };
      for (const listener of settingsListeners) listener();
      return Promise.resolve();
    },
  };
  const settingsScope = {
    bind(spec) {
      assert.deepEqual(spec, { namespace: "code-review" });
      return fontSettings;
    },
  };
  globalThis.fetch = async (url, init = {}) => {
    assert.equal(url, "/api/dsh-code-review/config");
    const method = init.method ?? "GET";
    if (method === "PUT") settingsValue = JSON.parse(init.body);
    return {
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({ ok: true, config: settingsValue });
      },
    };
  };
  const overlayNode = { dataset: { shellOverlay: "" } };
  globalThis.document = {
    documentElement: {
      style: {
        setProperty(name, value) {
          rootStyles.set(name, value);
        },
        removeProperty(name) {
          rootStyles.delete(name);
        },
      },
    },
    head: {
      appendChild(node) {
        styleNodes.push(node);
      },
    },
    querySelector(selector) {
      return selector === "[data-shell-overlay]" ? overlayNode : null;
    },
    createElement() {
      return {
        dataset: {},
        remove() {},
        set textContent(value) {
          this.css = value;
        },
      };
    },
  };

  await import(`../lib/client.js?test=${Date.now()}`);
  assert.equal(declaration.id, "dsh-code-review");

  const React = createReactStub();
  const primitive = () => null;
  const plugin = declaration.factory((id) => {
    if (id === "react") return React;
    if (id === "react-dom") {
      return {
        createPortal(node, target) {
          return { type: "portal", props: { target }, children: [node] };
        },
      };
    }
    if (id === "@deepseek-ai/dsh-client-ui-primitives") {
      return {
        DiffBlock: primitive,
        Menu: primitive,
        IconCodeOutline16: primitive,
        IconRefreshOutline16: primitive,
        IconChevronDownOutline14: primitive,
        IconChevronRightOutline14: primitive,
        IconWarningOutline16: primitive,
        IconFolderClose16: primitive,
        IconFolderOpen16: primitive,
        IconFolderOpenOutline16: primitive,
      };
    }
    if (id === "@deepseek-ai/dsh-client-ui-settings-plugins") {
      return {
        PluginCard(props) {
          const [open] = React.useState(false);
          return React.createElement(
            "li",
            { "data-shared-plugin-card": true },
            React.createElement("button", {
              type: "button",
              "aria-expanded": open,
            }),
            open ? props.children : null,
          );
        },
      };
    }
    throw new Error(`unexpected require: ${id}`);
  });

  assert.equal(plugin.MAX_MULTI_FILE_CHANGED_LINES, 800);
  assert.equal(plugin.isLargeDiff(800), false);
  assert.equal(plugin.isLargeDiff(801), true);
  const reviewFiles = [{ path: "src/a.js" }, { path: "src/b.js" }];
  assert.deepEqual(
    plugin.filesForReview(reviewFiles, 800, "src/b.js"),
    reviewFiles,
    "800 lines must keep the multi-file view",
  );
  assert.deepEqual(
    plugin.filesForReview(reviewFiles, 801, "src/b.js"),
    [reviewFiles[1]],
    "only more than 800 lines may focus one file",
  );
  assert.deepEqual(
    plugin.filesForReview(reviewFiles, 801, "missing"),
    [reviewFiles[0]],
    "large views default to the first file",
  );
  assert.equal(plugin.fileAnchorId("src/a b.js"), "dcr-file-src%2Fa%20b.js");
  assert.equal(
    plugin.sidebarWidthFromPointer(1440, 56, 120),
    1320,
    "sidebar width must not be capped at 520px",
  );
  assert.equal(
    plugin.sidebarWidthFromPointer(1440, 280, -100),
    1160,
    "only the physical frame boundary limits dragging",
  );
  assert.equal(
    plugin.filePaneWidthFromPointer(200, 1000, 420),
    580,
    "inner divider follows the pointer",
  );
  assert.equal(
    plugin.filePaneWidthFromPointer(200, 1000, -100),
    800,
    "inner divider only clamps to the physical main pane",
  );
  const tree = plugin.buildFileTree([
    { path: "D:/work/src/main/a.js", cwd: "D:/work", added: 1, removed: 0 },
    { path: "D:/work/src/main/b.js", cwd: "D:/work", added: 0, removed: 1 },
    { path: "D:/work/package.json", cwd: "D:/work", added: 1, removed: 1 },
  ]);
  assert.equal(tree[0].name, "src/main");
  assert.deepEqual(
    tree[0].children.map((node) => node.name),
    ["a.js", "b.js"],
  );
  assert.equal(tree[1].name, "package.json");

  const registrations = [];
  let definition;
  let openedPath;
  let sidebarToggles = 0;
  const disposers = [];
  const theme = {
    getTheme() {
      return { active: { colorScheme: "dark" } };
    },
  };
  const layout = {
    toggleSidebar() {
      sidebarToggles += 1;
    },
  };
  const conversationEvents = {
    register(value) {
      definition = value;
      return () => {};
    },
  };
  const ctx = {
    on(name, listener) {
      assert.equal(name, "theme/change");
      assert.equal(typeof listener, "function");
      return () => {};
    },
    get(name) {
      if (name === "theme") return theme;
      if (name === "layout") return layout;
      if (name === "conversationEvents") return conversationEvents;
      if (name === "workspaces")
        return {
          openPath(path) {
            openedPath = path;
          },
        };
      return undefined;
    },
    effect(installer) {
      disposers.push(installer());
    },
    slots: {
      inject(_name, callback) {
        return callback();
      },
      register(options, component) {
        registrations.push({ options, component });
        return () => {};
      },
    },
  };
  plugin.apply(ctx);
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(plugin.inject, ["slots"]);
  assert.equal(styleNodes.length, 1);
  const changesRegistration = registrations.find(
    ({ options }) =>
      options.name === "conversation.view" && options.id === "changes",
  );
  const sidebarRegistration = registrations.find(
    ({ options }) =>
      options.name === "conversation.session.header.utilities" &&
      options.id === "code-review-changes",
  );
  const summaryRegistration = registrations.find(
    ({ options }) =>
      options.name === "conversation.chat.node" &&
      options.key === "code-review-summary",
  );
  const pluginSettingsRegistration = registrations.find(
    ({ options }) =>
      options.name === "settings.plugin.item" && options.id === "code-review",
  );
  assert.equal(
    changesRegistration,
    undefined,
    "changes must no longer replace the conversation view",
  );
  assert.ok(sidebarRegistration);
  assert.ok(summaryRegistration);
  assert.ok(pluginSettingsRegistration);
  assert.equal(
    pluginSettingsRegistration.options.key,
    undefined,
    "settings.plugin.item must use the list slot id contract",
  );
  assert.equal(
    registrations.some(
      ({ options }) =>
        options.name === "settings.general.item" &&
        options.id === "code-review-font",
    ),
    false,
  );
  assert.equal(
    registrations.some(
      ({ options }) =>
        options.name === "settings.plugins.tab" &&
        options.id === "code-review-highlighting",
    ),
    false,
  );
  assert.equal(
    rootStyles.get("--dcr-font-family"),
    '"Microsoft YaHei", monospace',
  );
  assert.match(
    styleNodes[0].css,
    /body:has\(\[role="dialog"\]\[aria-modal="true"\]\) \.dcr-sidebarPanel/,
    "settings dialog must cover no changes panel",
  );
  assert.match(
    styleNodes[0].css,
    /grid-template-columns:minmax\(0,1fr\) var\(--dcr-file-pane-width,260px\)/,
    "code and file tree must remain side-by-side before state loads",
  );

  const fonts = await plugin.querySystemFontFamilies();
  assert.deepEqual(fonts, ["Consolas", "Microsoft YaHei"]);
  assert.deepEqual(plugin.rankFontCandidates(fonts, "microsoft"), [
    "Microsoft YaHei",
    "Consolas",
  ]);
  assert.deepEqual(plugin.rankFontCandidates(fonts, "sol"), [
    "Consolas",
    "Microsoft YaHei",
  ]);
  const collapsedPluginView = pluginSettingsRegistration.component(
    pluginSettingsRegistration.options.inject(),
  );
  assert.equal(collapsedPluginView.type, "section");
  const pluginToggle = findElements(
    collapsedPluginView,
    (node) => node.type === "button" && node.props["aria-expanded"] === false,
  )[0];
  assert.ok(pluginToggle, "plugin settings card must be collapsed by default");
  assert.equal(
    findElements(
      collapsedPluginView,
      (node) =>
        typeof node.type === "function" && node.type.name === "FontSettingsRow",
    ).length,
    0,
  );
  React.queueState(true);
  const pluginView = pluginSettingsRegistration.component(
    pluginSettingsRegistration.options.inject(),
  );
  const fontComponent = findElements(
    pluginView,
    (node) =>
      typeof node.type === "function" && node.type.name === "FontSettingsRow",
  )[0];
  assert.ok(fontComponent);
  React.queueState(
    "Microsoft YaHei",
    ["Microsoft YaHei", "Consolas"],
    false,
    false,
    null,
  );
  const fontView = fontComponent.type(fontComponent.props);
  const fontMenu = findElements(
    fontView,
    (node) =>
      Array.isArray(node.props?.items) &&
      typeof node.props?.onSelect === "function",
  )[0];
  const fontInput = fontMenu.props.anchor;
  assert.equal(fontInput.props.value, "Microsoft YaHei");
  fontInput.props.onChange({ target: { value: "Consolas" } });
  assert.equal(
    storedPreferences.get("dsh-code-review/font"),
    undefined,
    "font changes must use the Host settings scope",
  );
  assert.equal(
    rootStyles.get("--dcr-font-family"),
    '"Microsoft YaHei", monospace',
  );
  assert.deepEqual(
    fontMenu.props.items.map((item) => item.label),
    ["Microsoft YaHei", "Consolas"],
  );
  fontMenu.props.onSelect("Consolas");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(settingsValue.fontFamily, "Consolas");
  assert.equal(storedPreferences.get("dsh-code-review/font"), undefined);
  assert.equal(
    rootStyles.get("--dcr-font-family"),
    '"Consolas", "Microsoft YaHei", monospace',
  );
  fontInput.props.onChange({ target: { value: "" } });
  assert.equal(
    settingsValue.fontFamily,
    "Consolas",
    "clearing the draft must not reset the saved font",
  );

  const highlightComponent = findElements(
    pluginView,
    (node) =>
      typeof node.type === "function" &&
      node.type.name === "HighlightSettingsContent",
  )[0];
  assert.ok(highlightComponent, "plugin card must render highlighter settings");
  React.queueState("light");
  const highlightView = highlightComponent.type(highlightComponent.props);
  const colorComponent = findElements(
    highlightView,
    (node) =>
      typeof node.type === "function" && node.type.name === "HighlightColorRow",
  )[0];
  assert.ok(colorComponent);
  React.queueState("#24292F");
  const colorView = colorComponent.type(colorComponent.props);
  const colorInput = findElements(
    colorView,
    (node) =>
      node.type === "input" &&
      node.props["aria-label"] === "普通文本十六进制颜色",
  )[0];
  assert.ok(colorInput);
  colorInput.props.onChange({ target: { value: "#123456" } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(
    JSON.parse(settingsValue.highlightOverrides).light["syntax-plain"],
    "#123456",
    "palette changes must use the Host config API",
  );

  // Re-activation models a DSH restart while the Host settings document survives.
  plugin.apply(ctx);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(
    rootStyles.get("--dcr-font-family"),
    '"Consolas", "Microsoft YaHei", monospace',
  );

  const sidebarInjected = sidebarRegistration.options.inject();
  const useSession = (selector) =>
    selector({ chat: { order: [] }, running: false, turnEnds: new Set() });
  let sidebarView = sidebarRegistration.component({
    sessionId: "session-1",
    useSession,
    ...sidebarInjected,
  });
  const openSidebar = findElements(
    sidebarView,
    (node) =>
      node.type === "button" && node.props["aria-label"] === "打开变更侧栏",
  )[0];
  assert.ok(openSidebar);
  openSidebar.props.onClick();
  assert.equal(
    sidebarToggles,
    0,
    "wide sidebar opening must not use the capped details layout service",
  );
  sidebarView = sidebarRegistration.component({
    sessionId: "session-1",
    useSession,
    ...sidebarInjected,
  });
  const portal = findElements(sidebarView, (node) => node.type === "portal")[0];
  assert.ok(
    portal,
    "open changes action must portal a panel into the shell overlay",
  );
  assert.equal(portal.props.target, overlayNode);
  const closeSidebar = findElements(
    sidebarView,
    (node) =>
      node.type === "button" && node.props["aria-label"] === "关闭变更侧栏",
  )[0];
  closeSidebar.props.onClick();
  assert.equal(sidebarToggles, 0);

  const files = [
    {
      path: "src/a.js",
      added: 3,
      removed: 1,
      unified: { sections: [] },
      diffs: [],
    },
    {
      path: "src/b.js",
      added: 4,
      removed: 2,
      unified: { sections: [] },
      diffs: [],
    },
  ];
  const turn = {
    turn: 1,
    files,
    added: 7,
    removed: 3,
    changedLines: 10,
    canUndo: false,
  };
  const smallState = { revision: 1, latestTurn: 1, turns: [turn] };
  const summaryInjected = summaryRegistration.options.inject();
  React.queueState(smallState, null, false, false);
  const summaryView = summaryRegistration.component({
    node: { data: { turn: 1, diffs: [] } },
    sessionId: "session-1",
    useSession,
    ...summaryInjected,
  });
  const summaryFiles = findElements(
    summaryView,
    (node) => node.type === "button" && node.props.className === "dcr-fileRow",
  );
  assert.equal(summaryFiles.length, 2);
  summaryFiles[1].props.onClick();
  assert.equal(sidebarToggles, 0);
  assert.equal(
    openedPath,
    undefined,
    "summary navigation must open the sidebar, not the source file",
  );

  const startEvent = {
    type: "turn/start",
    data: { turn: 7 },
    seq: 10,
    time: 100,
  };
  const resultEvent = {
    type: "tool/result",
    data: {
      turn: 7,
      meta: { diffs: [{ path: "src/a.js", oldText: "a\n", newText: "b\n" }] },
    },
    seq: 11,
    time: 110,
  };
  const endEvent = { type: "turn/end", data: { turn: 7 }, seq: 12, time: 120 };
  let state = definition.start({}, { event: startEvent });
  state = definition.update({ state }, { event: resultEvent });
  const beforeEnd = definition.buildViewNode({
    key: "k",
    id: "7",
    state,
    start: { location: { kind: "turn" } },
  });
  assert.equal(beforeEnd, null);
  state = definition.update({ state }, { event: endEvent });
  const context = {
    key: "k",
    id: "7",
    state,
    start: { location: { kind: "turn" } },
  };
  const node = definition.buildViewNode(context);
  assert.equal(node.kind, "code-review-summary");
  assert.equal(node.anchorSeq, 11.9);
  assert.equal(node.data.diffs[0].path, "src/a.js");
  const location = definition.buildLocationData(context, "turn");
  assert.equal(
    location.key,
    definition.kind,
    "location data must be owned by its publishing Definition kind",
  );
  assert.equal(location.value.turn, 7);

  for (const dispose of disposers) dispose();
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.localStorage;
  delete globalThis.fetch;
});
