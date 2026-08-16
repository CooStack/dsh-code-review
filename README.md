# dsh-code-review

DeepSeek Harness Web plugin providing a Codex-style code-change review flow:

- a top-right `变更` session utility that opens a resizable right sidebar while keeping the conversation visible;
- plugin-owned sidebar sizing, persisted at 720px by default and draggable past the shell's former 520px cap up to the physical frame boundary;
- automatic left-navigation collapse when a narrow window needs that space for the sidebar, restored when the sidebar closes;
- a compact per-turn summary node whose file rows open the matching turn and file inside the sidebar;
- parent-session projection of edits made by ordinary subagents and workflow children, which all write to the same workspace immediately and require no merge step;
- file-level add/remove totals, line-numbered unified diffs, omitted-line markers, and an explicit command to open the selected source file;
- a focused one-file diff on the left and a searchable workspace-relative directory tree on the right, including single-child path compression and a separately persisted draggable divider;
- a DSH Menu turn filter with a dedicated empty state instead of a native empty select;
- plugin-owned Shiki syntax highlighting that tokenizes complete old/new files and maps tokens back to diff lines, preserving multiline grammar state;
- independent light and dark Codex-style palettes inside Settings > Plugins > Plugin Configuration > dsh-code-review, with controls for 12 syntax categories and 14 diff, gutter, and omitted-region colors;
- the font setting in the same dsh-code-review plugin card: it enumerates Chromium Local Font Access families on demand, keeps Microsoft YaHei as the default/fallback, typing only reorders the candidate menu toward the best match, while clicking a candidate or pressing Enter applies it;
- guarded per-turn undo using the full `write` / `edit` before-and-after snapshots and each owning session's resolved sandbox policy;
- content-chain reconstruction for concurrent same-file edits, with undo refusal for ambiguous chains, active parent/child agents, or files modified after the recorded write.

## Install

Add the package as a linked dependency and bundle in the active DSH profile, then restart DSH so the Host and Client plugin graph are rebuilt.

The plugin persists reversible snapshots under `${DSH_HOME:-~/.dsh}/code-review/`. Historical tool results from before installation remain reviewable when their durable result metadata contains diffs, but cannot be undone because the full file snapshot was not retained.

## Safety

Undo never runs while the parent agent or any owning descendant is active. Same-file records are ordered by an exact `before -> after` content chain rather than callback timestamps; broken or ambiguous chains return a conflict. Every affected file is preflighted against its recorded final content, existing files use the filesystem provider's version guard, and conflicts are reported without overwriting newer work.
