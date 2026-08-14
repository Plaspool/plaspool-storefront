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

function discoverTsconfigs(rootDirName) {
  const rootDir = join(repoRoot, rootDirName);
  if (!existsSync(rootDir)) return [];

  return readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(rootDirName, entry.name, "tsconfig.json"))
    .filter((relPath) => existsSync(join(repoRoot, relPath)));
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
