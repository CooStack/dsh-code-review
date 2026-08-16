# dsh-code-review

[![DSH Plugin](https://img.shields.io/badge/DeepSeek%20Harness-plugin-4f7cff)](https://github.com/topics/dsh-plugin)
[![License: GPL-3.0-only](https://img.shields.io/github/license/CooStack/dsh-code-review)](LICENSE)

[English](README.md) | [简体中文](README.zh-CN.md)
<img width="2255" height="812" alt="image" src="https://github.com/user-attachments/assets/19f7bfd7-aef0-490d-87ac-d7a8321eb2d9" />

A community DeepSeek Harness Web plugin for reviewing code changes turn by turn. It adds a Codex-style change summary, a resizable diff sidebar, a workspace-relative file tree, syntax highlighting, and guarded undo for safe iteration in a shared workspace.

This is an independent community plugin. It is not an official DeepSeek product and does not imply DeepSeek endorsement.

## Highlights

- **Turn-level review** — See added and removed line totals, open a completed turn from the conversation, and jump between changed files without leaving the chat.
- **Code and file tree together** — Inspect the selected unified diff on the left and a searchable, workspace-relative file tree on the right. The inner divider is independently draggable and persisted.
- **Large, practical sidebar** — Resize the review sidebar beyond the shell's former 520px cap. The layout collapses the left navigation when a narrow window needs the space and restores it when the review closes.
- **Parent and child aggregation** — Changes recorded by ordinary subagents and workflow children are projected into the parent review. All agents write to the same workspace immediately; no artificial merge step is introduced.
- **Syntax-aware diffs** — Plugin-owned Shiki highlighting tokenizes complete old and new files before mapping tokens back to diff rows, so multiline comments and strings keep their grammar state.
- **Light and dark palettes** — Configure syntax, diff, gutter, and omitted-line colors separately for light and dark themes.
- **Font control that does not surprise you** — Type to move the best matching font candidate to the top of the menu. A font is applied only after clicking a candidate or pressing Enter. System font families can be loaded on demand through Chromium Local Font Access.
- **Guarded undo** — Undo uses recorded before-and-after snapshots, resolved sandbox policy, filesystem version guards, and exact same-file content chains. Ambiguous, stale, or active-agent changes are refused instead of overwritten.
- **Native DSH integration** — Uses DSH conversation nodes, session utility slots, settings plugin cards, theme events, and the DSH `Menu` primitive rather than replacing the host shell.

## Install

The repository contains the prebuilt client bundle, so a GitHub source install is enough:

```bash
dsh plugin --profile web add github:CooStack/dsh-code-review#main
```

Restart the DSH Web profile after installation so the Host and Client plugin graph is rebuilt.

To install a local checkout while developing:

```bash
git clone https://github.com/CooStack/dsh-code-review.git
dsh plugin --profile web add file:./dsh-code-review
```

The profile command forwards the package to the profile's package manager. To remove it:

```bash
dsh plugin --profile web remove dsh-code-review
```

## Use

After restarting DSH Web, completed turns with recorded changes expose the `变更` utility in the conversation header. Open it to review the selected turn, search the file tree, inspect a unified diff, or open the source file in the workspace.

The conversation summary node also exposes changed files. Selecting a file opens the matching turn and path in the review sidebar.

## Settings

Open:

```text
设置 -> 插件 -> 插件配置 -> dsh-code-review
```

The card is collapsed by default and contains both settings groups:

- **Font** — Load system fonts, type to reorder candidates, then click or press Enter to apply one. Typing and clearing a draft never changes the currently applied font.
- **Code highlighting** — Edit light and dark palettes independently, reset one palette, reset all overrides, and preview the resulting colors before returning to a diff.

The plugin applies the code font only to its diff renderers. Preferences are stored in the DSH browser storage namespace owned by this plugin.

## Undo safety

Undo is intentionally conservative:

- It never runs while the parent agent or an owning descendant is active.
- Every file is preflighted against the recorded final content before a write is attempted.
- Existing files use the filesystem provider's version guard.
- Concurrent same-file writes are ordered through an exact `before -> after` content chain, not callback timestamps.
- Broken chains, ambiguous same-baseline writes, external edits, and stale snapshots return a conflict without overwriting newer work.
- Historical results from before installation can be displayed when durable diff metadata exists, but they cannot be undone without complete file snapshots.

Reversible snapshots are stored under:

```text
${DSH_HOME:-~/.dsh}/code-review/
```

## Development

```bash
npm install
npm test
npm run build
```

`npm test` covers host-side aggregation and undo safety, client registration and layout behavior, and detailed highlighter token categories. `npm run build` regenerates `lib/client.bundle.js`, the bundle consumed by the DSH Web client.

## Scope and privacy

The plugin does not add a telemetry client, credentials flow, or background network service. Its host side records review metadata and snapshots through DSH services; its client side uses the active DSH theme and, when requested, the browser's local font enumeration API.

## License

Copyright (C) 2026 CooStack.

This project is licensed under the [GNU General Public License v3.0](LICENSE) (`GPL-3.0-only`).
