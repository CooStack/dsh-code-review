import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const clientSource = await readFile(
  new URL("../lib/client.js", import.meta.url),
  "utf8",
);
const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);

test("plugin settings follow the standalone plugin card contract", () => {
  assert.doesNotMatch(
    clientSource,
    /@deepseek-ai\/dsh-client-ui-layout/,
    "settings must not be blocked by the optional layout provider",
  );
  assert.match(
    clientSource,
    /settings\.plugin\.item/,
    "the review settings must register its own settings slot item",
  );
  assert.match(
    clientSource,
    /\/api\/dsh-code-review\/config/,
    "font settings must use the review config API",
  );
  assert.match(clientSource, /function LegacyDiffView/, "history-only diffs must keep plugin syntax highlighting");
  assert.match(clientSource, /配置 API 尚未加载，请重启 DSH Web profile/, "missing Host API must explain the reload requirement");
});

test("client bundle uses the same minimal inject surface as working plugin settings", () => {
  assert.deepEqual(packageJson.dsh.client.inject, [
    "@deepseek-ai/dsh-client-runtime",
    "@deepseek-ai/dsh-client-ui-settings-plugins",
    "@deepseek-ai/dsh-client-ui-primitives",
  ]);
});
