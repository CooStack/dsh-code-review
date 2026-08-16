import { createHighlighterCoreSync } from "shiki/core";
import { createJavaScriptRegexEngine, defaultJavaScriptRegexConstructor } from "shiki/engine/javascript";
import langBash from "@shikijs/langs/shellscript";
import langC from "@shikijs/langs/c";
import langCpp from "@shikijs/langs/cpp";
import langCsharp from "@shikijs/langs/csharp";
import langCss from "@shikijs/langs/css";
import langGo from "@shikijs/langs/go";
import langHtml from "@shikijs/langs/html";
import langIni from "@shikijs/langs/ini";
import langJava from "@shikijs/langs/java";
import langJson from "@shikijs/langs/json";
import langKotlin from "@shikijs/langs/kotlin";
import langLua from "@shikijs/langs/lua";
import langMarkdown from "@shikijs/langs/markdown";
import langPhp from "@shikijs/langs/php";
import langPython from "@shikijs/langs/python";
import langRuby from "@shikijs/langs/ruby";
import langRust from "@shikijs/langs/rust";
import langScss from "@shikijs/langs/scss";
import langSql from "@shikijs/langs/sql";
import langSwift from "@shikijs/langs/swift";
import langToml from "@shikijs/langs/toml";
import langTs from "@shikijs/langs/typescript";
import langXml from "@shikijs/langs/xml";
import langYaml from "@shikijs/langs/yaml";

const theme = {
  name: "dsh-code-review",
  type: "dark",
  colors: {
    "editor.foreground": "var(--dcr-syntax-plain)",
    "editor.background": "var(--dcr-diff-context-bg)",
  },
  tokenColors: [
    { settings: { foreground: "var(--dcr-syntax-plain)" } },
    { scope: ["comment", "string.quoted.docstring.multi"], settings: { foreground: "var(--dcr-syntax-comment)" } },
    { scope: ["string", "string.quoted", "string.regexp", "string.template", "markup.inline"], settings: { foreground: "var(--dcr-syntax-string)" } },
    { scope: ["constant.numeric"], settings: { foreground: "var(--dcr-syntax-number)" } },
    { scope: ["constant", "constant.language", "variable.other.constant", "variable.language.this"], settings: { foreground: "var(--dcr-syntax-constant)" } },
    { scope: ["keyword", "storage.type", "storage.modifier", "storage.control"], settings: { foreground: "var(--dcr-syntax-keyword)" } },
    { scope: ["entity.name.type", "entity.name.class", "entity.other.inherited-class", "support.type", "support.class"], settings: { foreground: "var(--dcr-syntax-type)" } },
    { scope: ["meta.property-name", "variable.other.property", "support.type.property-name", "entity.other.attribute-name"], settings: { foreground: "var(--dcr-syntax-property)" } },
    { scope: ["entity.name.function", "support.function", "meta.function-call", "meta.instance.constructor"], settings: { foreground: "var(--dcr-syntax-function)" } },
    { scope: ["variable", "variable.parameter", "variable.other", "meta.definition.variable.name"], settings: { foreground: "var(--dcr-syntax-variable)" } },
    { scope: ["keyword.operator", "punctuation.separator.key-value"], settings: { foreground: "var(--dcr-syntax-operator)" } },
    { scope: ["punctuation", "meta.brace", "meta.delimiter"], settings: { foreground: "var(--dcr-syntax-punctuation)" } },
  ],
};

const engine = createJavaScriptRegexEngine({
  forgiving: true,
  regexConstructor: (pattern) => defaultJavaScriptRegexConstructor(pattern, { lazyCompileLength: Number.POSITIVE_INFINITY }),
});

const highlighter = createHighlighterCoreSync({
  themes: [theme],
  langs: [
    langTs, langBash, langJson, langPython, langRuby, langGo, langRust, langJava,
    langC, langCpp, langCsharp, langKotlin, langSwift, langPhp, langYaml, langToml,
    langIni, langMarkdown, langHtml, langCss, langScss, langSql, langXml, langLua,
  ],
  engine,
});

const extensions = new Map([
  ["js", "typescript"], ["jsx", "typescript"], ["ts", "typescript"], ["tsx", "typescript"],
  ["mjs", "typescript"], ["cjs", "typescript"], ["json", "json"], ["jsonc", "json"],
  ["sh", "shellscript"], ["bash", "shellscript"], ["zsh", "shellscript"],
  ["py", "python"], ["rb", "ruby"], ["go", "go"], ["rs", "rust"], ["java", "java"],
  ["c", "c"], ["h", "c"], ["cc", "cpp"], ["cpp", "cpp"], ["cxx", "cpp"], ["hpp", "cpp"],
  ["cs", "csharp"], ["kt", "kotlin"], ["kts", "kotlin"], ["swift", "swift"], ["php", "php"],
  ["yaml", "yaml"], ["yml", "yaml"], ["toml", "toml"], ["ini", "ini"], ["cfg", "ini"],
  ["md", "markdown"], ["markdown", "markdown"], ["html", "html"], ["htm", "html"],
  ["css", "css"], ["scss", "scss"], ["sql", "sql"], ["xml", "xml"], ["lua", "lua"],
]);

function languageFromPath(path) {
  const normalized = String(path ?? "").replace(/\\/g, "/");
  const name = normalized.slice(normalized.lastIndexOf("/") + 1).toLowerCase();
  if (name === "dockerfile" || name === "makefile") return "shellscript";
  const dot = name.lastIndexOf(".");
  return dot < 0 ? undefined : extensions.get(name.slice(dot + 1));
}

function highlightLines(code, lang) {
  if (typeof code !== "string" || lang === undefined) return undefined;
  try {
    const { tokens } = highlighter.codeToTokens(code, { lang, theme: theme.name, tokenizeTimeLimit: 3000 });
    const last = tokens[tokens.length - 1];
    const lines = tokens.length > 1 && last?.length === 0 ? tokens.slice(0, -1) : tokens;
    return lines.map((line) => line.map((token) => ({ text: token.content, color: token.color })));
  } catch {
    return undefined;
  }
}

window.__DSH_CODE_REVIEW_HIGHLIGHTER__ = Object.freeze({ highlightLines, languageFromPath });
