import { build } from "esbuild";

await build({
  entryPoints: ["src/client-entry.js"],
  outfile: "lib/client.bundle.js",
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  minify: true,
  legalComments: "none",
  sourcemap: false,
  logLevel: "info",
});
