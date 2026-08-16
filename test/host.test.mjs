import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildReviewState,
  buildUnifiedDiff,
  createLedgerRuntime,
  diffLineCounts,
  normalizeDiffs,
  resolveSnapshotChain,
} from "../lib/index.js";

function createFakeFs(initial) {
  const files = new Map(Object.entries(initial).map(([path, text]) => [path, { text, revision: 1 }]));
  const writes = [];
  return {
    files,
    writes,
    async resolve(path) {
      return { targetKey: path, displayPath: path };
    },
    processPath(target) {
      return target.targetKey;
    },
    async stat(target) {
      const file = files.get(target.targetKey);
      return file === undefined ? undefined : { type: "file", version: String(file.revision), size: file.text.length };
    },
    async readText(target) {
      const file = files.get(target.targetKey);
      if (file === undefined) throw new Error("missing file");
      return file.text;
    },
    async writeText(target, content, expected, _signal, sandboxPolicy) {
      writes.push({ target, expected, sandboxPolicy });
      const file = files.get(target.targetKey);
      if (expected?.kind === "replaceIfVersion") {
        if (file === undefined || String(file.revision) !== expected.version) throw new Error("FS_STALE_VERSION");
      }
      if (expected?.kind === "createIfAbsent" && file !== undefined) throw new Error("FS_NOT_OBSERVED");
      const before = file?.text ?? null;
      const revision = (file?.revision ?? 0) + 1;
      files.set(target.targetKey, { text: content, revision });
      return { operation: file === undefined ? "create" : "update", version: String(revision), before, after: content };
    },
    externalWrite(path, text) {
      const file = files.get(path);
      files.set(path, { text, revision: (file?.revision ?? 0) + 1 });
    },
  };
}

function fixture(initial = { "src/a.js": "const a = 1;\n" }) {
  const fs = createFakeFs(initial);
  const session = { id: "session-1", header: { cwd: "/workspace" }, events: [], seq: 10 };
  const agent = { id: session.id, status: "idle", session };
  const agents = new Map([[agent.id, agent]]);
  const emitted = [];
  const sandboxPolicy = { mode: "danger-full-access", workspaceRoot: "/workspace" };
  const ctx = {
    fs,
    sandboxPolicy: {
      resolve(request) {
        assert.equal(request?.session, session);
        return sandboxPolicy;
      },
    },
    agents: {
      get(id) { return agents.get(id); },
      list() { return [...agents.values()]; },
    },
    emit(...args) { emitted.push(args); },
  };
  return { ctx, fs, session, agent, agents, emitted };
}

function callEvent(callId, turn = 1, step = 1, seq = 1) {
  return { type: "tool/call", data: { callId, turn, step, name: "edit", arguments: "{}" }, seq, time: seq };
}

function resultEvent(callId, diffs, turn = 1, step = 1, seq = 2) {
  return {
    type: "tool/result",
    data: {
      turn,
      step,
      message: { content: [{ type: "tool-result", toolCallId: callId, content: [] }] },
      meta: { diffs },
    },
    seq,
    time: seq,
  };
}

async function withRuntime(run, initial) {
  const storage = await mkdtemp(join(tmpdir(), "dsh-code-review-test-"));
  const values = fixture(initial);
  const runtime = createLedgerRuntime(values.ctx, storage);
  await runtime.load();
  try {
    await run({ ...values, runtime });
  } finally {
    await runtime.flush(values.session.id);
    await rm(storage, { recursive: true, force: true });
  }
}

test("normalizeDiffs rejects malformed wire entries", () => {
  assert.deepEqual(normalizeDiffs(undefined), []);
  assert.deepEqual(normalizeDiffs([{ path: "a", oldText: 1, newText: "b" }]), []);
  assert.deepEqual(normalizeDiffs([{ path: "a", oldText: null, newText: "b" }]), [
    { path: "a", oldText: null, newText: "b" },
  ]);
});

test("snapshot chain orders concurrent callbacks by file content", () => {
  const first = { key: "first", hasSnapshot: true, before: "v1\n", after: "v2\n", ordinal: 1 };
  const second = { key: "second", hasSnapshot: true, before: "v2\n", after: "v3\n", ordinal: 2 };
  const chain = resolveSnapshotChain([second, first], "v3\n");
  assert.equal(chain.ok, true);
  assert.deepEqual(chain.records.map((record) => record.key), ["first", "second"]);
  assert.equal(chain.before, "v1\n");
  assert.equal(chain.after, "v3\n");
});

test("snapshot chain rejects stale parallel writes to the same baseline", () => {
  const left = { key: "left", hasSnapshot: true, before: "v1\n", after: "left\n", ordinal: 1 };
  const right = { key: "right", hasSnapshot: true, before: "v1\n", after: "right\n", ordinal: 2 };
  const chain = resolveSnapshotChain([left, right], "right\n");
  assert.deepEqual(chain, { ok: false, reason: "broken-or-ambiguous-predecessor" });
});

test("diffLineCounts reports net inserted and removed lines", () => {
  assert.deepEqual(diffLineCounts("a\nb\nc\n", "a\nnew\nb\nc\n"), { added: 1, removed: 0 });
  assert.deepEqual(diffLineCounts("a\nb\nc\n", "a\nchanged\nc\n"), { added: 1, removed: 1 });
  assert.deepEqual(diffLineCounts("a\nb\nc\n", "a\nc\n"), { added: 0, removed: 1 });
  assert.deepEqual(diffLineCounts("", "a\nb\n"), { added: 2, removed: 0 });
});

test("buildUnifiedDiff keeps line numbers and reports omitted unchanged lines", () => {
  const before = Array.from({ length: 12 }, (_, index) => `line-${index + 1}`).join("\n") + "\n";
  const afterLines = Array.from({ length: 12 }, (_, index) => `line-${index + 1}`);
  afterLines[1] = "line-2 changed";
  afterLines[10] = "line-11 changed";
  const unified = buildUnifiedDiff(before, `${afterLines.join("\n")}\n`, 1);
  assert.deepEqual({ added: unified.added, removed: unified.removed }, { added: 2, removed: 2 });
  const gaps = unified.sections.filter((section) => section.kind === "gap");
  assert.ok(gaps.some((section) => section.count >= 5), "separated hunks must expose omitted unchanged line count");
  const rows = unified.sections.filter((section) => section.kind === "hunk").flatMap((section) => section.rows);
  assert.ok(rows.some((row) => row.kind === "del" && row.oldLine === 2 && row.text === "line-2"));
  assert.ok(rows.some((row) => row.kind === "add" && row.newLine === 2 && row.text === "line-2 changed"));
  assert.ok(rows.some((row) => row.kind === "del" && row.oldLine === 11 && row.text === "line-11"));
});

test("buildReviewState marks display-only history as non-revertible", () => {
  const state = {
    sessionId: "s",
    revision: 1,
    records: [{
      key: "1",
      callId: "1",
      turn: 3,
      path: "a.js",
      hasSnapshot: false,
      undone: false,
      diffs: [{ path: "a.js", oldText: "old\n", newText: "new\nmore\n" }],
    }],
  };
  const review = buildReviewState(state, false);
  assert.equal(review.latestTurn, 3);
  assert.equal(review.turns[0].canUndo, false);
  assert.equal(review.turns[0].displayOnly, true);
  assert.deepEqual({ added: review.turns[0].added, removed: review.turns[0].removed }, { added: 2, removed: 1 });
});

test("display-only history counts changed lines instead of whole long files", () => {
  const before = Array.from({ length: 500 }, (_, index) => `line-${index}`).join("\n") + "\n";
  const afterLines = before.trimEnd().split("\n");
  afterLines[249] = "line-249 changed";
  const state = {
    sessionId: "s",
    revision: 1,
    records: [{
      key: "1",
      callId: "1",
      turn: 3,
      path: "large.js",
      hasSnapshot: false,
      undone: false,
      diffs: [{ path: "large.js", oldText: before, newText: `${afterLines.join("\n")}\n` }],
    }],
  };
  const review = buildReviewState(state, false);
  assert.equal(review.turns[0].changedLines, 2);
  assert.deepEqual({ added: review.turns[0].added, removed: review.turns[0].removed }, { added: 1, removed: 1 });
});

test("undo restores the first before snapshot after multiple edits in one turn", async () => {
  await withRuntime(async ({ runtime, fs, session, agent }) => {
    const path = "src/a.js";
    runtime.observeSessionEvent(session, callEvent("call-1", 1, 1, 1));
    runtime.observeToolResult({ callId: "call-1", rootCallId: "call-1", agent }, {
      isError: false,
      value: { path, before: "const a = 1;\n", after: "const a = 2;\n" },
      meta: { diffs: [{ path, oldText: "const a = 1;\n", newText: "const a = 2;\n" }] },
    });
    fs.externalWrite(path, "const a = 2;\n");

    runtime.observeSessionEvent(session, callEvent("call-2", 1, 2, 3));
    runtime.observeToolResult({ callId: "call-2", rootCallId: "call-2", agent }, {
      isError: false,
      value: { path, before: "const a = 2;\n", after: "const a = 3;\n" },
      meta: { diffs: [{ path, oldText: "const a = 2;\n", newText: "const a = 3;\n" }] },
    });
    fs.externalWrite(path, "const a = 3;\n");

    assert.equal(runtime.reviewState(session.id).turns[0].canUndo, true);
    const review = await runtime.undoTurn(session.id, 1);
    assert.equal(fs.files.get(path).text, "const a = 1;\n");
    assert.deepEqual(fs.writes.at(-1).sandboxPolicy, { mode: "danger-full-access", workspaceRoot: "/workspace" });
    assert.equal(review.turns[0].undone, true);
    assert.equal(review.turns[0].canUndo, false);
  });
});

test("parent review aggregates and can undo changes from a disposed subagent", async () => {
  await withRuntime(async ({ runtime, fs, session, agent, agents }) => {
    const path = "src/a.js";
    const parentCall = callEvent("workflow-call", 2, 1, 20);
    session.events.push(parentCall);
    session.seq = 21;
    runtime.scanSession(session);

    const childSession = {
      id: "child-1",
      header: { cwd: "/workspace", parentSession: session.id, origin: "subagent" },
      events: [],
      seq: 2,
    };
    const childAgent = { id: childSession.id, status: "idle", session: childSession };
    agents.set(childAgent.id, childAgent);
    runtime.scanSession(childSession);

    const childCall = callEvent("child-edit", 1, 1, 1);
    childSession.events.push(childCall);
    runtime.observeSessionEvent(childSession, childCall);
    runtime.observeToolResult({ callId: "child-edit", rootCallId: "child-edit", agent: childAgent }, {
      isError: false,
      value: { path, before: "const a = 1;\n", after: "const a = 2;\n" },
      meta: { diffs: [{ path, oldText: "const a = 1;\n", newText: "const a = 2;\n" }] },
    });
    fs.externalWrite(path, "const a = 2;\n");
    agents.delete(childAgent.id);

    const review = runtime.reviewState(session.id);
    assert.equal(review.latestTurn, 2);
    assert.equal(review.turns[0].files[0].path, path);
    assert.deepEqual({ added: review.turns[0].added, removed: review.turns[0].removed }, { added: 1, removed: 1 });

    const undone = await runtime.undoTurn(session.id, 2);
    assert.equal(fs.files.get(path).text, "const a = 1;\n");
    assert.equal(undone.turns[0].undone, true);
  });
});

test("undo refuses to overwrite a file changed after the recorded edit", async () => {
  await withRuntime(async ({ runtime, fs, session, agent }) => {
    const path = "src/a.js";
    runtime.observeSessionEvent(session, callEvent("call-1"));
    runtime.observeToolResult({ callId: "call-1", rootCallId: "call-1", agent }, {
      isError: false,
      value: { path, before: "const a = 1;\n", after: "const a = 2;\n" },
      meta: { diffs: [{ path, oldText: "const a = 1;\n", newText: "const a = 2;\n" }] },
    });
    fs.externalWrite(path, "const a = 99;\n");

    await assert.rejects(runtime.undoTurn(session.id, 1), /本轮之后又被修改/);
    assert.equal(fs.files.get(path).text, "const a = 99;\n");
    assert.equal(runtime.reviewState(session.id).turns[0].canUndo, true);
  });
});

test("undo is disabled while the agent is running", async () => {
  await withRuntime(async ({ runtime, session, agent }) => {
    agent.status = "running";
    runtime.observeSessionEvent(session, callEvent("call-1"));
    runtime.observeToolResult({ callId: "call-1", rootCallId: "call-1", agent }, {
      isError: false,
      value: { path: "src/a.js", before: "const a = 1;\n", after: "const a = 2;\n" },
      meta: { diffs: [{ path: "src/a.js", oldText: "const a = 1;\n", newText: "const a = 2;\n" }] },
    });
    const review = runtime.reviewState(session.id);
    assert.equal(review.running, true);
    assert.equal(review.turns[0].canUndo, false);
    await assert.rejects(runtime.undoTurn(session.id, 1), /仍在运行/);
  });
});

test("historical scans preserve multiple diffs for one call and path", async () => {
  await withRuntime(async ({ runtime, session }) => {
    session.events.push(resultEvent("old-call", [
      { path: "src/old.js", oldText: "a\n", newText: "A\n" },
      { path: "src/old.js", oldText: "b\n", newText: "B\n" },
    ], 4));
    runtime.scanSession(session);
    const first = runtime.reviewState(session.id);
    const second = runtime.reviewState(session.id);
    assert.equal(first.turns[0].files[0].diffs.length, 2);
    assert.deepEqual({ added: first.turns[0].added, removed: first.turns[0].removed }, { added: 2, removed: 2 });
    assert.equal(second.revision, first.revision, "repeated history scans must be idempotent");
  });
});

test("durable diff metadata remains reviewable without a full snapshot", async () => {
  await withRuntime(async ({ runtime, session }) => {
    runtime.observeSessionEvent(session, resultEvent("old-call", [
      { path: "src/old.js", oldText: "old\n", newText: "new\n" },
    ], 4));
    const review = runtime.reviewState(session.id);
    assert.equal(review.turns[0].turn, 4);
    assert.equal(review.turns[0].files[0].path, "src/old.js");
    assert.equal(review.turns[0].displayOnly, true);
    assert.equal(review.turns[0].canUndo, false);
  });
});
