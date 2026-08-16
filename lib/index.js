import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export const name = "dsh-code-review";
export const inject = ["agents", "fs", "webServer", "sandboxPolicy"];

const API_PATH = "/api/dsh-code-review";
const STORAGE_VERSION = 1;
const MAX_BODY_BYTES = 64 * 1024;
const MAX_RECORDS_PER_SESSION = 200;
const MAX_DIFF_TEXT = 1024 * 1024;
const STORAGE_ROOT = join(process.env.DSH_HOME ?? join(homedir(), ".dsh"), "code-review");

class HttpError extends Error {
  constructor(status, message, details = {}) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clippedText(value) {
  if (value.length <= MAX_DIFF_TEXT) return value;
  const half = Math.floor(MAX_DIFF_TEXT / 2);
  return `${value.slice(0, half)}\n... diff truncated by dsh-code-review ...\n${value.slice(-half)}`;
}

export function normalizeDiffs(value) {
  if (!Array.isArray(value)) return [];
  const diffs = [];
  for (const item of value) {
    if (!isObject(item) || typeof item.path !== "string" || typeof item.newText !== "string") continue;
    if (item.oldText !== null && typeof item.oldText !== "string") continue;
    diffs.push({
      path: item.path,
      oldText: item.oldText === null ? null : clippedText(item.oldText),
      newText: clippedText(item.newText),
    });
  }
  return diffs;
}

function groupDiffsByPath(diffs) {
  const grouped = new Map();
  for (const diff of diffs) {
    const entries = grouped.get(diff.path) ?? [];
    entries.push(diff);
    grouped.set(diff.path, entries);
  }
  return grouped;
}

function sameDiffs(left, right) {
  return left.length === right.length && left.every((diff, index) => {
    const other = right[index];
    return other !== undefined
      && diff.path === other.path
      && diff.oldText === other.oldText
      && diff.newText === other.newText;
  });
}

function contentLines(text) {
  if (text === null || text === "") return [];
  return (text.endsWith("\n") ? text.slice(0, -1) : text).split("\n");
}

export function diffLineCounts(oldText, newText) {
  const before = contentLines(oldText);
  const after = contentLines(newText);
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start += 1;
  let beforeEnd = before.length;
  let afterEnd = after.length;
  while (beforeEnd > start && afterEnd > start && before[beforeEnd - 1] === after[afterEnd - 1]) {
    beforeEnd -= 1;
    afterEnd -= 1;
  }
  const left = before.slice(start, beforeEnd);
  const right = after.slice(start, afterEnd);
  const n = left.length;
  const m = right.length;
  if (n === 0) return { added: m, removed: 0 };
  if (m === 0) return { added: 0, removed: n };

  const max = n + m;
  const offset = max + 1;
  const frontier = new Int32Array(max * 2 + 3);
  frontier.fill(-1);
  frontier[offset + 1] = 0;
  let work = 0;
  for (let distance = 0; distance <= max; distance += 1) {
    for (let diagonal = -distance; diagonal <= distance; diagonal += 2) {
      work += 1;
      if (work > 5_000_000) return { added: m, removed: n };
      const index = offset + diagonal;
      let x;
      if (diagonal === -distance || (diagonal !== distance && frontier[index - 1] < frontier[index + 1])) {
        x = frontier[index + 1];
      } else {
        x = frontier[index - 1] + 1;
      }
      let y = x - diagonal;
      while (x < n && y < m && left[x] === right[y]) {
        x += 1;
        y += 1;
      }
      frontier[index] = x;
      if (x >= n && y >= m) {
        return {
          added: (distance + m - n) / 2,
          removed: (distance + n - m) / 2,
        };
      }
    }
  }
  return { added: m, removed: n };
}

function myersOperations(before, after) {
  const n = before.length;
  const m = after.length;
  const max = n + m;
  if (max === 0) return [];
  const frontier = new Map([[1, 0]]);
  const trace = [];
  let work = 0;
  for (let distance = 0; distance <= max; distance += 1) {
    trace.push(new Map(frontier));
    for (let diagonal = -distance; diagonal <= distance; diagonal += 2) {
      work += 1;
      if (work > 5_000_000) {
        return [
          ...before.map((text) => ({ kind: "del", text })),
          ...after.map((text) => ({ kind: "add", text })),
        ];
      }
      const down = frontier.get(diagonal + 1) ?? -1;
      const right = (frontier.get(diagonal - 1) ?? -1) + 1;
      let x = diagonal === -distance || (diagonal !== distance && right <= down) ? Math.max(0, down) : right;
      let y = x - diagonal;
      while (x < n && y < m && before[x] === after[y]) {
        x += 1;
        y += 1;
      }
      frontier.set(diagonal, x);
      if (x < n || y < m) continue;

      const operations = [];
      let backX = n;
      let backY = m;
      for (let backDistance = trace.length - 1; backDistance >= 0; backDistance -= 1) {
        const previous = trace[backDistance];
        const backDiagonal = backX - backY;
        const previousDown = previous.get(backDiagonal + 1) ?? -1;
        const previousRight = (previous.get(backDiagonal - 1) ?? -1) + 1;
        const previousDiagonal = backDiagonal === -backDistance || (backDiagonal !== backDistance && previousRight <= previousDown)
          ? backDiagonal + 1
          : backDiagonal - 1;
        const previousX = Math.max(0, previous.get(previousDiagonal) ?? 0);
        const previousY = previousX - previousDiagonal;
        while (backX > previousX && backY > previousY) {
          operations.push({ kind: "context", text: before[backX - 1] });
          backX -= 1;
          backY -= 1;
        }
        if (backDistance === 0) break;
        if (backX === previousX) {
          backY -= 1;
          operations.push({ kind: "add", text: after[backY] });
        } else {
          backX -= 1;
          operations.push({ kind: "del", text: before[backX] });
        }
      }
      operations.reverse();
      return operations;
    }
  }
  return [];
}

export function buildUnifiedDiff(oldText, newText, contextLines = 3) {
  const operations = myersOperations(contentLines(oldText), contentLines(newText));
  let oldLine = 1;
  let newLine = 1;
  let added = 0;
  let removed = 0;
  const rows = operations.map((operation) => {
    if (operation.kind === "context") {
      const row = { kind: "context", oldLine, newLine, text: operation.text };
      oldLine += 1;
      newLine += 1;
      return row;
    }
    if (operation.kind === "del") {
      const row = { kind: "del", oldLine, newLine: null, text: operation.text };
      oldLine += 1;
      removed += 1;
      return row;
    }
    const row = { kind: "add", oldLine: null, newLine, text: operation.text };
    newLine += 1;
    added += 1;
    return row;
  });

  const changed = [];
  for (let index = 0; index < rows.length; index += 1) {
    if (rows[index].kind !== "context") changed.push(index);
  }
  if (changed.length === 0) return { sections: [], added: 0, removed: 0 };

  const ranges = [];
  for (const index of changed) {
    let start = index;
    let end = index;
    let context = 0;
    while (start > 0 && rows[start - 1].kind === "context" && context < contextLines) {
      start -= 1;
      context += 1;
    }
    context = 0;
    while (end + 1 < rows.length && rows[end + 1].kind === "context" && context < contextLines) {
      end += 1;
      context += 1;
    }
    const previous = ranges[ranges.length - 1];
    if (previous !== undefined && start <= previous.end + 1) previous.end = Math.max(previous.end, end);
    else ranges.push({ start, end });
  }

  const sections = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) {
      const count = rows.slice(cursor, range.start).filter((row) => row.kind === "context").length;
      if (count > 0) sections.push({ kind: "gap", count });
    }
    sections.push({ kind: "hunk", rows: rows.slice(range.start, range.end + 1) });
    cursor = range.end + 1;
  }
  if (cursor < rows.length) {
    const count = rows.slice(cursor).filter((row) => row.kind === "context").length;
    if (count > 0) sections.push({ kind: "gap", count });
  }
  return { sections, added, removed };
}

export function summarizeDiffs(diffs) {
  let added = 0;
  let removed = 0;
  for (const diff of diffs) {
    const counts = diffLineCounts(diff.oldText ?? "", diff.newText);
    added += counts.added;
    removed += counts.removed;
  }
  return { added, removed };
}

function recordKey(callId, path) {
  return `${callId}\u0000${path}`;
}

function sessionFileName(sessionId) {
  return `${encodeURIComponent(sessionId)}.json`;
}

function validStoredRecord(value) {
  return isObject(value)
    && typeof value.key === "string"
    && typeof value.callId === "string"
    && Number.isSafeInteger(value.turn)
    && typeof value.path === "string"
    && typeof value.after === "string"
    && (value.before === null || typeof value.before === "string")
    && value.hasSnapshot === true
    && typeof value.created === "boolean"
    && typeof value.undone === "boolean"
    && Array.isArray(value.diffs);
}

function createSessionState(sessionId) {
  return {
    sessionId,
    parentSessionId: null,
    ownerSessionId: sessionId,
    ownerTurn: null,
    revision: 0,
    records: [],
  };
}

function upsertRecord(state, next) {
  const index = state.records.findIndex((record) => record.key === next.key);
  if (index < 0) {
    state.records.push(next);
    state.records.sort((a, b) => a.ordinal - b.ordinal || a.key.localeCompare(b.key));
    state.revision += 1;
    return true;
  }
  const previous = state.records[index];
  if (!previous.hasSnapshot && !next.hasSnapshot && sameDiffs(previous.diffs, next.diffs)) return false;
  if (previous.hasSnapshot && !next.hasSnapshot) {
    if (previous.diffs.length === 0 && next.diffs.length > 0) {
      state.records[index] = { ...previous, diffs: next.diffs };
      state.revision += 1;
      return true;
    }
    return false;
  }
  state.records[index] = {
    ...previous,
    ...next,
    undone: previous.undone && next.hasSnapshot ? true : next.undone,
  };
  state.revision += 1;
  return true;
}

function toolResultCallId(event) {
  const content = event?.data?.message?.content;
  const block = Array.isArray(content) ? content[0] : undefined;
  return isObject(block) && typeof block.toolCallId === "string" ? block.toolCallId : undefined;
}

function scanSessionInto(state, rootTurns, session) {
  for (const event of session.events) {
    if (event.type === "tool/call") {
      rootTurns.set(`${session.id}:${event.data.callId}`, {
        turn: event.data.turn,
        step: event.data.step,
      });
      continue;
    }
    if (event.type !== "tool/result") continue;
    const callId = toolResultCallId(event);
    const diffs = normalizeDiffs(event.data.meta?.diffs);
    if (callId === undefined || diffs.length === 0) continue;
    for (const [path, pathDiffs] of groupDiffsByPath(diffs)) {
      upsertRecord(state, {
        key: recordKey(callId, path),
        callId,
        rootCallId: callId,
        turn: event.data.turn,
        step: event.data.step,
        path,
        cwd: session.header.cwd,
        before: null,
        after: "",
        created: false,
        hasSnapshot: false,
        undone: false,
        diffs: pathDiffs,
        ordinal: event.seq,
        createdAt: event.time,
      });
    }
  }
}

export function resolveSnapshotChain(records, expectedAfter) {
  if (records.length === 0 || records.some((record) => !record.hasSnapshot)) {
    return { ok: false, reason: "missing-snapshot" };
  }
  const remaining = [...records];
  const finalCandidates = expectedAfter === undefined
    ? remaining.filter((record) => !remaining.some((other) => other !== record && other.before === record.after))
    : remaining.filter((record) => record.after === expectedAfter);
  if (finalCandidates.length !== 1) return { ok: false, reason: "ambiguous-final" };

  const chain = [finalCandidates[0]];
  remaining.splice(remaining.indexOf(finalCandidates[0]), 1);
  while (remaining.length > 0) {
    const before = chain[0].before;
    const candidates = remaining.filter((record) => record.after === before);
    if (candidates.length !== 1) return { ok: false, reason: "broken-or-ambiguous-predecessor" };
    chain.unshift(candidates[0]);
    remaining.splice(remaining.indexOf(candidates[0]), 1);
  }
  return {
    ok: true,
    records: chain,
    before: chain[0].before,
    after: chain[chain.length - 1].after,
  };
}

function compareRecordOrder(left, right) {
  return (left.createdAt ?? 0) - (right.createdAt ?? 0)
    || left.ordinal - right.ordinal
    || left.key.localeCompare(right.key);
}

function aggregateRecords(records) {
  const files = new Map();
  for (const record of records) {
    let file = files.get(record.path);
    if (file === undefined) {
      file = {
        path: record.path,
        diffs: [],
        records: [],
      };
      files.set(record.path, file);
    }
    file.records.push(record);
  }
  return [...files.values()]
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((file) => {
      file.records.sort(compareRecordOrder);
      const chain = resolveSnapshotChain(file.records);
      const ordered = chain.ok ? chain.records : file.records;
      const diffs = ordered.flatMap((record) => record.diffs);
      const unified = chain.ok ? buildUnifiedDiff(chain.before ?? "", chain.after) : null;
      const stats = unified ?? summarizeDiffs(diffs);
      return {
        path: file.path,
        cwd: ordered.find((record) => record.cwd !== undefined)?.cwd,
        diffs,
        unified,
        oldText: chain.ok ? chain.before : null,
        newText: chain.ok ? chain.after : null,
        concurrentConflict: file.records.every((record) => record.hasSnapshot) && !chain.ok,
        added: stats.added,
        removed: stats.removed,
        changedLines: stats.added + stats.removed,
      };
    });
}

export function buildReviewState(state, running = false) {
  const grouped = new Map();
  for (const record of state.records) {
    const records = grouped.get(record.turn) ?? [];
    records.push(record);
    grouped.set(record.turn, records);
  }
  const turns = [...grouped.entries()]
    .sort(([left], [right]) => right - left)
    .map(([turn, records]) => {
      const active = records.filter((record) => !record.undone);
      const files = aggregateRecords(records);
      const stats = files.reduce((sum, file) => ({
        added: sum.added + file.added,
        removed: sum.removed + file.removed,
      }), { added: 0, removed: 0 });
      return {
        turn,
        files,
        added: stats.added,
        removed: stats.removed,
        changedLines: stats.added + stats.removed,
        changeCount: records.length,
        canUndo: !running && active.length > 0 && active.every((record) => record.hasSnapshot),
        undone: records.length > 0 && active.length === 0,
        displayOnly: records.some((record) => !record.hasSnapshot),
      };
    });
  const allRecords = state.records.filter((record) => !record.undone);
  const allFiles = aggregateRecords(allRecords);
  const allStats = allFiles.reduce((sum, file) => ({
    added: sum.added + file.added,
    removed: sum.removed + file.removed,
  }), { added: 0, removed: 0 });
  return {
    sessionId: state.sessionId,
    revision: state.revision,
    running,
    latestTurn: turns.find((turn) => !turn.undone)?.turn ?? turns[0]?.turn ?? null,
    turns,
    all: {
      files: allFiles,
      added: allStats.added,
      removed: allStats.removed,
      changedLines: allStats.added + allStats.removed,
    },
  };
}

async function atomicWriteJson(path, value) {
  const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temp, `${JSON.stringify(value)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
  try {
    await rename(temp, path);
  } catch (error) {
    await rm(temp, { force: true }).catch(() => {});
    throw error;
  }
}

export function createLedgerRuntime(ctx, storageRoot = STORAGE_ROOT) {
  const states = new Map();
  const rootTurns = new Map();
  const persistTails = new Map();

  const ensureState = (sessionId) => {
    let state = states.get(sessionId);
    if (state === undefined) {
      state = createSessionState(sessionId);
      states.set(sessionId, state);
    }
    return state;
  };

  const persistedValue = (state) => ({
    version: STORAGE_VERSION,
    sessionId: state.sessionId,
    parentSessionId: state.parentSessionId,
    ownerSessionId: state.ownerSessionId,
    ownerTurn: state.ownerTurn,
    revision: state.revision,
    records: state.records.filter((record) => record.hasSnapshot).slice(-MAX_RECORDS_PER_SESSION),
  });

  const persist = async (state) => {
    await mkdir(storageRoot, { recursive: true, mode: 0o700 });
    await atomicWriteJson(join(storageRoot, sessionFileName(state.sessionId)), persistedValue(state));
  };

  const schedulePersist = (state) => {
    const previous = persistTails.get(state.sessionId) ?? Promise.resolve();
    const next = previous
      .catch(() => {})
      .then(() => persist(state))
      .catch((error) => {
        console.error(`[dsh-code-review] failed to persist ${state.sessionId}:`, error);
      });
    persistTails.set(state.sessionId, next);
    return next;
  };

  const load = async () => {
    await mkdir(storageRoot, { recursive: true, mode: 0o700 });
    let entries;
    try {
      entries = await readdir(storageRoot, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      try {
        const parsed = JSON.parse(await readFile(join(storageRoot, entry.name), "utf8"));
        if (!isObject(parsed) || parsed.version !== STORAGE_VERSION || typeof parsed.sessionId !== "string" || !Array.isArray(parsed.records)) continue;
        const state = ensureState(parsed.sessionId);
        state.parentSessionId = typeof parsed.parentSessionId === "string" ? parsed.parentSessionId : null;
        state.ownerSessionId = typeof parsed.ownerSessionId === "string" ? parsed.ownerSessionId : parsed.sessionId;
        state.ownerTurn = Number.isSafeInteger(parsed.ownerTurn) ? parsed.ownerTurn : null;
        for (const record of parsed.records) {
          if (!validStoredRecord(record)) continue;
          upsertRecord(state, {
            ...record,
            diffs: normalizeDiffs(record.diffs),
          });
        }
        state.revision = Math.max(state.revision, Number.isSafeInteger(parsed.revision) ? parsed.revision : 0);
      } catch (error) {
        console.error(`[dsh-code-review] ignored unreadable ledger ${entry.name}:`, error);
      }
    }
  };

  const latestSessionTurn = (session) => {
    let turn = null;
    for (const event of session.events) {
      const candidate = event?.data?.turn;
      if (Number.isSafeInteger(candidate)) turn = candidate;
    }
    return turn;
  };

  const linkSession = (session) => {
    const state = ensureState(session.id);
    const parentSessionId = session.header.parentSession;
    if (parentSessionId === undefined) {
      state.parentSessionId = null;
      state.ownerSessionId = session.id;
      state.ownerTurn = null;
      return state;
    }
    if (state.parentSessionId === parentSessionId && Number.isSafeInteger(state.ownerTurn)) return state;
    const parentAgent = ctx.agents.get(parentSessionId);
    const parentState = parentAgent === undefined ? states.get(parentSessionId) : linkSession(parentAgent.session);
    state.parentSessionId = parentSessionId;
    state.ownerSessionId = parentState?.ownerSessionId ?? parentSessionId;
    state.ownerTurn = parentState !== undefined && parentState.ownerSessionId !== parentSessionId
      ? parentState.ownerTurn
      : parentAgent === undefined
        ? parentState?.ownerTurn ?? null
        : latestSessionTurn(parentAgent.session);
    return state;
  };

  const scanSession = (session) => {
    scanSessionInto(linkSession(session), rootTurns, session);
  };

  const ownerStates = (sessionId) => [...states.values()].filter((state) => state.sessionId === sessionId || state.ownerSessionId === sessionId);

  const projectedOwnerState = (sessionId) => {
    const owned = ownerStates(sessionId);
    const records = owned.flatMap((state) => state.records.map((record) => state.sessionId === sessionId
      ? record
      : {
          ...record,
          sourceSessionId: state.sessionId,
          turn: Number.isSafeInteger(state.ownerTurn) ? state.ownerTurn : record.turn,
        }));
    return {
      sessionId,
      revision: owned.reduce((sum, state) => sum + state.revision, 0),
      records,
    };
  };

  const ownerRunning = (sessionId) => {
    for (const agent of ctx.agents.list()) {
      const state = linkSession(agent.session);
      if ((agent.id === sessionId || state.ownerSessionId === sessionId) && agent.status === "running") return true;
    }
    return false;
  };

  const observeToolResult = (exec, result) => {
    if (result.isError || exec.agent === undefined || !isObject(result.value)) return;
    const value = result.value;
    if (typeof value.path !== "string" || typeof value.after !== "string") return;
    const created = value.operation === "create";
    const hasSnapshot = typeof value.before === "string" || created;
    if (!hasSnapshot) return;
    let location = rootTurns.get(`${exec.agent.id}:${exec.rootCallId}`);
    if (location === undefined) {
      scanSession(exec.agent.session);
      location = rootTurns.get(`${exec.agent.id}:${exec.rootCallId}`);
    }
    if (location === undefined) return;
    const diffs = normalizeDiffs(result.meta?.diffs);
    const displayDiffs = diffs.length > 0 ? diffs : [{
      path: value.path,
      oldText: value.before === null ? null : clippedText(value.before),
      newText: clippedText(value.after),
    }];
    const state = linkSession(exec.agent.session);
    const changed = upsertRecord(state, {
      key: recordKey(exec.callId, value.path),
      callId: exec.callId,
      rootCallId: exec.rootCallId,
      turn: location.turn,
      step: location.step,
      path: value.path,
      cwd: exec.agent.session.header.cwd,
      before: value.before,
      after: value.after,
      created,
      hasSnapshot: true,
      undone: false,
      diffs: displayDiffs,
      ordinal: exec.agent.session.seq + state.records.length / 1000,
      createdAt: Date.now(),
    });
    if (changed) void schedulePersist(state);
  };

  const observeSessionEvent = (session, event) => {
    const state = linkSession(session);
    if (event.type === "tool/call") {
      rootTurns.set(`${session.id}:${event.data.callId}`, {
        turn: event.data.turn,
        step: event.data.step,
      });
      return;
    }
    if (event.type !== "tool/result") return;
    const callId = toolResultCallId(event);
    const diffs = normalizeDiffs(event.data.meta?.diffs);
    if (callId === undefined || diffs.length === 0) return;
    for (const [path, pathDiffs] of groupDiffsByPath(diffs)) {
      upsertRecord(state, {
        key: recordKey(callId, path),
        callId,
        rootCallId: callId,
        turn: event.data.turn,
        step: event.data.step,
        path,
        cwd: session.header.cwd,
        before: null,
        after: "",
        created: false,
        hasSnapshot: false,
        undone: false,
        diffs: pathDiffs,
        ordinal: event.seq,
        createdAt: event.time,
      });
    }
  };

  const reviewState = (sessionId) => {
    ensureState(sessionId);
    for (const agent of ctx.agents.list()) scanSession(agent.session);
    return buildReviewState(projectedOwnerState(sessionId), ownerRunning(sessionId));
  };

  const undoTurn = async (sessionId, turn) => {
    ensureState(sessionId);
    const agent = ctx.agents.get(sessionId);
    if (ownerRunning(sessionId)) throw new HttpError(409, "主智能体或子智能体仍在运行，结束后才能撤销");
    const sandboxPolicy = ctx.sandboxPolicy.resolve(agent === undefined ? undefined : { session: agent.session });
    const entries = ownerStates(sessionId).flatMap((state) => state.records
      .filter((record) => (state.sessionId === sessionId ? record.turn : state.ownerTurn ?? record.turn) === turn && !record.undone)
      .map((record) => ({ state, record })));
    const records = entries.map((entry) => entry.record);
    if (records.length === 0) throw new HttpError(404, "这一轮没有可撤销的变更");
    if (records.some((record) => !record.hasSnapshot)) {
      throw new HttpError(409, "这一轮在插件启用前完成，只有 diff 记录，没有可恢复快照");
    }

    const grouped = new Map();
    for (const record of records) {
      const group = grouped.get(record.path) ?? [];
      group.push(record);
      grouped.set(record.path, group);
    }

    const prepared = [];
    for (const [path, changes] of grouped) {
      const cwd = changes.find((record) => record.cwd !== undefined)?.cwd ?? agent?.session.header.cwd;
      const target = await ctx.fs.resolve(path, cwd === undefined ? undefined : { cwd });
      const info = await ctx.fs.stat(target);
      if (info === undefined || info.type !== "file") {
        throw new HttpError(409, `无法撤销 ${path}：文件已不存在或不再是普通文件`, { path });
      }
      const current = await ctx.fs.readText(target);
      if (!changes.some((record) => record.after === current)) {
        throw new HttpError(409, `无法撤销 ${path}：文件在本轮之后又被修改`, { path });
      }
      const chain = resolveSnapshotChain(changes, current);
      if (!chain.ok) {
        throw new HttpError(409, `无法撤销 ${path}：子智能体并发修改无法形成唯一快照链`, { path, reason: chain.reason });
      }
      prepared.push({
        path,
        target,
        info,
        current,
        baseline: chain.before,
        changes: chain.records,
      });
    }

    const applied = [];
    try {
      for (const item of prepared) {
        if (item.baseline === null) {
          const latestInfo = await ctx.fs.stat(item.target);
          const latestText = latestInfo === undefined ? undefined : await ctx.fs.readText(item.target);
          if (latestInfo === undefined || latestInfo.version !== item.info.version || latestText !== item.current) {
            throw new HttpError(409, `无法撤销 ${item.path}：文件在检查后发生变化`, { path: item.path });
          }
          await rm(ctx.fs.processPath(item.target));
          ctx.emit("fs/observed", item.target, { kind: "absent" }, undefined);
        } else {
          const outcome = await ctx.fs.writeText(item.target, item.baseline, {
            kind: "replaceIfVersion",
            version: item.info.version,
          }, undefined, sandboxPolicy);
          ctx.emit("fs/observed", item.target, { kind: "present", version: outcome.version }, undefined);
        }
        applied.push(item);
      }
    } catch (error) {
      for (const item of applied.reverse()) {
        try {
          const info = await ctx.fs.stat(item.target);
          if (item.baseline === null) {
            if (info === undefined) await ctx.fs.writeText(item.target, item.current, { kind: "createIfAbsent" }, undefined, sandboxPolicy);
          } else if (info !== undefined && await ctx.fs.readText(item.target) === item.baseline) {
            await ctx.fs.writeText(item.target, item.current, { kind: "replaceIfVersion", version: info.version }, undefined, sandboxPolicy);
          }
        } catch (rollbackError) {
          console.error(`[dsh-code-review] rollback after failed undo also failed for ${item.path}:`, rollbackError);
        }
      }
      throw error;
    }

    for (const record of records) record.undone = true;
    const touchedStates = new Set(entries.map((entry) => entry.state));
    for (const state of touchedStates) state.revision += 1;
    await Promise.all([...touchedStates].map((state) => schedulePersist(state)));
    return reviewState(sessionId);
  };

  return {
    load,
    scanSession,
    observeToolResult,
    observeSessionEvent,
    reviewState,
    undoTurn,
    flush: (sessionId) => Promise.all(ownerStates(sessionId).map((state) => persistTails.get(state.sessionId) ?? Promise.resolve())),
  };
}

async function readJsonBody(req) {
  let text = "";
  for await (const chunk of req) {
    text += chunk.toString("utf8");
    if (text.length > MAX_BODY_BYTES) throw new HttpError(413, "请求体过大");
  }
  if (text === "") return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "请求体不是有效 JSON");
  }
}

function assertMutationRequest(req) {
  if (req.headers["x-dsh-code-review"] !== "1") throw new HttpError(403, "缺少同源操作标记");
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (origin !== undefined && host !== undefined) {
    let originHost;
    try {
      originHost = new URL(origin).host;
    } catch {
      throw new HttpError(403, "请求来源无效");
    }
    if (originHost !== host) throw new HttpError(403, "拒绝跨来源操作");
  }
  const site = req.headers["sec-fetch-site"];
  if (site !== undefined && site !== "same-origin" && site !== "same-site" && site !== "none") {
    throw new HttpError(403, "拒绝跨站操作");
  }
}

function sendJson(res, status, value) {
  const body = JSON.stringify(value);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(body);
}

function routeHandler(runtime) {
  return async (req, res) => {
    try {
      const url = new URL(req.url ?? API_PATH, `http://${req.headers.host ?? "127.0.0.1"}`);
      if (req.method === "GET") {
        const sessionId = url.searchParams.get("sessionId");
        if (sessionId === null || sessionId === "") throw new HttpError(400, "缺少 sessionId");
        sendJson(res, 200, { ok: true, state: runtime.reviewState(sessionId) });
        return;
      }
      if (req.method === "POST") {
        assertMutationRequest(req);
        const body = await readJsonBody(req);
        if (!isObject(body) || body.action !== "undo" || typeof body.sessionId !== "string" || !Number.isSafeInteger(body.turn)) {
          throw new HttpError(400, "撤销参数无效");
        }
        const state = await runtime.undoTurn(body.sessionId, body.turn);
        sendJson(res, 200, { ok: true, state });
        return;
      }
      res.setHeader("Allow", "GET, POST");
      throw new HttpError(405, "不支持的请求方法");
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      const message = error instanceof Error ? error.message : String(error);
      if (status === 500) console.error("[dsh-code-review] API failure:", error);
      sendJson(res, status, {
        ok: false,
        error: {
          message,
          details: error instanceof HttpError ? error.details : {},
        },
      });
    }
  };
}

export async function apply(ctx) {
  const runtime = createLedgerRuntime(ctx);
  await runtime.load();
  for (const agent of ctx.agents.list()) runtime.scanSession(agent.session);

  ctx.on("agent/created", ({ agent }) => {
    runtime.scanSession(agent.session);
  });
  ctx.on("session/event", (session, event) => {
    runtime.observeSessionEvent(session, event);
  });
  ctx.on("tools/result", (exec, result) => {
    runtime.observeToolResult(exec, result);
  });
  ctx.on("session/flush", (session) => runtime.flush(session.id));
  ctx.effect(() => ctx.webServer.register({
    kind: "exact",
    path: API_PATH,
    handler: routeHandler(runtime),
  }));
}
