#!/usr/bin/env bash
# Rebuilds index.html from template.html, the real mod code and the simulated run.
#   1. bundles src/sim.ts (which imports live.ts, frame.ts and desktop.ts) for the browser,
#   2. reads the mod files the code panel quotes (the page cuts excerpts by line number),
#   3. puts both into template.html and writes index.html.
# If you change a mod file, check that the line numbers in STEPS (template.html) still match.
set -euo pipefail
cd "$(dirname "$0")"
MOD=../mods/agent-orbit
mkdir -p .build
bun build src/sim.ts --target browser --format esm --outfile .build/sim.js
bun -e '
const fs = require("fs");
const mod = process.argv[1];
const files = {
  "plugin.json": mod + "/.claude-plugin/plugin.json",
  "hooks.json": mod + "/hooks/hooks.json",
  "register.tsx": mod + "/hooks/register.tsx",
  "live.ts": mod + "/hooks/live.ts",
  "frame.ts": mod + "/hooks/frame.ts",
  "desktop.ts": mod + "/hooks/desktop.ts",
};
const sources = {};
for (const [k, p] of Object.entries(files)) sources[k] = fs.readFileSync(p, "utf8");
const safe = s => s.replace(/<\/script/gi, "<\\/script");
let html = fs.readFileSync("template.html", "utf8");
const bundle = fs.readFileSync(".build/sim.js", "utf8");
html = html.replace("/*__SOURCES__*/", () => "window.SOURCES = " + safe(JSON.stringify(sources)) + ";");
html = html.replace("/*__BUNDLE__*/", () => safe(bundle));
fs.writeFileSync("index.html", html);
console.log("index.html written:", (html.length / 1024).toFixed(0), "KB");
' "$MOD"
