#!/usr/bin/env node
/**
 * Build and deploy the DEVELOPMENT environment — `dev.plaspool.com`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS IS A SCRIPT AND NOT TWO LINES IN `package.json`.
 *
 * The build has to run with `PLASPOOL_TARGET=development` in its environment,
 * and npm scripts cannot set one portably: `PLASPOOL_TARGET=development ...`
 * is shell syntax that Windows `cmd` and PowerShell do not understand, and the
 * usual fix (`cross-env`) is a dependency for something Node can already do.
 * `scripts/typecheck.mjs` and `scripts/set-clerk-keys.mjs` at the repository
 * root are the same pattern.
 *
 * ═══ THE FAILURE THIS EXISTS TO PREVENT, WHICH ALMOST HAPPENED ═══
 * `wrangler deploy --env dev` DOES NOT BUILD. It ships whatever is already in
 * `.open-next/`, and that directory survives branch switches, `git pull` and
 * weeks of not being looked at. Running it by hand against an 18-day-old build
 * would have published `dev.plaspool.com` serving the PRODUCTION API, with
 * production's CSP, indexable by Google and the `www.` redirect live — every
 * protection in `packages/brand/src/environment.ts` defeated, not by a bug in
 * it, but by a stale folder.
 *
 * So this script always builds, and always builds with the target set. There
 * is no `--skip-build` flag on purpose: the only reason to want one is to
 * deploy something already built, which is exactly the mistake above.
 *
 * ⚠  DEPLOYS THE WORKING TREE, NOT A BRANCH. Whatever is checked out right now
 * is what reaches `dev.plaspool.com`, uncommitted changes included. That is
 * useful for getting a change in front of somebody quickly and it is NOT how
 * the environment is meant to be fed — Workers Builds deploying the `develop`
 * branch is, because that is reproducible and this is not. Use this for the
 * first deploy (which is what creates the hostname's DNS record and
 * certificate) and for one-offs.
 *
 * PRODUCTION IS NOT REACHABLE FROM HERE, deliberately. `npm run deploy` is the
 * production path and CLAUDE.md reserves it for a human. This script hardcodes
 * the development environment in both places it matters — the build target and
 * the Wrangler environment — so there is no argument anyone can pass to point
 * it at the live shop.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { spawnSync } from "node:child_process";

const TARGET = "development";
const WRANGLER_ENV = "dev";

/**
 * `shell: true` because on Windows the thing on PATH is `opennextjs-cloudflare.cmd`,
 * a batch shim that `spawnSync` will not execute directly — it fails with
 * EINVAL, which reads as a missing binary rather than a platform quirk.
 */
function run(step, args) {
  console.log(`\n▶ ${step}\n  opennextjs-cloudflare ${args.join(" ")}\n`);

  const result = spawnSync("opennextjs-cloudflare", args, {
    stdio: "inherit",
    shell: true,
    /*
     * The target is injected here rather than exported into the caller's shell.
     * A `$env:PLASPOOL_TARGET` left set in a long-lived terminal is a real
     * hazard — it would silently bake development hosts into the NEXT
     * production build run from that same window, with nothing to see.
     */
    env: { ...process.env, NEXT_PUBLIC_PLASPOOL_TARGET: TARGET },
  });

  if (result.error) {
    console.error(`\n✘ ${step} could not start: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`\n✘ ${step} failed (exit ${result.status}). Nothing was deployed.`);
    process.exit(result.status ?? 1);
  }
}

console.log(
  `Building and deploying the ${TARGET} environment ` +
    `(wrangler env "${WRANGLER_ENV}") → https://dev.plaspool.com`,
);

run("Build", ["build", "--env", WRANGLER_ENV]);
run("Deploy", ["deploy", "--env", WRANGLER_ENV]);

console.log(
  "\n✔ Deployed to https://dev.plaspool.com" +
    "\n  The first deploy creates the DNS record and certificate, so the" +
    "\n  hostname can take a few minutes to resolve.",
);
