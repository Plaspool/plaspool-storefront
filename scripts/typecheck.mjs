#!/usr/bin/env node
// Runs `tsc --noEmit` against every project under apps/* and packages/* that
// has a tsconfig.json — discovered by directory listing, not hardcoded.
//
// Why this exists instead of a fixed list of `tsc -p` invocations: package
// coverage used to be *incidental* (a package with no importer into the app
// would slip through `npm run build`'s transitive TS program unnoticed). A
// hardcoded list of paths here would trade that for a different but
// equally-silent hole — a newly added package simply wouldn't be covered
// until a human remembered to append a line. This script instead discovers
// `apps/*/tsconfig.json` and `packages/*/tsconfig.json` at run time, so a
// new package (e.g. `packages/shop`) is covered automatically the moment it
// gets a tsconfig.json, with no edit to this file or to package.json.
//
// ═══ AND ONE LEVEL DEEPER, WHICH IS NOT A FLOURISH ═══
// Discovery used to stop at `packages/*`, and three Next dev harnesses live at
// `packages/*/dev` — blog's, shop's and web's. Each has its own tsconfig.json,
// each imports the package it exercises, and none of them was covered by
// anything: not by this script, not by `npm run build` (the app never imports a
// harness), not by `npm run lint` (which does not typecheck). So they rotted in
// silence. `packages/shop/dev/app/kit/page.tsx` — the component gallery — had
// been serving an HTTP 500 for some time: it still imported a `COLOURS` export
// that had been renamed and called `listProducts()` as though the catalogue
// were still a local array rather than an async call against the commerce API.
//
// A harness is exactly the code most likely to rot, because nothing else
// imports it and nobody loads it on a normal day. Covering only the one that
// broke would leave the same hole under the other two, so discovery walks one
// level into each workspace rather than naming `dev`.

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(import.meta.url);

// Resolve the real `tsc` entry point and invoke it directly with `node`,
// rather than shelling out to `npx tsc` — avoids depending on a shell (this
// has to run under cmd.exe on Windows via npm scripts) and avoids passing
// unescaped args through a shell.
const tscBin = require.resolve("typescript/bin/tsc");

// Generated or vendored trees, which never hold a project we mean to check.
// Dot-directories (`.next`, `.turbo`, `.git`) are excluded by the leading-dot
// test below rather than named here.
const NOT_SOURCE = new Set(["node_modules", "dist", "build", "out", "coverage"]);

function subdirectories(relDir) {
  const abs = join(repoRoot, relDir);
  if (!existsSync(abs)) return [];

  return readdirSync(abs, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() && !entry.name.startsWith(".") && !NOT_SOURCE.has(entry.name)
    )
    .map((entry) => join(relDir, entry.name));
}

function discoverTsconfigs(rootDirName) {
  const found = [];

  for (const workspace of subdirectories(rootDirName)) {
    // The workspace's own project, then any nested one (`packages/*/dev`).
    for (const dir of [workspace, ...subdirectories(workspace)]) {
      const relPath = join(dir, "tsconfig.json");
      if (existsSync(join(repoRoot, relPath))) found.push(relPath);
    }
  }

  return found;
}

const targets = [...discoverTsconfigs("apps"), ...discoverTsconfigs("packages")];

if (targets.length === 0) {
  console.error(
    "typecheck: found no tsconfig.json under apps/* or packages/* — that's " +
      "almost certainly wrong, failing rather than silently reporting success."
  );
  process.exit(1);
}

console.log(`typecheck: covering ${targets.length} project(s):`);
for (const target of targets) console.log(`  - ${target}`);

for (const target of targets) {
  console.log(`\n> tsc --noEmit -p ${target}`);
  const result = spawnSync(process.execPath, [tscBin, "--noEmit", "-p", target], {
    cwd: repoRoot,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(`typecheck: failed to run tsc for ${target}:`, result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
