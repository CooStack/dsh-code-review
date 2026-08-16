window.__ModuleLoader__.load({
  id: "dsh-code-review",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const React = require("react");
    const ReactDOM = require("react-dom");
    const {
      DiffBlock,
      Menu,
      IconCodeOutline16,
      IconRefreshOutline16,
      IconChevronDownOutline14,
      IconChevronRightOutline14,
      IconWarningOutline16,
      IconFolderClose16,
      IconFolderOpen16,
      IconFolderOpenOutline16,
      IconCloseOutline16,
    } = require("@deepseek-ai/dsh-client-ui-primitives");
    const h = React.createElement;
    const { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } = React;
    const API_PATH = "/api/dsh-code-review";
    // Keep the full multi-file view bounded; larger diffs use the focused file view.
    const MAX_MULTI_FILE_CHANGED_LINES = 160;
    // Location data key must equal the owning Definition kind.
    const LOCATION_KEY = "dsh-code-review-turn";
    const NODE_KIND = "code-review-summary";
    const FONT_STORAGE_KEY = "dsh-code-review/font";
    const SIDEBAR_WIDTH_STORAGE_KEY = "dsh-code-review/sidebar-width";
    const DEFAULT_FONT_FAMILY = "Microsoft YaHei";
    const DEFAULT_SIDEBAR_WIDTH = 720;
    const FILE_PANE_WIDTH_STORAGE_KEY = "dsh-code-review/file-pane-width";
    const DEFAULT_FILE_PANE_WIDTH = 260;
    const HIGHLIGHT_STORAGE_KEY = "dsh-code-review/theme-colors/v1";
    const HEX_COLOR = /^#[0-9a-f]{6}$/i;
    const HIGHLIGHT_FIELDS = [
      ["语法", [
        ["syntax-plain", "普通文本"], ["syntax-comment", "注释"], ["syntax-keyword", "关键字"],
        ["syntax-string", "字符串"], ["syntax-number", "数字"], ["syntax-function", "函数"],
        ["syntax-type", "类型 / 类名"], ["syntax-property", "属性"], ["syntax-variable", "变量 / 参数"],
        ["syntax-constant", "常量"], ["syntax-operator", "操作符"], ["syntax-punctuation", "标点"],
      ]],
      ["差异", [
        ["diff-context-bg", "未修改行背景"], ["diff-context-fg", "未修改行文字"],
        ["diff-added-bg", "新增行背景"], ["diff-added-fg", "新增行标记"],
        ["diff-removed-bg", "删除行背景"], ["diff-removed-fg", "删除行标记"],
        ["diff-gutter-bg", "普通行号背景"], ["diff-gutter-fg", "普通行号文字"],
        ["diff-gutter-added-bg", "新增行号背景"], ["diff-gutter-added-fg", "新增行号文字"],
        ["diff-gutter-removed-bg", "删除行号背景"], ["diff-gutter-removed-fg", "删除行号文字"],
        ["diff-gap-bg", "折叠区域背景"], ["diff-gap-fg", "折叠区域文字"],
      ]],
    ];
    const DEFAULT_HIGHLIGHT_PALETTES = {
      light: {
        "syntax-plain": "#24292F", "syntax-comment": "#5F6973", "syntax-keyword": "#9B2C6F",
        "syntax-string": "#0B6B46", "syntax-number": "#9A4A00", "syntax-function": "#7A4B00",
        "syntax-type": "#145A8D", "syntax-property": "#6941C6", "syntax-variable": "#3E4C59",
        "syntax-constant": "#B42318", "syntax-operator": "#49515A", "syntax-punctuation": "#58616B",
        "diff-context-bg": "#FFFFFF", "diff-context-fg": "#24292F", "diff-added-bg": "#EAF7EE",
        "diff-added-fg": "#167744", "diff-removed-bg": "#FDECEC", "diff-removed-fg": "#B42318",
        "diff-gutter-bg": "#F6F8FA", "diff-gutter-fg": "#66707A", "diff-gutter-added-bg": "#DDF2E4",
        "diff-gutter-added-fg": "#167744", "diff-gutter-removed-bg": "#F8DADA", "diff-gutter-removed-fg": "#B42318",
        "diff-gap-bg": "#EEF1F4", "diff-gap-fg": "#5B6470",
      },
      dark: {
        "syntax-plain": "#E6EDF3", "syntax-comment": "#8B949E", "syntax-keyword": "#FF7AB2",
        "syntax-string": "#79C99E", "syntax-number": "#F2A65A", "syntax-function": "#F2C56B",
        "syntax-type": "#69B7E6", "syntax-property": "#C9A7FF", "syntax-variable": "#CBD5E1",
        "syntax-constant": "#FF8A80", "syntax-operator": "#B7C0CC", "syntax-punctuation": "#9DA7B3",
        "diff-context-bg": "#111418", "diff-context-fg": "#E6EDF3", "diff-added-bg": "#152A1D",
        "diff-added-fg": "#62C983", "diff-removed-bg": "#321B1D", "diff-removed-fg": "#FF8A80",
        "diff-gutter-bg": "#1B2026", "diff-gutter-fg": "#AAB4C0", "diff-gutter-added-bg": "#1D3827",
        "diff-gutter-added-fg": "#62C983", "diff-gutter-removed-bg": "#422426", "diff-gutter-removed-fg": "#FF8A80",
        "diff-gap-bg": "#242A31", "diff-gap-fg": "#AAB4C0",
      },
    };
    const LEGACY_FONT_FAMILIES = {
      "microsoft-yahei": DEFAULT_FONT_FAMILY,
      system: "Segoe UI",
      dengxian: "DengXian",
      simsun: "SimSun",
      consolas: "Consolas",
    };

    const CSS = `
.dcr-sidebarToggle{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:5px;height:28px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);padding:0 8px;font:inherit;font-size:12px;line-height:18px;cursor:pointer}.dcr-sidebarToggle:hover,.dcr-sidebarToggle[aria-pressed=true]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.dcr-sidebarToggle:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.dcr-frameChangesOpen{grid-template-columns:var(--dcr-shell-sidebar-width) minmax(0,1fr) var(--dcr-sidebar-width)!important}
.dcr-sidebarPanel{box-sizing:border-box;display:flex;min-width:0;position:absolute;right:0;z-index:30;overflow:hidden;border-left:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);box-shadow:-8px 0 24px color-mix(in srgb,#000 10%,transparent);pointer-events:auto}.dcr-sidebarResizeHandle{position:absolute;z-index:50;top:0;bottom:0;left:0;width:8px;cursor:col-resize;touch-action:none}.dcr-sidebarResizeHandle:after{content:"";position:absolute;top:50%;left:2px;width:3px;height:40px;transform:translateY(-50%);border-radius:2px;background:var(--dsw-alias-border-l2);opacity:0;transition:opacity var(--ds-transition-duration-fast)}.dcr-sidebarResizeHandle:hover:after,.dcr-sidebarResizeHandle[data-dragging]:after{opacity:1}body:has([role="dialog"][aria-modal="true"]) .dcr-sidebarPanel,body:has([role="dialog"][aria-modal="true"]) .dcr-sidebarResizeHandle{display:none!important}
.dcr-review{box-sizing:border-box;display:flex;flex-direction:column;width:100%;height:100%;min-height:0;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}
.dcr-reviewHeader{box-sizing:border-box;display:flex;flex-direction:column;gap:9px;flex:none;padding:10px;border-bottom:1px solid var(--dsw-alias-border-l2)}.dcr-reviewHeaderTop{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}.dcr-closeButton{flex:none}
.dcr-titleGroup{display:flex;align-items:center;gap:8px;min-width:0}.dcr-title{margin:0;font-size:16px;font-weight:600;line-height:24px;letter-spacing:0;white-space:nowrap}.dcr-lineTotal{color:var(--dsw-alias-label-secondary);font-size:11px;white-space:nowrap}.dcr-stats{display:flex;gap:6px;font-size:11px}.dcr-add{color:var(--dsw-alias-state-success-primary)}.dcr-del{color:var(--dsw-alias-state-error-primary)}
.dcr-controls{display:flex;align-items:center;gap:6px;min-width:0}.dcr-turnMenu{flex:1;min-width:0}.dcr-turnPicker{box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;height:30px;min-width:0;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);padding:0 8px;font:inherit;font-size:11px;cursor:pointer}.dcr-turnPicker:hover:not(:disabled),.dcr-turnPicker[aria-expanded=true]{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l1)}.dcr-turnPicker:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}.dcr-turnPicker:disabled{cursor:default;color:var(--dsw-alias-label-secondary)}.dcr-turnPickerLabel{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dcr-turnPickerSingle svg{opacity:.35}.dcr-noTurns{display:flex;align-items:center;flex:1;height:30px;color:var(--dsw-alias-label-secondary);font-size:11px}
.dcr-button{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:5px;height:30px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);padding:0 10px;font-size:12px;line-height:18px;cursor:pointer}.dcr-button:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}.dcr-button:disabled{opacity:.45;cursor:default}.dcr-buttonDanger{color:var(--dsw-alias-state-error-primary)}.dcr-iconButton{width:30px;padding:0}.dcr-cancel{border-color:transparent}
.dcr-main{position:relative;display:grid;grid-template-columns:minmax(0,1fr) var(--dcr-file-pane-width,260px);flex:1;min-height:0;min-width:0}.dcr-fileResizeHandle{position:absolute;z-index:20;top:0;bottom:0;right:calc(var(--dcr-file-pane-width,260px) - 4px);width:8px;cursor:col-resize;touch-action:none}.dcr-fileResizeHandle:after{content:"";position:absolute;top:50%;left:3px;width:2px;height:44px;transform:translateY(-50%);border-radius:2px;background:var(--dsw-alias-border-l2);opacity:0}.dcr-fileResizeHandle:hover:after,.dcr-fileResizeHandle[data-dragging]:after{opacity:1}.dcr-diffPane{min-width:0;min-height:0;overflow:auto;padding:12px 10px 24px}.dcr-filePane{box-sizing:border-box;min-width:0;min-height:0;overflow:hidden;border-left:1px solid var(--dsw-alias-border-l2);display:flex;flex-direction:column;background:var(--dsw-alias-bg-base)}.dcr-fileSearchWrap{position:relative;flex:none;padding:10px}.dcr-fileSearch{box-sizing:border-box;width:100%;height:30px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);padding:0 9px;font-size:11px;outline:none}.dcr-fileSearch:focus{border-color:var(--dsw-alias-brand-primary)}.dcr-fileList{min-height:0;overflow:auto;padding:0 6px 10px}.dcr-fileButton{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;width:100%;min-height:32px;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);padding:6px 7px;text-align:left;cursor:pointer}.dcr-fileButton:hover,.dcr-fileButtonActive{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}.dcr-filePath{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;line-height:18px}.dcr-fileStats{display:flex;gap:4px;font-size:10px;line-height:18px}.dcr-fileEmpty{padding:8px 10px;color:var(--dsw-alias-label-secondary);font-size:11px}.dcr-treeRow{box-sizing:border-box;display:flex;align-items:center;gap:5px;width:100%;height:30px;min-width:0;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);padding:0 6px;text-align:left;font:inherit;font-size:11px;cursor:pointer}.dcr-treeRow:hover,.dcr-treeFileActive{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}.dcr-treeChevron,.dcr-treeIcon{display:grid;place-items:center;flex:none;width:14px;height:16px}.dcr-treeFileIcon{box-sizing:border-box;display:block;width:11px;height:14px;border:1px solid currentColor;border-radius:2px;opacity:.75}.dcr-treeLabel{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dcr-treeStats{display:flex;gap:4px;margin-left:auto;flex:none;font-size:10px}.dcr-workspaceLabel{height:26px;color:var(--dsw-alias-label-primary);font-weight:600}.dcr-empty{display:flex;flex:1;align-items:center;justify-content:center;min-height:180px;color:var(--dsw-alias-label-secondary);font-size:12px}.dcr-error{display:flex;align-items:flex-start;gap:7px;margin:9px 10px 0;border:1px solid var(--dsw-alias-state-error-primary);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-state-error-primary);padding:8px 10px;font-size:12px;line-height:18px}.dcr-largeNotice{display:flex;align-items:center;gap:7px;margin:9px 10px 0;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);padding:7px 9px;font-size:11px;line-height:17px}
.dcr-nativeDiff{--dcr-code-font:var(--dcr-font-family);--ds-font-family-code:var(--dcr-font-family);--dsw-font-markdown-code-block:400 11px/22px var(--dcr-font-family);font-family:var(--dcr-font-family);scroll-margin-top:12px}.dcr-nativeDiff *{font-family:var(--dcr-font-family)!important}.dcr-unified{min-width:0;overflow:hidden;scroll-margin-top:12px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dcr-diff-context-bg);color:var(--dcr-diff-context-fg)}.dcr-unifiedHeader{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:34px;border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);padding:0 8px}.dcr-unifiedPath{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}.dcr-unifiedBody{overflow:auto}.dcr-diffRow{display:grid;grid-template-columns:34px 34px 18px minmax(max-content,1fr);min-height:21px;background:var(--dcr-diff-context-bg);color:var(--dcr-diff-context-fg);font-family:var(--dcr-font-family);font-size:11px;line-height:21px}.dcr-diffRowAdd{background:var(--dcr-diff-added-bg)}.dcr-diffRowDel{background:var(--dcr-diff-removed-bg)}.dcr-lineNo{box-sizing:border-box;color:var(--dcr-diff-gutter-fg);background:var(--dcr-diff-gutter-bg);border-right:1px solid var(--dsw-alias-border-l1);padding:0 5px;text-align:right;user-select:none}.dcr-diffRowAdd .dcr-lineNo{color:var(--dcr-diff-gutter-added-fg);background:var(--dcr-diff-gutter-added-bg)}.dcr-diffRowDel .dcr-lineNo{color:var(--dcr-diff-gutter-removed-fg);background:var(--dcr-diff-gutter-removed-bg)}.dcr-marker{color:var(--dcr-diff-gutter-fg);padding-left:5px;user-select:none}.dcr-diffRowAdd .dcr-marker{color:var(--dcr-diff-added-fg)}.dcr-diffRowDel .dcr-marker{color:var(--dcr-diff-removed-fg)}.dcr-codeLine{min-width:max-content;white-space:pre;padding:0 10px 0 2px;font-family:var(--dcr-font-family)}.dcr-gap{box-sizing:border-box;min-height:28px;border-top:1px solid var(--dsw-alias-border-l2);border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dcr-diff-gap-bg);color:var(--dcr-diff-gap-fg);padding:5px 9px;font-size:11px;line-height:18px}.dcr-gap:first-child{border-top:0}.dcr-inlineFile+.dcr-inlineFile{margin-top:10px}
.dcr-tail{box-sizing:border-box;width:100%;margin:12px 0 2px}.dcr-summary{overflow:hidden;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1)}.dcr-summaryTop{display:flex;align-items:center;gap:10px;min-height:52px;padding:8px 12px}.dcr-summaryIcon{display:grid;place-items:center;flex:none;width:30px;height:30px;border-radius:6px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary)}.dcr-summaryText{min-width:0;flex:1}.dcr-summaryTitle{font-size:13px;font-weight:600;line-height:19px}.dcr-summarySub{color:var(--dsw-alias-label-secondary);font-size:11px;line-height:17px}.dcr-summaryActions{display:flex;align-items:center;gap:6px;flex:none}.dcr-fileRows{border-top:1px solid var(--dsw-alias-border-l2);padding:5px 0}.dcr-fileRow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;width:100%;border:0;background:transparent;color:inherit;padding:5px 12px;text-align:left;font-size:11px;line-height:18px;cursor:pointer}.dcr-fileRow:hover{background:var(--dsw-alias-bg-layer-2)}.dcr-fileRow:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}.dcr-fileRowPath{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary)}.dcr-more{width:100%;border:0;border-top:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);padding:7px 12px;text-align:left;font-size:11px;cursor:pointer}.dcr-more:hover{background:var(--dsw-alias-bg-layer-2)}.dcr-inlineDiff{margin-top:8px}.dcr-inlineError{margin:8px 0 0}.dcr-undone{color:var(--dsw-alias-label-secondary)}
.dcr-pluginCard{box-sizing:border-box;width:100%;max-width:none;margin:0;padding:0;background:transparent;overflow:visible}.dcr-pluginCardHeader{padding:0;border:0;background:transparent}.dcr-pluginCardOpen .dcr-pluginCardHeader{border:0}.dcr-pluginCardToggle{box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;min-height:76px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);padding:14px 16px;text-align:left;cursor:pointer}.dcr-pluginCardToggle:hover{background:var(--dsw-alias-bg-layer-2)}.dcr-pluginCardToggle:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}.dcr-pluginCardTitle{display:block;font-size:15px;font-weight:600;line-height:22px;color:var(--dsw-alias-label-primary)}.dcr-pluginCardDescription{display:block;margin-top:2px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}.dcr-pluginCardBody{margin-top:8px;padding:0 16px 20px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1)}.dcr-pluginHighlightSection{padding-top:16px}.dcr-pluginHighlightSection>h3{margin:0;font-size:15px;line-height:22px;color:var(--dsw-alias-label-primary)}.dcr-pluginHighlightSection>.dcr-highlightIntro{margin-bottom:14px}.dcr-fontMenu{display:block;min-width:0}.dcr-fontMenu>.dcr-fontSettingInput{width:100%}.dcr-fontSetting{box-sizing:border-box;display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,300px);align-items:center;gap:20px;padding:16px 0;border-bottom:1px solid var(--dsw-alias-border-l2)}.dcr-fontSettingText{min-width:0}.dcr-fontSettingTitle{color:var(--dsw-alias-label-primary);font-size:14px;line-height:22px}.dcr-fontSettingHint{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}.dcr-fontControl{display:grid;grid-template-columns:minmax(0,1fr) 34px;gap:6px}.dcr-fontSettingInput{box-sizing:border-box;width:100%;height:34px;min-width:0;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);padding:0 10px;font-size:13px;outline:none}.dcr-fontSettingInput:focus{border-color:var(--dsw-alias-brand-primary)}.dcr-fontLoad{width:34px;height:34px;padding:0}
.dcr-highlightSettings{box-sizing:border-box;width:100%;max-width:1040px;padding:18px 22px 32px;color:var(--dsw-alias-label-primary)}.dcr-highlightSettings h2{margin:0;font-size:18px;line-height:28px;letter-spacing:0}.dcr-highlightIntro{margin:2px 0 18px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}.dcr-highlightToolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px}.dcr-modeTabs{display:inline-flex;padding:2px;border-radius:6px;background:var(--dsw-alias-bg-layer-2)}.dcr-modeTab{height:28px;border:0;border-radius:4px;background:transparent;color:var(--dsw-alias-label-secondary);padding:0 12px;font:inherit;font-size:12px;cursor:pointer}.dcr-modeTab[aria-pressed=true]{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);box-shadow:0 1px 3px color-mix(in srgb,#000 14%,transparent)}.dcr-resetGroup{display:flex;gap:6px}.dcr-paletteSection{padding:0 0 20px}.dcr-paletteSection h3{margin:0 0 8px;font-size:14px;line-height:22px;letter-spacing:0}.dcr-colorGrid{display:grid;grid-template-columns:repeat(2,minmax(260px,1fr));gap:1px 18px;border-top:1px solid var(--dsw-alias-border-l2)}.dcr-colorRow{display:grid;grid-template-columns:minmax(0,1fr) 34px 82px 26px;align-items:center;gap:6px;min-height:42px;border-bottom:1px solid var(--dsw-alias-border-l2)}.dcr-colorLabel{min-width:0;font-size:12px}.dcr-colorSwatch{box-sizing:border-box;width:30px;height:28px;border:1px solid var(--dsw-alias-border-l2);border-radius:5px;background:transparent;padding:2px;cursor:pointer}.dcr-colorHex{box-sizing:border-box;width:82px;height:28px;border:1px solid var(--dsw-alias-border-l2);border-radius:5px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);padding:0 6px;font:12px/18px var(--ds-font-family-code,monospace);text-transform:uppercase}.dcr-colorHex:focus{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}.dcr-colorReset{width:26px;height:26px;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);padding:0;cursor:pointer}.dcr-colorReset:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}.dcr-colorReset:disabled{opacity:.25}.dcr-themePreview{overflow:hidden;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dcr-diff-context-bg);font:12px/22px var(--ds-font-family-code,monospace)}.dcr-previewRow{display:grid;grid-template-columns:32px 18px minmax(0,1fr);min-height:22px;background:var(--dcr-diff-context-bg);color:var(--dcr-diff-context-fg)}.dcr-previewRowAdd{background:var(--dcr-diff-added-bg)}.dcr-previewRowDel{background:var(--dcr-diff-removed-bg)}.dcr-previewNo{background:var(--dcr-diff-gutter-bg);color:var(--dcr-diff-gutter-fg);padding-right:5px;text-align:right}.dcr-previewRowAdd .dcr-previewNo{background:var(--dcr-diff-gutter-added-bg);color:var(--dcr-diff-gutter-added-fg)}.dcr-previewRowDel .dcr-previewNo{background:var(--dcr-diff-gutter-removed-bg);color:var(--dcr-diff-gutter-removed-fg)}.dcr-previewMarker{padding-left:5px}.dcr-previewRowAdd .dcr-previewMarker{color:var(--dcr-diff-added-fg)}.dcr-previewRowDel .dcr-previewMarker{color:var(--dcr-diff-removed-fg)}.dcr-previewCode{white-space:pre;padding-left:5px}.dcr-previewGap{background:var(--dcr-diff-gap-bg);color:var(--dcr-diff-gap-fg);padding:4px 10px;font:11px/18px var(--ds-font-family-code,monospace)}
@media (max-width:760px){.dcr-summaryTop{align-items:flex-start;flex-wrap:wrap}.dcr-summaryActions{width:100%;justify-content:flex-end;padding-left:40px}.dcr-fontSetting{grid-template-columns:1fr;gap:8px}}
`;

    function installStyles() {
      const id = "dsh-code-review/styles";
      if (document.querySelector(`style[data-plugin-css="${id}"]`) !== null) return () => {};
      const tag = document.createElement("style");
      tag.dataset.plugin = "dsh-code-review";
      tag.dataset.pluginCss = id;
      tag.textContent = CSS;
      document.head.appendChild(tag);
      return () => tag.remove();
    }

    function normalizeFontFamily(value) {
      if (typeof value !== "string") return DEFAULT_FONT_FAMILY;
      const trimmed = value.trim();
      if (trimmed === "") return DEFAULT_FONT_FAMILY;
      return LEGACY_FONT_FAMILIES[trimmed] ?? trimmed;
    }

    function fontStack(value) {
      const family = normalizeFontFamily(value);
      const quoted = `"${family.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
      return family === DEFAULT_FONT_FAMILY ? `${quoted}, monospace` : `${quoted}, "${DEFAULT_FONT_FAMILY}", monospace`;
    }

    function readFontPreference() {
      if (typeof localStorage === "undefined") return DEFAULT_FONT_FAMILY;
      try {
        return normalizeFontFamily(localStorage.getItem(FONT_STORAGE_KEY));
      } catch {
        return DEFAULT_FONT_FAMILY;
      }
    }

    function applyFontPreference(value) {
      document.documentElement.style.setProperty("--dcr-font-family", fontStack(value));
    }

    function writeFontPreference(value) {
      const family = normalizeFontFamily(value);
      if (typeof localStorage !== "undefined") {
        try {
          localStorage.setItem(FONT_STORAGE_KEY, family);
        } catch {
          // Storage denial still permits an in-page font change through the CSS variable.
        }
      }
      applyFontPreference(family);
      return family;
    }

    async function querySystemFontFamilies() {
      if (typeof window.queryLocalFonts !== "function") return [DEFAULT_FONT_FAMILY];
      const inventory = await window.queryLocalFonts();
      const families = new Set();
      for (const font of inventory) {
        if (typeof font?.family === "string" && font.family.trim() !== "") families.add(font.family.trim());
      }
      families.add(DEFAULT_FONT_FAMILY);
      return [...families].sort((left, right) => left.localeCompare(right, "zh-Hans-CN", { sensitivity: "base", numeric: true }));
    }

    function rankFontCandidates(fonts, draft) {
      const query = String(draft ?? "").trim().toLocaleLowerCase();
      return [...new Set(fonts.filter((font) => typeof font === "string" && font.trim() !== ""))].sort((left, right) => {
        if (query === "") return left.localeCompare(right, "zh-Hans-CN", { sensitivity: "base", numeric: true });
        const a = left.toLocaleLowerCase();
        const b = right.toLocaleLowerCase();
        const score = (value) => value === query ? 0 : value.startsWith(query) ? 1 : value.includes(query) ? 2 : 3;
        return score(a) - score(b) || a.localeCompare(b, "zh-Hans-CN", { sensitivity: "base", numeric: true });
      });
    }

    function FontSettingsRow({ getFont, setFont }) {
      const [fontFamily, setFontFamily] = useState(() => getFont());
      const committedFont = useRef(fontFamily);
      const [fonts, setFonts] = useState(() => [fontFamily]);
      const [loading, setLoading] = useState(false);
      const [open, setOpen] = useState(false);
      const [fontError, setFontError] = useState(null);
      const rankedFonts = useMemo(() => rankFontCandidates(fonts, fontFamily), [fonts, fontFamily]);
      const loadFonts = async () => {
        setLoading(true);
        try {
          const next = await querySystemFontFamilies();
          const activeFont = committedFont.current;
          setFonts(next.includes(activeFont) ? next : [activeFont, ...next]);
          setFontError(null);
        } catch (cause) {
          setFontError(cause instanceof Error ? cause.message : String(cause));
        } finally {
          setLoading(false);
        }
      };
      const selectFont = (value) => {
        const family = normalizeFontFamily(value);
        committedFont.current = setFont(family);
        setFontFamily(family);
        setOpen(false);
      };
      const anchor = h("input", {
        className: "dcr-fontSettingInput",
        type: "text",
        value: fontFamily,
        style: fontFamily.trim() === "" ? undefined : { fontFamily: fontStack(fontFamily) },
        "aria-label": "变更代码字体",
        "aria-autocomplete": "list",
        onFocus: () => setOpen(true),
        onChange: (event) => { setFontFamily(event.target.value); setOpen(true); },
        onKeyDown: (event) => {
          if (event.key === "Enter" && rankedFonts[0] !== undefined) {
            event.preventDefault();
            selectFont(rankedFonts[0]);
          } else if (event.key === "Escape") setOpen(false);
        },
      });
      return h("div", { className: "dcr-fontSetting" },
        h("div", { className: "dcr-fontSettingText" },
          h("div", { className: "dcr-fontSettingTitle" }, "变更代码字体"),
          h("div", { className: "dcr-fontSettingHint" }, fontError ?? (fontFamily === committedFont.current ? `当前已应用：${committedFont.current}` : `待选择字体 · 当前已应用：${committedFont.current}`)),
        ),
        h("div", { className: "dcr-fontControl" },
          h(Menu, {
            className: "dcr-fontMenu",
            open: open && rankedFonts.length > 0,
            anchor,
            items: rankedFonts.map((font) => ({ id: font, label: font })),
            selectedId: rankedFonts[0] ?? committedFont.current,
            compact: true,
            portal: true,
            onSelect: selectFont,
            onClose: () => setOpen(false),
          }),
          h("button", {
            type: "button",
            className: "dcr-button dcr-fontLoad",
            disabled: loading,
            onClick: loadFonts,
            title: "读取系统字体",
            "aria-label": "读取系统字体",
          }, h(IconRefreshOutline16, { size: 14 })),
        ),
      );
    }

    const HIGHLIGHT_KEYS = HIGHLIGHT_FIELDS.flatMap(([, fields]) => fields.map(([key]) => key));

    function readHighlightOverrides() {
      if (typeof localStorage === "undefined") return { light: {}, dark: {} };
      try {
        const parsed = JSON.parse(localStorage.getItem(HIGHLIGHT_STORAGE_KEY) ?? "{}");
        const clean = { light: {}, dark: {} };
        for (const mode of ["light", "dark"]) {
          const source = parsed?.[mode];
          if (typeof source !== "object" || source === null) continue;
          for (const key of HIGHLIGHT_KEYS) {
            if (typeof source[key] === "string" && HEX_COLOR.test(source[key])) clean[mode][key] = source[key].toUpperCase();
          }
        }
        return clean;
      } catch {
        return { light: {}, dark: {} };
      }
    }

    function writeHighlightOverrides(overrides) {
      if (typeof localStorage === "undefined") return;
      try {
        localStorage.setItem(HIGHLIGHT_STORAGE_KEY, JSON.stringify({ version: 1, light: overrides.light, dark: overrides.dark }));
      } catch {
        // The active page can still use the in-memory palette when storage is denied.
      }
    }

    function paletteFor(overrides, mode) {
      return { ...DEFAULT_HIGHLIGHT_PALETTES[mode], ...overrides[mode] };
    }

    function paletteStyle(palette) {
      return Object.fromEntries(HIGHLIGHT_KEYS.map((key) => [`--dcr-${key}`, palette[key]]));
    }

    function currentColorScheme(theme) {
      const scheme = theme?.getTheme?.().active?.colorScheme;
      if (scheme === "light" || scheme === "dark") return scheme;
      return document.body?.hasAttribute?.("data-ds-dark-theme") ? "dark" : "light";
    }

    function createHighlightStore(theme) {
      let overrides = readHighlightOverrides();
      let revision = 0;
      let scheme = currentColorScheme(theme);
      let snapshot = { revision, scheme, overrides };
      const listeners = new Set();
      const publish = () => {
        revision += 1;
        snapshot = { revision, scheme, overrides };
        for (const listener of listeners) listener();
      };
      const persist = () => {
        writeHighlightOverrides(overrides);
        publish();
      };
      return {
        getSnapshot: () => snapshot,
        subscribe(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        setScheme(next) {
          if ((next !== "light" && next !== "dark") || next === scheme) return;
          scheme = next;
          publish();
        },
        setColor(mode, key, value) {
          if (!HEX_COLOR.test(value) || !HIGHLIGHT_KEYS.includes(key)) return false;
          const normalized = value.toUpperCase();
          const nextMode = { ...overrides[mode] };
          if (normalized === DEFAULT_HIGHLIGHT_PALETTES[mode][key]) delete nextMode[key];
          else nextMode[key] = normalized;
          overrides = { ...overrides, [mode]: nextMode };
          persist();
          return true;
        },
        resetColor(mode, key) {
          if (!(key in overrides[mode])) return;
          const nextMode = { ...overrides[mode] };
          delete nextMode[key];
          overrides = { ...overrides, [mode]: nextMode };
          persist();
        },
        resetMode(mode) {
          overrides = { ...overrides, [mode]: {} };
          persist();
        },
        resetAll() {
          overrides = { light: {}, dark: {} };
          persist();
        },
      };
    }

    function HighlightColorRow({ mode, fieldKey, label, color, customized, store }) {
      const [draft, setDraft] = useState(color);
      useEffect(() => setDraft(color), [color]);
      const commit = (value) => {
        setDraft(value);
        if (HEX_COLOR.test(value)) store.setColor(mode, fieldKey, value);
      };
      return h("div", { className: "dcr-colorRow" },
        h("span", { className: "dcr-colorLabel" }, label),
        h("input", {
          type: "color",
          className: "dcr-colorSwatch",
          value: color,
          "aria-label": `${label}颜色`,
          onChange: (event) => commit(event.target.value),
        }),
        h("input", {
          type: "text",
          className: "dcr-colorHex",
          value: draft,
          maxLength: 7,
          "aria-label": `${label}十六进制颜色`,
          onChange: (event) => commit(event.target.value),
          onBlur: () => { if (!HEX_COLOR.test(draft)) setDraft(color); },
        }),
        h("button", {
          type: "button",
          className: "dcr-colorReset",
          disabled: !customized,
          title: `恢复${label}默认颜色`,
          "aria-label": `恢复${label}默认颜色`,
          onClick: () => store.resetColor(mode, fieldKey),
        }, h(IconRefreshOutline16, { size: 13 })),
      );
    }

    function HighlightPreview({ palette }) {
      const style = paletteStyle(palette);
      const code = (kind, number, marker, children) => h("div", { className: `dcr-previewRow${kind ? ` dcr-previewRow${kind}` : ""}` },
        h("span", { className: "dcr-previewNo" }, number),
        h("span", { className: "dcr-previewMarker" }, marker),
        h("code", { className: "dcr-previewCode" }, children),
      );
      return h("div", { className: "dcr-themePreview", style, "aria-label": "代码高亮配色预览" },
        code("", "8", " ", h(React.Fragment, null,
          h("span", { style: { color: "var(--dcr-syntax-keyword)" } }, "const"), " ",
          h("span", { style: { color: "var(--dcr-syntax-variable)" } }, "message"), " ",
          h("span", { style: { color: "var(--dcr-syntax-operator)" } }, "="), " ",
          h("span", { style: { color: "var(--dcr-syntax-string)" } }, "\"ready\""),
          h("span", { style: { color: "var(--dcr-syntax-punctuation)" } }, ";"),
        )),
        code("Del", "9", "-", h("span", { style: { color: "var(--dcr-syntax-comment)" } }, "// old implementation")),
        h("div", { className: "dcr-previewGap" }, "4 行未修改"),
        code("Add", "14", "+", h(React.Fragment, null,
          h("span", { style: { color: "var(--dcr-syntax-function)" } }, "render"),
          h("span", { style: { color: "var(--dcr-syntax-punctuation)" } }, "("),
          h("span", { style: { color: "var(--dcr-syntax-number)" } }, "42"),
          h("span", { style: { color: "var(--dcr-syntax-punctuation)" } }, ");"),
        )),
      );
    }

    function HighlightSettingsContent({ highlightStore }) {
      const snapshot = useSyncExternalStore(highlightStore.subscribe, highlightStore.getSnapshot, highlightStore.getSnapshot);
      const [mode, setMode] = useState(snapshot.scheme);
      const palette = paletteFor(snapshot.overrides, mode);
      return h(React.Fragment, null,
        h("div", { className: "dcr-highlightToolbar" },
          h("div", { className: "dcr-modeTabs", role: "group", "aria-label": "编辑配色方案" },
            h("button", { type: "button", className: "dcr-modeTab", "aria-pressed": mode === "light", onClick: () => setMode("light") }, "亮色"),
            h("button", { type: "button", className: "dcr-modeTab", "aria-pressed": mode === "dark", onClick: () => setMode("dark") }, "暗色"),
          ),
          h("div", { className: "dcr-resetGroup" },
            h("button", { type: "button", className: "dcr-button", onClick: () => highlightStore.resetMode(mode) }, "恢复当前方案"),
            h("button", { type: "button", className: "dcr-button", onClick: () => highlightStore.resetAll() }, "全部恢复默认"),
          ),
        ),
        h(HighlightPreview, { palette }),
        HIGHLIGHT_FIELDS.map(([section, fields]) => h("section", { className: "dcr-paletteSection", key: section },
          h("h3", null, section),
          h("div", { className: "dcr-colorGrid" }, fields.map(([fieldKey, label]) => h(HighlightColorRow, {
            key: fieldKey,
            mode,
            fieldKey,
            label,
            color: palette[fieldKey],
            customized: fieldKey in snapshot.overrides[mode],
            store: highlightStore,
          }))),
        )),
      );
    }

    function HighlightSettingsTab({ highlightStore }) {
      return h("main", { className: "dcr-highlightSettings" },
        h("h2", null, "代码高亮"),
        h("p", { className: "dcr-highlightIntro" }, "配色方案 · 可分别编辑亮色和暗色界面使用的颜色"),
        h(HighlightSettingsContent, { highlightStore }),
      );
    }

    function CodeReviewPluginCard({ highlightStore, getFont, setFont }) {
      const [open, setOpen] = useState(false);
      return h("article", { className: `dcr-pluginCard${open ? " dcr-pluginCardOpen" : ""}` },
        h("header", { className: "dcr-pluginCardHeader" },
          h("button", { type: "button", className: "dcr-pluginCardToggle", "aria-expanded": open, onClick: () => setOpen((value) => !value) },
            h("span", null,
              h("span", { className: "dcr-pluginCardTitle" }, "dsh-code-review"),
              h("span", { className: "dcr-pluginCardDescription" }, "代码变更、字体和代码高亮设置"),
            ),
            open ? h(IconChevronDownOutline14, { size: 14 }) : h(IconChevronRightOutline14, { size: 14 }),
          ),
        ),
        open && h("div", { className: "dcr-pluginCardBody" },
          h(FontSettingsRow, { getFont, setFont }),
          h("section", { className: "dcr-pluginHighlightSection" },
            h("h3", null, "代码高亮"),
            h("p", { className: "dcr-highlightIntro" }, "配色方案 · 可分别编辑亮色和暗色界面使用的颜色"),
            h(HighlightSettingsContent, { highlightStore }),
          ),
        ),
      );
    }

    function isObject(value) {
      return typeof value === "object" && value !== null && !Array.isArray(value);
    }

    function normalizeDiffs(value) {
      if (!Array.isArray(value)) return [];
      const diffs = [];
      for (const item of value) {
        if (!isObject(item) || typeof item.path !== "string" || typeof item.newText !== "string") continue;
        if (item.oldText !== null && typeof item.oldText !== "string") continue;
        diffs.push({ path: item.path, oldText: item.oldText, newText: item.newText });
      }
      return diffs;
    }

    function lineCount(text) {
      if (text === null || text === "") return 0;
      return (text.endsWith("\n") ? text.slice(0, -1) : text).split("\n").length;
    }

    function statsForDiffs(diffs) {
      let added = 0;
      let removed = 0;
      for (const diff of diffs) {
        added += lineCount(diff.newText);
        removed += lineCount(diff.oldText);
      }
      return { added, removed };
    }

    function isLargeDiff(changedLines) {
      return Number.isFinite(changedLines) && changedLines > MAX_MULTI_FILE_CHANGED_LINES;
    }

    function fileAnchorId(path) {
      return `dcr-file-${encodeURIComponent(path)}`;
    }

    function scrollToFile(path) {
      if (typeof document === "undefined") return;
      const target = document.getElementById(fileAnchorId(path));
      if (target !== null && typeof target.scrollIntoView === "function") target.scrollIntoView({ block: "start" });
    }

    function readSidebarWidthPreference() {
      if (typeof localStorage === "undefined") return DEFAULT_SIDEBAR_WIDTH;
      try {
        const raw = localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
        if (raw === null) return DEFAULT_SIDEBAR_WIDTH;
        const stored = Number(raw);
        return Number.isFinite(stored) && stored > 0 ? stored : DEFAULT_SIDEBAR_WIDTH;
      } catch {
        return DEFAULT_SIDEBAR_WIDTH;
      }
    }

    function writeSidebarWidthPreference(width) {
      if (typeof localStorage !== "undefined") {
        try {
          localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(width));
        } catch {
          // A denied preference write only makes this width session-local.
        }
      }
    }

    function sidebarWidthFromPointer(frameRight, leftBoundary, pointerX) {
      const available = Math.max(0, frameRight - leftBoundary);
      return Math.max(0, Math.min(available, frameRight - pointerX));
    }

    function readFilePaneWidthPreference() {
      if (typeof localStorage === "undefined") return DEFAULT_FILE_PANE_WIDTH;
      try {
        const raw = localStorage.getItem(FILE_PANE_WIDTH_STORAGE_KEY);
        if (raw === null) return DEFAULT_FILE_PANE_WIDTH;
        const stored = Number(raw);
        return Number.isFinite(stored) && stored >= 0 ? stored : DEFAULT_FILE_PANE_WIDTH;
      } catch {
        return DEFAULT_FILE_PANE_WIDTH;
      }
    }

    function writeFilePaneWidthPreference(width) {
      if (typeof localStorage === "undefined") return;
      try {
        localStorage.setItem(FILE_PANE_WIDTH_STORAGE_KEY, String(width));
      } catch {
        // The divider remains usable for this page even if persistence is denied.
      }
    }

    function filePaneWidthFromPointer(mainLeft, mainRight, pointerX) {
      return Math.max(0, Math.min(mainRight - mainLeft, mainRight - pointerX));
    }

    function frameSidebarWidth(frame) {
      const match = /^\s*([\d.]+)px/.exec(frame.style.gridTemplateColumns);
      return match === null ? 0 : Number(match[1]);
    }

    function createSidebarController(layout) {
      let snapshot = { sessionId: null, navigation: null, width: readSidebarWidthPreference() };
      let collapsedNavigation = false;
      let layoutCheck = 0;
      const listeners = new Set();
      const publish = (next) => {
        snapshot = next;
        for (const listener of listeners) listener();
      };
      const ensureConversationSpace = (sessionId) => {
        if (typeof window.requestAnimationFrame !== "function") return;
        const check = ++layoutCheck;
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
          if (check !== layoutCheck || snapshot.sessionId !== sessionId) return;
          const frame = document.querySelector("[data-shell-overlay]")?.parentElement;
          if (frame === null || frame === undefined) return;
          const leftWidth = frameSidebarWidth(frame);
          const availableCenter = frame.getBoundingClientRect().width - leftWidth - snapshot.width;
          if (availableCenter < 640 && !frame.hasAttribute("data-sidebar-collapsed")) {
            collapsedNavigation = true;
            layout.toggleSidebar();
          }
        }));
      };
      return {
        getSnapshot: () => snapshot,
        subscribe(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        open(sessionId, navigation = null) {
          publish({ ...snapshot, sessionId, navigation });
          ensureConversationSpace(sessionId);
        },
        resize(width) {
          if (!Number.isFinite(width) || width < 0) return;
          publish({ ...snapshot, width });
          writeSidebarWidthPreference(width);
        },
        close() {
          if (snapshot.sessionId === null) return;
          layoutCheck += 1;
          publish({ ...snapshot, sessionId: null, navigation: null });
          const frame = document.querySelector("[data-shell-overlay]")?.parentElement;
          if (collapsedNavigation && frame?.hasAttribute("data-sidebar-collapsed")) layout.toggleSidebar();
          collapsedNavigation = false;
        },
        toggle(sessionId) {
          if (snapshot.sessionId === sessionId) this.close();
          else this.open(sessionId);
        },
      };
    }

    function groupFiles(diffs) {
      const grouped = new Map();
      for (const diff of diffs) {
        const file = grouped.get(diff.path) ?? { path: diff.path, diffs: [], added: 0, removed: 0 };
        file.diffs.push(diff);
        file.added += lineCount(diff.newText);
        file.removed += lineCount(diff.oldText);
        grouped.set(diff.path, file);
      }
      return [...grouped.values()].sort((left, right) => left.path.localeCompare(right.path));
    }

    function normalizedPath(value) {
      return String(value ?? "").replace(/\\/g, "/").replace(/\/+$/, "");
    }

    function relativeFileInfo(file) {
      const path = normalizedPath(file.path);
      const cwd = normalizedPath(file.cwd);
      const absolute = /^[a-z]:\//i.test(path) || path.startsWith("/");
      if (cwd !== "" && path.toLocaleLowerCase().startsWith(`${cwd.toLocaleLowerCase()}/`)) {
        return { workspaceKey: cwd, workspaceLabel: cwd.slice(cwd.lastIndexOf("/") + 1) || cwd, relativePath: path.slice(cwd.length + 1) };
      }
      if (!absolute) {
        return { workspaceKey: cwd, workspaceLabel: cwd.slice(cwd.lastIndexOf("/") + 1) || "工作区", relativePath: path };
      }
      const root = /^[a-z]:/i.exec(path)?.[0] ?? "/";
      return { workspaceKey: root, workspaceLabel: root, relativePath: path.slice(root.length).replace(/^\/+/, "") };
    }

    function finalizeTreeDirectory(raw, name, key, compress = true) {
      let node = {
        type: "directory",
        name,
        key,
        children: [...raw.children.entries()].map(([childName, child]) => child.file === undefined
          ? finalizeTreeDirectory(child, childName, `${key}/${childName}`)
          : { type: "file", name: childName, key: `${key}/${childName}`, file: child.file }),
      };
      node.children.sort((left, right) => left.type === right.type
        ? left.name.localeCompare(right.name, "zh-Hans-CN", { numeric: true })
        : left.type === "directory" ? -1 : 1);
      while (compress && node.children.length === 1 && node.children[0].type === "directory") {
        const child = node.children[0];
        node = { ...child, name: node.name === "" ? child.name : `${node.name}/${child.name}` };
      }
      return node;
    }

    function buildFileTree(files) {
      const groups = new Map();
      for (const file of files) {
        const info = relativeFileInfo(file);
        let group = groups.get(info.workspaceKey);
        if (group === undefined) {
          group = { label: info.workspaceLabel, children: new Map() };
          groups.set(info.workspaceKey, group);
        }
        const parts = info.relativePath.split("/").filter(Boolean);
        if (parts.length === 0) parts.push(file.path);
        let directory = group;
        for (let index = 0; index < parts.length; index += 1) {
          const part = parts[index];
          let child = directory.children.get(part);
          if (child === undefined) {
            child = index === parts.length - 1 ? { file } : { children: new Map() };
            directory.children.set(part, child);
          }
          if (index < parts.length - 1) directory = child;
        }
      }
      const roots = [...groups.entries()].map(([key, group]) => finalizeTreeDirectory(group, group.label, key || "workspace", false));
      if (roots.length === 1) return roots[0].children;
      return roots.sort((left, right) => left.name.localeCompare(right.name, "zh-Hans-CN", { numeric: true }));
    }

    const reviewDefinition = {
      kind: "dsh-code-review-turn",
      target: "chat",
      match(event) {
        if (event.type === "turn/start") return { id: String(event.data.turn), role: "start" };
        if (event.type === "turn/end") return { id: String(event.data.turn), role: "update" };
        if (event.type === "tool/result" && normalizeDiffs(event.data.meta?.diffs).length > 0) {
          return { id: String(event.data.turn), role: "update" };
        }
        return null;
      },
      start(_context, match) {
        return {
          turn: match.event.data.turn,
          diffs: [],
          endSeq: null,
          endTime: null,
        };
      },
      update(context, match) {
        const state = context.state;
        if (match.event.type === "tool/result") {
          return { ...state, diffs: [...state.diffs, ...normalizeDiffs(match.event.data.meta?.diffs)] };
        }
        if (match.event.type === "turn/end") {
          return { ...state, endSeq: match.event.seq, endTime: match.event.time };
        }
        return state;
      },
      buildLocationData(context, scope) {
        const state = context.state;
        if (scope !== "turn" || state === undefined || state.diffs.length === 0) return null;
        return {
          kind: "turn",
          turn: state.turn,
          key: LOCATION_KEY,
          value: { turn: state.turn, diffs: state.diffs },
        };
      },
      buildViewNode(context) {
        const state = context.state;
        if (state === undefined || state.endSeq === null || state.diffs.length === 0) return null;
        return {
          key: context.key,
          kind: NODE_KIND,
          id: context.id,
          target: "chat",
          anchorSeq: state.endSeq - 0.1,
          location: context.start?.location ?? { kind: "unresolved" },
          visibility: "visible",
          data: { turn: state.turn, diffs: state.diffs, time: state.endTime },
        };
      },
    };

    async function requestReview(sessionId, options = {}) {
      const response = options.action === "undo"
        ? await fetch(API_PATH, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-DSH-Code-Review": "1" },
            body: JSON.stringify({ action: "undo", sessionId, turn: options.turn }),
          })
        : await fetch(`${API_PATH}?sessionId=${encodeURIComponent(sessionId)}`, {
            headers: { "X-DSH-Code-Review": "1" },
          });
      let payload;
      try {
        payload = await response.json();
      } catch {
        throw new Error(`变更服务返回了无效响应 (${response.status})`);
      }
      if (!response.ok || payload.ok !== true) throw new Error(payload.error?.message ?? `请求失败 (${response.status})`);
      return payload.state;
    }

    function useReviewState(sessionId, useSession, poll = false) {
      const signal = useSession((snapshot) => `${snapshot.chat.order.length}:${snapshot.running ? 1 : 0}:${snapshot.turnEnds.size}`);
      const [state, setState] = useState(null);
      const [error, setError] = useState(null);
      const refresh = useCallback(async () => {
        try {
          const next = await requestReview(sessionId);
          setState(next);
          setError(null);
          return next;
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
          return null;
        }
      }, [sessionId]);
      useEffect(() => {
        let live = true;
        requestReview(sessionId).then((next) => {
          if (!live) return;
          setState(next);
          setError(null);
        }, (cause) => {
          if (!live) return;
          setError(cause instanceof Error ? cause.message : String(cause));
        });
        return () => { live = false; };
      }, [sessionId, signal]);
      useEffect(() => {
        if (!poll) return undefined;
        const timer = setInterval(() => { void refresh(); }, 1250);
        return () => clearInterval(timer);
      }, [poll, refresh]);
      return { state, setState, error, setError, refresh };
    }

    function Stats({ added, removed }) {
      return h("span", { className: "dcr-stats" },
        h("span", { className: "dcr-add" }, `+${added}`),
        h("span", { className: "dcr-del" }, `-${removed}`),
      );
    }

    function HighlightedText({ runs, text }) {
      if (!Array.isArray(runs) || runs.length === 0) return text === "" ? " " : text;
      return h(React.Fragment, null, runs.map((run, index) => h("span", { key: index, style: { color: run.color } }, run.text)));
    }

    function UnifiedDiffView({ file }) {
      const highlighted = useMemo(() => {
        const engine = window.__DSH_CODE_REVIEW_HIGHLIGHTER__;
        const lang = engine?.languageFromPath(file.path);
        return {
          old: engine?.highlightLines(typeof file.oldText === "string" ? file.oldText : "", lang),
          next: engine?.highlightLines(typeof file.newText === "string" ? file.newText : "", lang),
        };
      }, [file.path, file.oldText, file.newText]);
      if (file.unified === null || file.unified === undefined) {
        return h("section", { id: fileAnchorId(file.path), className: "dcr-nativeDiff", "aria-label": `${file.path} 的代码变更` },
          h(DiffBlock, { diffs: file.diffs, maxLines: 160 }),
        );
      }
      return h("section", { id: fileAnchorId(file.path), className: "dcr-unified", "aria-label": `${file.path} 的代码变更` },
        h("header", { className: "dcr-unifiedHeader" },
          h("span", { className: "dcr-unifiedPath", title: file.path }, file.path),
          h(Stats, { added: file.added, removed: file.removed }),
        ),
        h("div", { className: "dcr-unifiedBody" },
          file.unified.sections.map((section, sectionIndex) => section.kind === "gap"
            ? h("div", { className: "dcr-gap", key: `gap-${sectionIndex}` }, `${section.count} 行未修改`)
            : h(React.Fragment, { key: `hunk-${sectionIndex}` }, section.rows.map((row, rowIndex) => {
                const line = row.kind === "del" ? row.oldLine : row.newLine;
                const runs = row.kind === "del" ? highlighted.old : highlighted.next;
                return h("div", {
                  className: `dcr-diffRow${row.kind === "add" ? " dcr-diffRowAdd" : row.kind === "del" ? " dcr-diffRowDel" : ""}`,
                  key: `${sectionIndex}-${rowIndex}`,
                },
                  h("span", { className: "dcr-lineNo", "aria-label": row.oldLine === null ? undefined : `旧文件第 ${row.oldLine} 行` }, row.oldLine ?? ""),
                  h("span", { className: "dcr-lineNo", "aria-label": row.newLine === null ? undefined : `新文件第 ${row.newLine} 行` }, row.newLine ?? ""),
                  h("span", { className: "dcr-marker", "aria-hidden": true }, row.kind === "add" ? "+" : row.kind === "del" ? "-" : " "),
                  h("code", { className: "dcr-codeLine" }, h(HighlightedText, { runs: line === null ? undefined : runs?.[line - 1], text: row.text })),
                );
              }))),
        ),
      );
    }

    function DiffFiles({ files }) {
      return h(React.Fragment, null, files.map((file) => h("div", { className: "dcr-inlineFile", key: file.path }, h(UnifiedDiffView, { file }))));
    }

    function ErrorNotice({ message, inline = false }) {
      if (!message) return null;
      return h("div", { className: `dcr-error${inline ? " dcr-inlineError" : ""}`, role: "alert" },
        h(IconWarningOutline16, { size: 15 }),
        h("span", null, message),
      );
    }

    function LargeDiffNotice() {
      return h("div", { className: "dcr-largeNotice", role: "status" },
        h(IconWarningOutline16, { size: 15 }),
        h("span", null, "此差异较大，每次仅显示一个文件"),
      );
    }

    function UndoControls({ sessionId, turn, disabled, onState, onError, compact = false }) {
      const [confirming, setConfirming] = useState(false);
      const [pending, setPending] = useState(false);
      useEffect(() => setConfirming(false), [turn]);
      const undo = async () => {
        if (!confirming) {
          setConfirming(true);
          return;
        }
        setPending(true);
        try {
          const next = await requestReview(sessionId, { action: "undo", turn });
          onState(next);
          onError(null);
          setConfirming(false);
        } catch (cause) {
          onError(cause instanceof Error ? cause.message : String(cause));
          setConfirming(false);
        } finally {
          setPending(false);
        }
      };
      return h(React.Fragment, null,
        h("button", {
          type: "button",
          className: `dcr-button dcr-buttonDanger${compact ? "" : ""}`,
          disabled: disabled || pending,
          onClick: undo,
          title: confirming ? "确认恢复本轮修改前的文件内容" : "撤销本轮文件变更",
        }, h(IconRefreshOutline16, { size: 14 }), pending ? "撤销中" : confirming ? "确认撤销" : "撤销"),
        confirming && h("button", {
          type: "button",
          className: "dcr-button dcr-cancel",
          disabled: pending,
          onClick: () => setConfirming(false),
        }, "取消"),
      );
    }

    function ReviewSummaryNode({ node, sessionId, useSession, navigateToChange }) {
      const localDiffs = normalizeDiffs(node.data?.diffs);
      const localFiles = useMemo(() => groupFiles(localDiffs), [node.data]);
      const localStats = useMemo(() => statsForDiffs(localDiffs), [node.data]);
      const { state, setState, error, setError } = useReviewState(sessionId, useSession);
      const [expanded, setExpanded] = useState(false);
      const [showAll, setShowAll] = useState(false);
      const turn = Number(node.data?.turn);
      const remoteTurn = state?.turns.find((entry) => entry.turn === turn);
      const files = remoteTurn?.files ?? localFiles;
      const stats = remoteTurn ?? localStats;
      const changedLines = stats.changedLines ?? stats.added + stats.removed;
      const visibleFiles = showAll ? files : files.slice(0, 3);
      const canUndo = remoteTurn?.canUndo === true;
      const undone = remoteTurn?.undone === true;
      return h("div", { className: "dcr-tail" },
        h("div", { className: "dcr-summary" },
          h("div", { className: "dcr-summaryTop" },
            h("span", { className: "dcr-summaryIcon" }, h(IconCodeOutline16, { size: 16 })),
            h("div", { className: "dcr-summaryText" },
              h("div", { className: `dcr-summaryTitle${undone ? " dcr-undone" : ""}` }, undone ? `已撤销 ${files.length} 个文件的变更` : `已编辑 ${files.length} 个文件 · ${changedLines} 行`),
              h("div", { className: "dcr-summarySub" }, undone ? "文件已恢复到本轮修改前" : `第 ${turn} 轮`, " ", h(Stats, { added: stats.added, removed: stats.removed })),
            ),
            h("div", { className: "dcr-summaryActions" },
              h(UndoControls, {
                sessionId,
                turn,
                disabled: !canUndo,
                onState: setState,
                onError: setError,
                compact: true,
              }),
              h("button", {
                type: "button",
                className: "dcr-button",
                onClick: () => setExpanded((value) => !value),
                "aria-expanded": expanded,
              }, expanded ? "收起" : "审核", h(IconChevronDownOutline14, { size: 13, className: expanded ? "dcr-rotate" : undefined })),
            ),
          ),
          files.length > 0 && h("div", { className: "dcr-fileRows" },
            visibleFiles.map((file) => h("button", {
              type: "button",
              className: "dcr-fileRow",
              key: file.path,
              title: `在变更中查看 ${file.path}`,
              onClick: () => navigateToChange(sessionId, turn, file.path),
            },
              h("span", { className: "dcr-fileRowPath" }, file.path),
              h(Stats, { added: file.added, removed: file.removed }),
            )),
          ),
          files.length > 3 && h("button", {
            type: "button",
            className: "dcr-more",
            onClick: () => setShowAll((value) => !value),
          }, showAll ? "收起文件列表" : `再显示 ${files.length - 3} 个文件`),
        ),
        h(ErrorNotice, { message: error, inline: true }),
        expanded && h("div", { className: "dcr-inlineDiff" }, h(DiffFiles, { files })),
      );
    }

    function useSidebarGeometry(width) {
      const widthRef = useRef(width);
      const updateRef = useRef(() => {});
      const [geometry, setGeometry] = useState({ top: 0, width, height: 0 });
      widthRef.current = width;
      useLayoutEffect(() => {
        const overlay = document.querySelector("[data-shell-overlay]");
        const frame = overlay?.parentElement;
        if (overlay === null || overlay === undefined || frame === null || frame === undefined) return undefined;
        let animationFrame = null;
        frame.classList.add("dcr-frameChangesOpen");
        const setFrameVariable = (name, value) => {
          if (frame.style.getPropertyValue(name) !== value) frame.style.setProperty(name, value);
        };
        const measure = () => {
          animationFrame = null;
          const overlayRect = overlay.getBoundingClientRect();
          const frameRect = frame.getBoundingClientRect();
          const leftWidth = frameSidebarWidth(frame);
          const actualWidth = Math.min(widthRef.current, Math.max(0, frameRect.width - leftWidth));
          setFrameVariable("--dcr-shell-sidebar-width", `${leftWidth}px`);
          setFrameVariable("--dcr-sidebar-width", `${actualWidth}px`);
          const detailsRect = document.querySelector(".dshDesktopDetailsSurface")?.getBoundingClientRect();
          const top = detailsRect === undefined ? 0 : Math.max(0, detailsRect.top - overlayRect.top);
          const height = Math.max(0, overlayRect.height - top);
          setGeometry((current) => current.top === top && current.width === actualWidth && current.height === height
            ? current
            : { top, width: actualWidth, height });
        };
        const schedule = () => {
          if (animationFrame === null) animationFrame = requestAnimationFrame(measure);
        };
        updateRef.current = measure;
        measure();
        const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(schedule) : null;
        resizeObserver?.observe(overlay);
        resizeObserver?.observe(frame);
        const mutationObserver = typeof MutationObserver === "function" ? new MutationObserver(schedule) : null;
        mutationObserver?.observe(frame, { attributes: true, attributeFilter: ["style", "data-sidebar-collapsed"] });
        window.addEventListener("resize", schedule);
        return () => {
          updateRef.current = () => {};
          if (animationFrame !== null) cancelAnimationFrame(animationFrame);
          resizeObserver?.disconnect();
          mutationObserver?.disconnect();
          window.removeEventListener("resize", schedule);
          frame.classList.remove("dcr-frameChangesOpen");
          frame.style.removeProperty("--dcr-shell-sidebar-width");
          frame.style.removeProperty("--dcr-sidebar-width");
        };
      }, []);
      useLayoutEffect(() => updateRef.current(), [width]);
      return geometry;
    }

    function TurnPicker({ state, selectedTurn, onSelect }) {
      const [open, setOpen] = useState(false);
      const turns = state?.turns ?? [];
      if (turns.length === 0) return h("div", { className: "dcr-noTurns" }, "暂无可审核的变更");
      const selected = turns.find((turn) => turn.turn === selectedTurn) ?? turns[0];
      const label = (turn) => `${turn.turn === state.latestTurn ? "上一轮" : `第 ${turn.turn} 轮`} · ${turn.files.length} 个文件 · ${turn.changedLines ?? turn.added + turn.removed} 行${turn.undone ? " · 已撤销" : ""}`;
      const single = turns.length === 1;
      const anchor = h("button", {
        type: "button",
        className: `dcr-turnPicker${single ? " dcr-turnPickerSingle" : ""}`,
        disabled: single,
        "aria-expanded": single ? undefined : open,
        "aria-label": "选择对话轮次",
        onClick: () => setOpen((value) => !value),
      }, h("span", { className: "dcr-turnPickerLabel" }, label(selected)), h(IconChevronDownOutline14, { size: 13 }));
      return h(Menu, {
        className: "dcr-turnMenu",
        open: !single && open,
        anchor,
        items: turns.map((turn) => ({ id: String(turn.turn), label: label(turn) })),
        selectedId: String(selected.turn),
        compact: true,
        portal: true,
        onSelect: (id) => { onSelect(Number(id)); setOpen(false); },
        onClose: () => setOpen(false),
      });
    }

    function collectDirectoryKeys(nodes, output = new Set()) {
      for (const node of nodes) {
        if (node.type !== "directory") continue;
        output.add(node.key);
        collectDirectoryKeys(node.children, output);
      }
      return output;
    }

    function FileTreeNode({ node, depth, expanded, toggle, selectedPath, onSelect }) {
      const paddingLeft = 6 + depth * 14;
      if (node.type === "file") {
        return h("button", {
          type: "button",
          className: `dcr-treeRow${selectedPath === node.file.path ? " dcr-treeFileActive" : ""}`,
          style: { paddingLeft },
          onClick: () => onSelect(node.file.path),
          title: node.file.path,
        },
          h("span", { className: "dcr-treeChevron" }),
          h("span", { className: "dcr-treeIcon" }, h("span", { className: "dcr-treeFileIcon" })),
          h("span", { className: "dcr-treeLabel" }, node.name),
          h("span", { className: "dcr-treeStats" },
            h("span", { className: "dcr-add" }, `+${node.file.added}`),
            h("span", { className: "dcr-del" }, `-${node.file.removed}`),
          ),
        );
      }
      const isOpen = expanded.has(node.key);
      return h(React.Fragment, null,
        h("button", {
          type: "button",
          className: `dcr-treeRow${depth === 0 ? " dcr-workspaceLabel" : ""}`,
          style: { paddingLeft },
          "aria-expanded": isOpen,
          onClick: () => toggle(node.key),
          title: node.name,
        },
          h("span", { className: "dcr-treeChevron" }, isOpen ? h(IconChevronDownOutline14, { size: 13 }) : h(IconChevronRightOutline14, { size: 13 })),
          h("span", { className: "dcr-treeIcon" }, isOpen ? h(IconFolderOpen16, { size: 14 }) : h(IconFolderClose16, { size: 14 })),
          h("span", { className: "dcr-treeLabel" }, node.name),
        ),
        isOpen && node.children.map((child) => h(FileTreeNode, { key: child.key, node: child, depth: depth + 1, expanded, toggle, selectedPath, onSelect })),
      );
    }

    function SidebarFilePane({ files, selectedPath, onSelect }) {
      const [filter, setFilter] = useState("");
      const visibleFiles = useMemo(() => {
        const query = filter.trim().toLocaleLowerCase();
        return query === "" ? files : files.filter((file) => relativeFileInfo(file).relativePath.toLocaleLowerCase().includes(query));
      }, [files, filter]);
      const tree = useMemo(() => buildFileTree(visibleFiles), [visibleFiles]);
      const [expanded, setExpanded] = useState(() => collectDirectoryKeys(tree));
      useEffect(() => {
        const keys = collectDirectoryKeys(tree);
        setExpanded((current) => {
          if (filter.trim() !== "") return keys;
          const next = new Set(current);
          for (const key of keys) next.add(key);
          return next;
        });
      }, [filter, tree]);
      const toggle = (key) => setExpanded((current) => {
        const next = new Set(current);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
      });
      return h("aside", { className: "dcr-filePane", "aria-label": "变更文件" },
        h("div", { className: "dcr-fileSearchWrap" },
          h("input", {
            className: "dcr-fileSearch",
            type: "search",
            value: filter,
            placeholder: "筛选文件…",
            "aria-label": "筛选变更文件",
            onChange: (event) => setFilter(event.target.value),
          }),
        ),
        h("div", { className: "dcr-fileList" },
          visibleFiles.length === 0
            ? h("div", { className: "dcr-fileEmpty" }, "没有匹配的文件")
            : tree.map((node) => h(FileTreeNode, { key: node.key, node, depth: 0, expanded, toggle, selectedPath, onSelect })),
        ),
      );
    }

    function FilePaneResizeHandle({ mainRef, width, onResize }) {
      const [dragging, setDragging] = useState(false);
      const resizeFromPointer = (event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        const rect = mainRef.current?.getBoundingClientRect();
        if (rect === undefined) return;
        onResize(filePaneWidthFromPointer(rect.left, rect.right, event.clientX));
      };
      const resizeBy = (delta) => {
        const rect = mainRef.current?.getBoundingClientRect();
        const available = rect?.width ?? Number.POSITIVE_INFINITY;
        onResize(Math.max(0, Math.min(available, width + delta)));
      };
      return h("div", {
        className: "dcr-fileResizeHandle",
        role: "separator",
        tabIndex: 0,
        "aria-label": "调整代码和文件列表宽度",
        "aria-orientation": "vertical",
        "data-dragging": dragging || undefined,
        onPointerDown: (event) => { event.currentTarget.setPointerCapture(event.pointerId); setDragging(true); },
        onPointerMove: resizeFromPointer,
        onPointerUp: (event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          setDragging(false);
        },
        onPointerCancel: () => setDragging(false),
        onKeyDown: (event) => {
          if (event.key === "ArrowLeft") resizeBy(40);
          else if (event.key === "ArrowRight") resizeBy(-40);
          else return;
          event.preventDefault();
        },
      });
    }

    function ChangesSidebar({ sessionId, useSession, navigation, openPath, onClose, highlightStore }) {
      const { state, setState, error, setError, refresh } = useReviewState(sessionId, useSession, true);
      const highlightSnapshot = useSyncExternalStore(highlightStore.subscribe, highlightStore.getSnapshot, highlightStore.getSnapshot);
      const reviewStyle = paletteStyle(paletteFor(highlightSnapshot.overrides, highlightSnapshot.scheme));
      const [selectedTurn, setSelectedTurn] = useState(navigation?.turn ?? null);
      const [selectedPath, setSelectedPath] = useState(navigation?.path ?? null);
      const [filePaneWidth, setFilePaneWidth] = useState(readFilePaneWidthPreference);
      const [mainWidth, setMainWidth] = useState(0);
      const mainRef = useRef(null);
      const resizeFilePane = (width) => {
        if (!Number.isFinite(width) || width < 0) return;
        setFilePaneWidth(width);
        writeFilePaneWidthPreference(width);
      };
      useEffect(() => {
        if (navigation === null) return;
        setSelectedTurn(navigation.turn);
        setSelectedPath(navigation.path);
      }, [navigation]);
      useEffect(() => {
        if (state === null || state.turns.length === 0) return;
        const exists = state.turns.some((turn) => turn.turn === selectedTurn);
        if (!exists) setSelectedTurn(state.latestTurn ?? state.turns[0].turn);
      }, [state, selectedTurn]);
      const turnState = state?.turns.find((turn) => turn.turn === selectedTurn) ?? null;
      const files = turnState?.files ?? [];
      useLayoutEffect(() => {
        const node = mainRef.current;
        if (node === null || typeof ResizeObserver !== "function") return undefined;
        const observer = new ResizeObserver(() => setMainWidth(node.getBoundingClientRect().width));
        observer.observe(node);
        setMainWidth(node.getBoundingClientRect().width);
        return () => observer.disconnect();
      }, [files.length > 0]);
      useEffect(() => {
        if (files.length === 0) {
          setSelectedPath(null);
          return;
        }
        if (!files.some((file) => file.path === selectedPath)) setSelectedPath(files[0].path);
      }, [files, selectedPath]);
      const selectedFile = files.find((file) => file.path === selectedPath) ?? files[0];
      const changedLines = turnState?.changedLines ?? ((turnState?.added ?? 0) + (turnState?.removed ?? 0));
      const visibleFilePaneWidth = mainWidth > 0 ? Math.min(filePaneWidth, mainWidth) : filePaneWidth;
      if (state === null && error === null) return h("div", { className: "dcr-review", style: reviewStyle }, h("div", { className: "dcr-empty" }, "正在读取变更…"));
      return h("section", { className: "dcr-review", style: reviewStyle, "aria-label": "变更侧栏" },
        h("header", { className: "dcr-reviewHeader" },
          h("div", { className: "dcr-reviewHeaderTop" },
            h("div", { className: "dcr-titleGroup" },
              h("h2", { className: "dcr-title" }, "变更"),
              turnState && h("span", { className: "dcr-lineTotal" }, `${changedLines} 行`),
              turnState && h(Stats, { added: turnState.added, removed: turnState.removed }),
            ),
            h("button", {
              type: "button",
              className: "dcr-button dcr-iconButton dcr-closeButton",
              onClick: onClose,
              title: "关闭变更侧栏",
              "aria-label": "关闭变更侧栏",
            }, h(IconCloseOutline16, { size: 14 })),
          ),
          h("div", { className: "dcr-controls" },
            h(TurnPicker, { state, selectedTurn, onSelect: setSelectedTurn }),
            selectedFile && h("button", {
              type: "button",
              className: "dcr-button dcr-iconButton",
              onClick: () => openPath(selectedFile.path),
              title: `使用系统打开 ${selectedFile.path}`,
              "aria-label": `使用系统打开 ${selectedFile.path}`,
            }, h(IconFolderOpenOutline16, { size: 14 })),
            turnState && h(UndoControls, {
              sessionId,
              turn: turnState.turn,
              disabled: !turnState.canUndo,
              onState: setState,
              onError: setError,
              compact: true,
            }),
            h("button", {
              type: "button",
              className: "dcr-button dcr-iconButton",
              onClick: refresh,
              title: "刷新变更",
              "aria-label": "刷新变更",
            }, h(IconRefreshOutline16, { size: 14 })),
          ),
        ),
        h(ErrorNotice, { message: error }),
        isLargeDiff(changedLines) && files.length > 0 && h(LargeDiffNotice),
        files.length === 0
          ? h("div", { className: "dcr-empty" }, "当前会话还没有代码变更")
          : h("div", {
              className: "dcr-main",
              ref: mainRef,
              style: { "--dcr-file-pane-width": `${visibleFilePaneWidth}px` },
            },
              h(FilePaneResizeHandle, { mainRef, width: visibleFilePaneWidth, onResize: resizeFilePane }),
              h("main", { className: "dcr-diffPane" }, selectedFile && h(UnifiedDiffView, { file: selectedFile })),
              h(SidebarFilePane, { files, selectedPath: selectedFile?.path, onSelect: setSelectedPath }),
            ),
      );
    }

    function ChangesSidebarPanel({ sidebarController, width, ...props }) {
      const geometry = useSidebarGeometry(width);
      const [dragging, setDragging] = useState(false);
      const resizeFromPointer = (event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        const frame = document.querySelector("[data-shell-overlay]")?.parentElement;
        if (frame === null || frame === undefined) return;
        const frameRect = frame.getBoundingClientRect();
        sidebarController.resize(sidebarWidthFromPointer(frameRect.right, frameRect.left + frameSidebarWidth(frame), event.clientX));
      };
      return h("aside", {
        className: "dcr-sidebarPanel",
        style: { top: geometry.top, width: geometry.width, height: geometry.height },
      },
        h("div", {
          className: "dcr-sidebarResizeHandle",
          role: "separator",
          tabIndex: 0,
          "aria-label": "调整变更侧栏宽度",
          "aria-orientation": "vertical",
          "data-dragging": dragging || undefined,
          onPointerDown: (event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            setDragging(true);
          },
          onPointerMove: resizeFromPointer,
          onPointerUp: (event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
            setDragging(false);
          },
          onPointerCancel: () => setDragging(false),
          onKeyDown: (event) => {
            if (event.key === "ArrowLeft") sidebarController.resize(width + 40);
            else if (event.key === "ArrowRight") sidebarController.resize(Math.max(0, width - 40));
            else return;
            event.preventDefault();
          },
        }),
        h(ChangesSidebar, props),
      );
    }

    function ChangesSidebarAction({ sessionId, useSession, sidebarController, openPath, highlightStore }) {
      const snapshot = useSyncExternalStore(sidebarController.subscribe, sidebarController.getSnapshot);
      const open = snapshot.sessionId === sessionId;
      useEffect(() => () => {
        if (sidebarController.getSnapshot().sessionId === sessionId) sidebarController.close();
      }, [sessionId, sidebarController]);
      const overlay = typeof document === "undefined" ? null : document.querySelector("[data-shell-overlay]");
      return h(React.Fragment, null,
        h("button", {
          type: "button",
          className: "dcr-sidebarToggle",
          onClick: () => sidebarController.toggle(sessionId),
          title: open ? "关闭变更侧栏" : "打开变更侧栏",
          "aria-label": open ? "关闭变更侧栏" : "打开变更侧栏",
          "aria-pressed": open,
        }, h("span", null, "变更")),
        open && overlay !== null && ReactDOM.createPortal(h(ChangesSidebarPanel, {
          sidebarController,
          width: snapshot.width,
          sessionId,
          useSession,
          navigation: snapshot.navigation,
          openPath,
          highlightStore,
          onClose: () => sidebarController.close(),
        }), overlay),
      );
    }

    const inject = ["slots", "conversationEvents", "layout", "theme"];

    function apply(ctx) {
      const sidebarController = createSidebarController(ctx.layout);
      const highlightStore = createHighlightStore(ctx.theme);
      const navigateToChange = (sessionId, turn, path) => {
        sidebarController.open(sessionId, { turn, path });
      };
      const openPath = (path) => {
        const workspaces = typeof ctx.get === "function" ? ctx.get("workspaces") : undefined;
        if (workspaces === undefined) return;
        Promise.resolve(workspaces.openPath(path)).catch((error) => {
          console.error("[dsh-code-review] open file failed", error);
        });
      };
      ctx.effect(installStyles);
      ctx.effect(() => ctx.on("theme/change", (snapshot) => highlightStore.setScheme(snapshot.active.colorScheme)));
      ctx.effect(() => {
        applyFontPreference(readFontPreference());
        return () => document.documentElement.style.removeProperty("--dcr-font-family");
      });
      ctx.conversationEvents.register(reviewDefinition);
      ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
        name: "settings.plugin.item",
        id: "code-review",
        order: 30,
        inject: () => ({
          highlightStore,
          getFont: readFontPreference,
          setFont: writeFontPreference,
        }),
      }, CodeReviewPluginCard));
      ctx.slots.inject("conversation.session.header.utilities", () => ctx.slots.register({
        name: "conversation.session.header.utilities",
        id: "code-review-changes",
        order: 100,
        inject: () => ({ sidebarController, openPath, highlightStore }),
      }, ChangesSidebarAction));
      ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({
        name: "conversation.chat.node",
        key: NODE_KIND,
        inject: () => ({ navigateToChange }),
      }, ReviewSummaryNode));
    }

    exports.MAX_MULTI_FILE_CHANGED_LINES = MAX_MULTI_FILE_CHANGED_LINES;
    exports.apply = apply;
    exports.buildFileTree = buildFileTree;
    exports.fileAnchorId = fileAnchorId;
    exports.filePaneWidthFromPointer = filePaneWidthFromPointer;
    exports.inject = inject;
    exports.isLargeDiff = isLargeDiff;
    exports.querySystemFontFamilies = querySystemFontFamilies;
    exports.rankFontCandidates = rankFontCandidates;
    exports.sidebarWidthFromPointer = sidebarWidthFromPointer;
    return module.exports;
  },
});
