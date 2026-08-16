import assert from "node:assert/strict";
import test from "node:test";

globalThis.window = globalThis;
await import(`../src/highlighter.js?test=${Date.now()}`);

const highlighter = globalThis.__DSH_CODE_REVIEW_HIGHLIGHTER__;

test("highlighter maps paths and emits detailed token categories", () => {
  assert.equal(highlighter.languageFromPath("src/client.tsx"), "typescript");
  assert.equal(highlighter.languageFromPath("scripts/release.sh"), "shellscript");
  assert.equal(highlighter.languageFromPath("README.unknown"), undefined);

  const lines = highlighter.highlightLines("const count = 42; // ready", "typescript");
  assert.equal(lines.length, 1);
  const colors = new Set(lines[0].map((token) => token.color));
  assert.ok(colors.has("var(--dcr-syntax-keyword)"));
  assert.ok(colors.has("var(--dcr-syntax-number)"));
  assert.ok(colors.has("var(--dcr-syntax-operator)"));
  assert.ok(colors.has("var(--dcr-syntax-comment)"));
  assert.ok(colors.has("var(--dcr-syntax-punctuation)"));
});
