import { writeFile } from "node:fs/promises";

const endpoint = process.argv[2] ?? "http://127.0.0.1:9223";
const pageUrl = process.argv[3] ?? "http://127.0.0.1:8445";
const targets = await (await fetch(`${endpoint}/json/list`)).json();
const target = targets.find((entry) => entry.type === "page");
if (!target) throw new Error("No CDP page target available");

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let nextId = 1;
const pending = new Map();
const errors = [];
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id !== undefined) {
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error.message));
    else waiter.resolve(message.result);
    return;
  }
  if (message.method === "Runtime.exceptionThrown") {
    errors.push(message.params.exceptionDetails?.text ?? "Runtime exception");
  }
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
    errors.push(message.params.args.map((arg) => arg.value ?? arg.description ?? "").join(" "));
  }
});

function call(method, params = {}) {
  const id = nextId++;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

await call("Runtime.enable");
await call("Page.enable");
const viewportWidth = Number(process.argv[4] ?? 1440);
const viewportHeight = Number(process.argv[5] ?? 900);
await call("Emulation.setDeviceMetricsOverride", { width: viewportWidth, height: viewportHeight, deviceScaleFactor: 1, mobile: viewportWidth < 600 });
await call("Page.navigate", { url: pageUrl });
await new Promise((resolve) => setTimeout(resolve, 5000));

async function evaluate(expression) {
  const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) {
    const detail = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text;
    throw new Error(detail);
  }
  return result.result.value;
}

const initial = await evaluate(`(() => ({
  title: document.title,
  href: location.href,
  styleLoaded: document.querySelector('style[data-plugin-css="dsh-code-review/styles"]') !== null,
  tabs: [...document.querySelectorAll('[role="tab"]')].map((node) => node.textContent.trim()),
  buttons: [...document.querySelectorAll('button')].map((node) => node.textContent.trim()).filter(Boolean).slice(0, 80),
  bodySample: document.body.innerText.slice(0, 1500)
}))()`);

if (!initial.styleLoaded) {
  console.error(JSON.stringify({ phase: "client-load", initial, errors }, null, 2));
  socket.close();
  process.exit(5);
}
// Runtime.exceptionThrown may replay an exception from the page replaced by navigation.
errors.length = 0;

if (!initial.tabs.includes("对话")) {
  await evaluate(`document.querySelector('button[aria-label="选择工作区"]')?.click()`);
  await new Promise((resolve) => setTimeout(resolve, 500));
  await evaluate(`(() => {
    const candidates = [...document.querySelectorAll('button')].filter((button) => button.textContent.trim() === 'CodeSources' && button.getAttribute('aria-label') === null);
    candidates.at(-1)?.click();
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 800));
  await evaluate(`(() => {
    const textarea = document.querySelector('textarea');
    if (!textarea) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(textarea, '只回复 OK，不要修改文件。');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 200));
  await evaluate(`document.querySelector('button[aria-label="发送消息"]')?.click()`);
  await new Promise((resolve) => setTimeout(resolve, 3000));
}

const requestedAction = process.argv[6];
const undoRequested = requestedAction === "--undo";
const screenshotPath = requestedAction?.startsWith("--screenshot=") ? requestedAction.slice("--screenshot=".length) : process.argv[7];
const verificationPrompt = undoRequested || screenshotPath ? undefined : requestedAction;
if (undoRequested) {
  await evaluate(`[...document.querySelectorAll('[role="tab"]')].find((node) => node.textContent.trim() === '对话')?.click()`);
  await new Promise((resolve) => setTimeout(resolve, 300));
  await evaluate(`[...document.querySelectorAll('.dcr-summary button')].find((node) => node.textContent.trim() === '撤销')?.click()`);
  await new Promise((resolve) => setTimeout(resolve, 150));
  await evaluate(`[...document.querySelectorAll('.dcr-summary button')].find((node) => node.textContent.trim() === '确认撤销')?.click()`);
  await new Promise((resolve) => setTimeout(resolve, 1500));
} else if (verificationPrompt) {
  await evaluate(`[...document.querySelectorAll('[role="tab"]')].find((node) => node.textContent.trim() === '对话')?.click()`);
  await new Promise((resolve) => setTimeout(resolve, 300));
  await evaluate(`(() => {
    const textarea = document.querySelector('textarea');
    if (!textarea) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(textarea, ${JSON.stringify(verificationPrompt)});
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 200));
  await evaluate(`document.querySelector('button[aria-label="发送消息"]')?.click()`);
  await new Promise((resolve) => setTimeout(resolve, 800));
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const running = await evaluate(`document.querySelector('button[aria-label="停止生成"]') !== null`);
    if (!running) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

const final = await evaluate(`(() => {
  const rect = (node) => {
    const value = node?.getBoundingClientRect();
    return value ? { x: value.x, y: value.y, width: value.width, height: value.height, right: value.right } : null;
  };
  const tabs = [...document.querySelectorAll('[role="tab"]')].map((node) => ({
    text: node.textContent.trim(),
    selected: node.getAttribute('aria-selected'),
    rect: rect(node)
  }));
  const center = document.querySelector('.dshDesktopConversationSurface') ?? document.querySelector('[data-shell-overlay]')?.parentElement?.children?.[1];
  const sidebarAction = document.querySelector('button[aria-label="打开变更侧栏"]');
  return {
    tabs,
    hasChangesTab: tabs.some((tab) => tab.text === '变更'),
    hasSidebarAction: sidebarAction !== null,
    sidebarAction: rect(sidebarAction),
    hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    viewport: { width: innerWidth, height: innerHeight },
    center: rect(center),
    fontApiAvailable: typeof window.queryLocalFonts === 'function',
    buttons: [...document.querySelectorAll('button')].map((node) => ({ text: node.textContent.trim(), aria: node.getAttribute('aria-label'), disabled: node.disabled })).filter((item) => item.text || item.aria).slice(0, 100),
    summaryTexts: [...document.querySelectorAll('.dcr-summary')].map((node) => node.innerText),
    bodySample: document.body.innerText.slice(0, 1500)
  };
})()`);

await evaluate(`document.querySelector('button[aria-label="打开变更侧栏"]')?.click()`);
await new Promise((resolve) => setTimeout(resolve, 900));

const changesView = await evaluate(`(() => {
  const rect = (node) => {
    const value = node?.getBoundingClientRect();
    return value ? { x: value.x, y: value.y, width: value.width, height: value.height, right: value.right } : null;
  };
  const root = document.querySelector('.dcr-review');
  const panel = document.querySelector('.dcr-sidebarPanel');
  const center = document.querySelector('.dshDesktopConversationSurface') ?? document.querySelector('[data-shell-overlay]')?.parentElement?.children?.[1];
  const handle = document.querySelector('.dcr-sidebarResizeHandle');
  const heading = document.querySelector('.dcr-title');
  const diffPane = document.querySelector('.dcr-diffPane');
  const filePane = document.querySelector('.dcr-filePane');
  const fileHandle = document.querySelector('.dcr-fileResizeHandle');
  const syntaxRuns = window.__DSH_CODE_REVIEW_HIGHLIGHTER__?.highlightLines('const count = 42; // ready', 'typescript') ?? [];
  const probe = document.createElement('div');
  probe.className = 'dcr-nativeDiff';
  const code = document.createElement('code');
  code.textContent = 'font probe';
  probe.append(code);
  document.body.append(probe);
  const codeFont = getComputedStyle(code).fontFamily;
  probe.remove();
  return {
    present: Boolean(root && panel),
    text: root?.innerText.slice(0, 800) ?? '',
    panel: rect(panel),
    root: rect(root),
    header: rect(document.querySelector('.dcr-reviewHeader')),
    main: rect(document.querySelector('.dcr-main')),
    center: rect(center),
    handle: rect(handle),
    heading: heading === null ? null : { tag: heading.tagName, text: heading.textContent.trim() },
    diffPane: rect(diffPane),
    filePane: rect(filePane),
    fileHandle: rect(fileHandle),
    fileTreeLabels: [...document.querySelectorAll('.dcr-treeLabel')].map((node) => node.textContent.trim()),
    syntaxColors: [...new Set(syntaxRuns.flat().map((run) => run.color))],
    highlightedFile: document.querySelector('.dcr-unifiedPath')?.textContent.trim() ?? null,
    renderedSyntaxColors: [...new Set([...document.querySelectorAll('.dcr-codeLine span')].map((node) => node.style.color).filter(Boolean))],
    fileSearchPresent: document.querySelector('input[aria-label="筛选变更文件"]') !== null,
    topFileSelectPresent: document.querySelector('select[aria-label="选择变更文件"]') !== null,
    codeFont,
    gapLabels: [...document.querySelectorAll('.dcr-gap')].map((node) => node.textContent.trim()),
    lineNumbers: [...document.querySelectorAll('.dcr-lineNo')].map((node) => node.textContent.trim()).filter(Boolean).slice(0, 30),
    diffRows: document.querySelectorAll('.dcr-diffRow').length,
    rootOverflowX: root ? root.scrollWidth > root.clientWidth : null,
    documentOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth
  };
})()`);

if (screenshotPath) {
  const screenshot = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));
}

let innerResized = null;
if (changesView.fileHandle !== null) {
  const x = changesView.fileHandle.x + changesView.fileHandle.width / 2;
  const y = Math.max(160, changesView.fileHandle.y + 160);
  const targetX = Math.max(changesView.main.x, x - 80);
  await call('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
  await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: targetX, y, button: 'left', buttons: 1 });
  await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: targetX, y, button: 'left', buttons: 0, clickCount: 1 });
  await new Promise((resolve) => setTimeout(resolve, 400));
  innerResized = await evaluate(`(() => {
    const rect = (node) => {
      const value = node?.getBoundingClientRect();
      return value ? { x: value.x, width: value.width, right: value.right } : null;
    };
    return { diffPane: rect(document.querySelector('.dcr-diffPane')), filePane: rect(document.querySelector('.dcr-filePane')) };
  })()`);
}

let resized = null;
if (changesView.handle !== null) {
  const x = changesView.handle.x + changesView.handle.width / 2;
  const y = Math.max(80, changesView.handle.y + 120);
  const available = final.viewport.width - changesView.center.x;
  const targetWidth = changesView.panel.width > available - 120
    ? Math.max(720, changesView.panel.width - 300)
    : Math.min(available, Math.max(720, changesView.panel.width + 250));
  const targetX = final.viewport.width - targetWidth;
  await call('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
  await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: targetX, y, button: 'left', buttons: 1 });
  await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: targetX, y, button: 'left', buttons: 0, clickCount: 1 });
  await new Promise((resolve) => setTimeout(resolve, 600));
  resized = await evaluate(`(() => {
    const rect = (node) => {
      const value = node?.getBoundingClientRect();
      return value ? { x: value.x, width: value.width, right: value.right } : null;
    };
    const center = document.querySelector('.dshDesktopConversationSurface') ?? document.querySelector('[data-shell-overlay]')?.parentElement?.children?.[1];
    return { panel: rect(document.querySelector('.dcr-sidebarPanel')), center: rect(center) };
  })()`);
}

await evaluate(`document.querySelector('button[aria-label="关闭变更侧栏"]')?.click()`);
await new Promise((resolve) => setTimeout(resolve, 600));
const closed = await evaluate(`(() => {
  const rect = (node) => {
    const value = node?.getBoundingClientRect();
    return value ? { x: value.x, width: value.width, right: value.right } : null;
  };
  const center = document.querySelector('.dshDesktopConversationSurface') ?? document.querySelector('[data-shell-overlay]')?.parentElement?.children?.[1];
  return {
    panelPresent: document.querySelector('.dcr-sidebarPanel') !== null,
    center: rect(center),
    navigationCollapsed: document.querySelector('[data-shell-overlay]')?.parentElement?.hasAttribute('data-sidebar-collapsed') ?? null,
  };
})()`);

const settingsOpened = await evaluate(`(() => {
  const button = [...document.querySelectorAll('button')].find((node) => node.getAttribute('aria-label') === '设置' || node.textContent.trim() === '设置');
  button?.click();
  return Boolean(button);
})()`);
await new Promise((resolve) => setTimeout(resolve, 700));
await evaluate(`(() => {
  const target = [...document.querySelectorAll('button,[role="tab"]')].find((node) => node.textContent.trim() === '插件');
  target?.click();
  return Boolean(target);
})()`);
await new Promise((resolve) => setTimeout(resolve, 500));
await evaluate(`(() => {
  const target = [...document.querySelectorAll('button,[role="tab"]')].find((node) => node.textContent.trim() === '插件配置');
  target?.click();
  return Boolean(target);
})()`);
await new Promise((resolve) => setTimeout(resolve, 500));
const reviewSettingsCardOpened = await evaluate(`(() => {
  const card = [...document.querySelectorAll('button')].find((node) => node.getAttribute('aria-label')?.endsWith(': dsh-code-review'));
  if (card?.getAttribute('aria-expanded') !== 'true') card?.click();
  return card?.getAttribute('aria-expanded') === 'true' || card !== undefined;
})()`);
await new Promise((resolve) => setTimeout(resolve, 300));
const settingsView = await evaluate(`(() => {
  const fontInput = document.querySelector('input[aria-label="变更代码字体"]');
  const root = fontInput?.closest('li') ?? [...document.querySelectorAll('li')].find((node) => node.innerText.includes('dsh-code-review'));
  return {
    entryPresent: root?.innerText.includes('dsh-code-review') ?? false,
    fontPresent: root?.innerText.includes('变更代码字体') ?? false,
    highlightPresent: root?.innerText.includes('代码高亮') ?? false,
    lightPalettePresent: root?.innerText.includes('亮色') ?? false,
    darkPalettePresent: root?.innerText.includes('暗色') ?? false,
    colorInputs: root?.querySelectorAll('.dcr-colorHex').length ?? 0,
    colorSwatches: root?.querySelectorAll('.dcr-colorSwatch').length ?? 0,
    previewPresent: root?.querySelector('.dcr-themePreview') !== null,
    topHighlightTabPresent: [...document.querySelectorAll('[role="tab"]')].some((node) => node.textContent.trim() === '代码高亮'),
    generalFontCount: [...document.querySelectorAll('input[aria-label="变更代码字体"]')].filter((node) => !root?.contains(node)).length,
    settingsOpened: ${settingsOpened},
    reviewSettingsCardOpened: ${reviewSettingsCardOpened},
  };
})()`);
await evaluate(`(() => {
  const button = [...document.querySelectorAll('button')].find((node) => node.getAttribute('aria-label') === '关闭设置' || node.textContent.trim() === '关闭');
  button?.click();
})()`);

console.log(JSON.stringify({ initial, final, changesView, innerResized, resized, closed, settingsView, errors }, null, 2));
if (final.hasChangesTab) throw new Error("changes still renders as a conversation tab");
if (!final.hasSidebarAction) throw new Error("changes sidebar action is missing");
if (final.sidebarAction === null || final.sidebarAction.right < final.viewport.width - 220) throw new Error("collapsed changes action is not in the top-right utility area");
if (!changesView.present) throw new Error("changes sidebar did not render");
if (changesView.heading?.tag !== 'H2' || changesView.heading.text !== '变更') throw new Error("changes title is not a semantic rendered heading");
if (final.center === null || changesView.center === null || final.center.right - changesView.center.right < 280) throw new Error("opening changes did not allocate a real right column");
if (changesView.center.x > final.center.x + 1) throw new Error("opening changes introduced blank space on the conversation's left");
if (changesView.panel.x + 1 < changesView.center.right) throw new Error("changes sidebar overlaps the conversation column");
if (resized === null || resized.panel.width <= 520 || Math.abs(resized.panel.width - changesView.panel.width) < 40 || Math.abs(changesView.center.width - resized.center.width) < 40) throw new Error("changes sidebar did not resize beyond the old 520px limit");
if (changesView.diffRows > 0 && (!changesView.fileSearchPresent || changesView.topFileSelectPresent || Math.abs(changesView.filePane.x - changesView.diffPane.right) > 1)) throw new Error("file tree is not directly to the right of the diff");
if (changesView.diffRows > 0 && (innerResized === null || innerResized.filePane.width - changesView.filePane.width < 40 || changesView.diffPane.width - innerResized.diffPane.width < 40)) throw new Error("code-to-file-tree divider did not resize both columns");
if (changesView.syntaxColors.length < 3 || !changesView.syntaxColors.some((color) => color.includes('--dcr-syntax-keyword')) || !changesView.syntaxColors.some((color) => color.includes('--dcr-syntax-number'))) throw new Error(`bundled Shiki did not emit detailed palette tokens: ${JSON.stringify(changesView.syntaxColors)}`);
if (/\.(?:js|jsx|ts|tsx|mjs|cjs)$/i.test(changesView.highlightedFile ?? '') && (changesView.renderedSyntaxColors.length < 3 || !changesView.renderedSyntaxColors.some((color) => color.includes('--dcr-syntax-keyword')))) throw new Error(`syntax tokens were not rendered in the diff DOM: ${JSON.stringify(changesView.renderedSyntaxColors)}`);
if (changesView.fileTreeLabels.some((label) => /^[a-z]:\\/i.test(label))) throw new Error("file tree leaked absolute Windows paths");
if (closed.panelPresent || closed.center === null || Math.abs(closed.center.x - final.center.x) > 1 || Math.abs(closed.center.right - final.center.right) > 1) throw new Error("closing changes did not restore the conversation layout");
if (!changesView.codeFont.includes('Microsoft YaHei')) throw new Error(`diff code font was not applied inside the renderer: ${changesView.codeFont}`);
if (final.hasHorizontalOverflow || changesView.rootOverflowX || changesView.documentOverflowX) throw new Error("changes sidebar causes horizontal page overflow");
if (!settingsView.entryPresent || !settingsView.fontPresent || !settingsView.highlightPresent || settingsView.topHighlightTabPresent || settingsView.generalFontCount !== 0 || !settingsView.lightPalettePresent || !settingsView.darkPalettePresent || settingsView.colorInputs < 20 || settingsView.colorInputs !== settingsView.colorSwatches || !settingsView.previewPresent) throw new Error(`dsh-code-review plugin settings card is incomplete or duplicated: ${JSON.stringify(settingsView)}`);
if (verificationPrompt) {
  if (!final.summaryTexts.some((text) => /已编辑 1 个文件 · \d+ 行/.test(text))) throw new Error("completed-turn line summary is missing");
  if (changesView.gapLabels.length === 0) throw new Error("omitted unchanged-line count is missing");
  if (changesView.diffRows < 2 || changesView.lineNumbers.length === 0) throw new Error("line-numbered diff rows are missing");
}
if (undoRequested && !final.summaryTexts.some((text) => /已撤销 1 个文件的变更/.test(text))) throw new Error("undo did not update the completed-turn summary");
if (errors.length > 0) process.exitCode = 2;
socket.close();
