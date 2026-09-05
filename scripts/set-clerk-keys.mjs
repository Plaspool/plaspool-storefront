#!/usr/bin/env node
/**
 * Put both Clerk keys where each one belongs, and prove it worked.
 *
 *   1. Create `.env.clerk.local` in the repo root (already gitignored):
 *
 *        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
 *        CLERK_SECRET_KEY=sk_live_...
 *
 *   2. node scripts/set-clerk-keys.mjs               # the PRODUCTION Worker
 *      node scripts/set-clerk-keys.mjs --env dev     # dev.plaspool.com's Worker
 *      node scripts/set-clerk-keys.mjs --push        # ...and commit + push
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠  A SECRET BELONGS TO ONE WORKER. RUN THIS ONCE PER ENVIRONMENT.
 *
 * `wrangler.jsonc` gives the development environment its own Worker —
 * `plaspool-storefront-dev` — and a Cloudflare secret is scoped to the Worker
 * it was set on. It is NOT inherited the way `main` and `compatibility_date`
 * are. The config file already warns that `kv_namespaces`, `services` and
 * `vars` are not inherited; secrets are the same and are easier to miss,
 * because nothing in the repository lists them.
 *
 * WHAT THAT OMISSION LOOKS LIKE, having cost an evening once: sign-in on
 * `dev.plaspool.com` answers `501 {"error":"not_implemented"}` from
 * `/api/auth/bridge` and nothing else is wrong. The site renders, Clerk signs
 * the shopper in, and the browser then reports `session_exists` on the next
 * attempt because the Clerk session is real and only the SHOP session is
 * missing. `apps/storefront/lib/auth/config.ts` explains why that 501 is the
 * correct report of a missing key rather than a crash.
 *
 * BOTH ENVIRONMENTS SHARE ONE CLERK INSTANCE (`clerk.plaspool.com`), so it is
 * the SAME `sk_live_…` on both Workers — there is no second key to fetch. Run
 * the command twice, once with `--env dev`.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE TWO KEYS ARE NOT THE SAME KIND OF THING, AND THIS IS THE WHOLE POINT.
 *
 *   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY → COMMITTED TO SOURCE.
 *     Public by definition: `next build` inlines it into the client bundle and
 *     it is served to every visitor. It authorises nothing on its own. It is
 *     committed because as a build-time environment variable it silently did
 *     not arrive — Cloudflare keeps Workers Builds variables separate from
 *     runtime secrets, there is no `wrangler` command for the former, and a
 *     value set only as a secret is invisible to the build. The bundle shipped
 *     without it, Clerk never initialised, and the sign-in page rendered
 *     perfectly while doing nothing, on a green build and a green deploy.
 *
 *   CLERK_SECRET_KEY → `wrangler secret put`, AND NOWHERE ELSE.
 *     It authenticates this app to Clerk's Backend API for EVERY user in the
 *     instance. It is piped straight to wrangler and never written into the
 *     repository, never echoed, and never placed anywhere `next build` could
 *     reach and inline.
 *
 * A FILE RATHER THAN ARGUMENTS, deliberately: a secret passed as `argv` lands
 * in shell history and in the process table. `.env.clerk.local` matches the
 * repository's existing `.env*.local` ignore rule, and this script verifies
 * that with `git check-ignore` before it reads a single value.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENV_FILE = join(ROOT, '.env.clerk.local');
const TARGET = join(ROOT, 'apps/storefront/lib/auth/publishable.ts');
const APP = join(ROOT, 'apps/storefront');

const push = process.argv.includes('--push');
const skipSecret = process.argv.includes('--no-secret');

const die = (m) => {
  console.error(`\n  ✖ ${m}\n`);
  process.exit(1);
};

/**
 * Which Wrangler environment the SECRET is uploaded to. Absent means the
 * production Worker — the top-level `name` in `wrangler.jsonc`, and the
 * behaviour this script has always had.
 *
 * NOT VALIDATED AGAINST A LIST HERE, deliberately. Wrangler already checks the
 * name against the config and says `No environment found in configuration with
 * name <x>`, which is a better error than anything this script could invent and
 * cannot go stale when an environment is added. All that is checked is that a
 * value was actually supplied — `--env` with nothing after it would otherwise
 * be handed to wrangler as a missing argument and fail somewhere less obvious.
 *
 * ⚠  AFFECTS THE SECRET ONLY. The publishable key is a single committed
 * constant in `lib/auth/publishable.ts` serving BOTH deployments, so steps 1
 * and 3 below do the same work whichever environment is named — which is
 * correct, and is why `--env dev` is safe to run on a clean tree.
 */
function wranglerEnv() {
  const i = process.argv.findIndex((a) => a === '--env' || a.startsWith('--env='));
  if (i === -1) return null;

  const value = process.argv[i].startsWith('--env=')
    ? process.argv[i].slice('--env='.length)
    : process.argv[i + 1];

  if (!value || value.startsWith('--')) {
    die('`--env` needs a value, e.g. `--env dev`. Omit it entirely for production.');
  }
  return value;
}

const WRANGLER_ENV = wranglerEnv();
/* Spread into every wrangler invocation; empty for production. */
const ENV_ARGS = WRANGLER_ENV ? ['--env', WRANGLER_ENV] : [];

if (!existsSync(ENV_FILE)) {
  die(
    'Create `.env.clerk.local` in the repo root with both keys:\n\n' +
      '      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...\n' +
      '      CLERK_SECRET_KEY=sk_live_...\n\n' +
      '    Both are at https://dashboard.clerk.com → API keys.\n' +
      '    The file is gitignored; this script deletes it when it is done.',
  );
}

/* THE FILE HOLDS A SECRET. Refuse to read it at all unless git is certainly
   ignoring it — a committed secret key is unrecoverable, you can only rotate. */
try {
  execFileSync('git', ['check-ignore', '-q', ENV_FILE], { cwd: ROOT });
} catch {
  die(
    '`.env.clerk.local` is NOT gitignored. Refusing to read a secret key into a\n' +
      '    file git would track. Add `.env*.local` to .gitignore and re-run.',
  );
}

const env = Object.fromEntries(
  readFileSync(ENV_FILE, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);

const pk = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';
const sk = env.CLERK_SECRET_KEY ?? '';

if (!pk) die('`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is missing from .env.clerk.local');
if (!sk && !skipSecret) {
  die('`CLERK_SECRET_KEY` is missing from .env.clerk.local (or pass --no-secret)');
}

/*
 * THE SWAP CHECK. Pasting these the wrong way round is the single worst
 * outcome available here: the secret key would be committed to the repository
 * AND compiled into the browser bundle, and the only remedy is rotation.
 */
if (pk.startsWith('sk_')) {
  die(
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY holds a SECRET key (sk_…).\n' +
      '    That value would be committed and shipped to every browser.\n' +
      '    The two keys are the wrong way round — swap them and re-run.',
  );
}
if (sk && !sk.startsWith('sk_')) {
  die('CLERK_SECRET_KEY does not start with `sk_`. The two keys look swapped.');
}
if (!/^pk_(live|test)_[A-Za-z0-9+/=_-]{16,}$/.test(pk)) {
  die(`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not a Clerk publishable key: "${pk.slice(0, 12)}…"`);
}

/*
 * A publishable key encodes its own Frontend API host — base64 of "<host>$" —
 * so it can be checked rather than trusted. This catches a key pasted from the
 * wrong Clerk instance now, instead of after a deploy.
 */
let host = '(could not decode)';
try {
  const d = Buffer.from(pk.split('_').slice(2).join('_'), 'base64').toString('utf8');
  if (d.endsWith('$')) host = d.slice(0, -1);
} catch {
  /* shape already validated above */
}
const mode = pk.startsWith('pk_live_') ? 'production' : 'development';
if (sk) {
  const skMode = sk.startsWith('sk_live_') ? 'production' : 'development';
  if (skMode !== mode) {
    die(
      `The keys are from DIFFERENT instances: publishable is ${mode}, secret is ${skMode}.\n` +
        '    Mixing them means the browser talks to one Clerk instance while the\n' +
        '    server verifies against another, and every sign-in fails as a forgery.',
    );
  }
}

console.log(`
  Clerk instance : ${host}
  Mode           : ${mode}
  Worker         : ${WRANGLER_ENV ? `plaspool-storefront (env "${WRANGLER_ENV}")` : 'plaspool-storefront (production)'}
`);

/* ── 1. Publishable key → committed source ───────────────────────────────── */
const before = readFileSync(TARGET, 'utf8');
/*
 * CRLF-AWARE, BECAUSE THIS REPOSITORY IS CHECKED OUT ON WINDOWS. Git converts
 * to CRLF on checkout here, so a pattern anchored on `;\n$` matches the file as
 * committed and NOT the file as it sits on disk — the script then reports that
 * it cannot find the export it is looking straight at. Detect the ending in
 * use and write the same one back, so this leaves no line-ending churn in the
 * diff either.
 */
const EOL = before.includes('\r\n') ? '\r\n' : '\n';
const PATTERN = /export const CLERK_PUBLISHABLE_KEY =[\s\S]*?;\s*$/;

/*
 * ═══ "NOTHING CHANGED" AND "NOTHING MATCHED" ARE DIFFERENT ANSWERS ═══
 * This used to die whenever `replace()` returned an identical string, and
 * treated that as the pattern being missing. But an identical string is also
 * what you get when the key is ALREADY correct — so the second run of this
 * script, with the same key, reported that it could not find the export it was
 * looking straight at. Which made "re-running is safe" untrue at exactly the
 * moment somebody needed it to be: after a partial failure.
 *
 * So the match is tested FIRST, and an unchanged file is a success.
 */
if (!PATTERN.test(before)) {
  die(
    `Could not find the CLERK_PUBLISHABLE_KEY export to rewrite in\n    ${TARGET}\n` +
      '    Set it by hand instead — it is the last statement in that file.',
  );
}

const after = before.replace(
  PATTERN,
  `export const CLERK_PUBLISHABLE_KEY =${EOL}  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '${pk}';${EOL}`,
);

if (after === before) {
  console.log('  ✔ Publishable key already set to this value — nothing to write');
} else {
  writeFileSync(TARGET, after);
  console.log('  ✔ Publishable key written to apps/storefront/lib/auth/publishable.ts');
}

/* ── 2. Secret key → wrangler, via stdin, never to disk ──────────────────── */
if (sk && !skipSecret) {
  /*
   * ═══ `versions secret put` FIRST, AND THAT ORDER IS THE FIX ═══
   *
   * This Worker is deployed by Workers Builds, which runs
   * `opennextjs-cloudflare upload` — i.e. it UPLOADS VERSIONS rather than
   * deploying directly. Against a Worker in that model, plain
   * `wrangler secret put` refuses outright:
   *
   *     Secret edit failed. You attempted to modify a secret, but the latest
   *     version of your Worker isn't currently deployed.
   *
   * That guard exists so editing a secret cannot silently deploy an undeployed
   * version. `wrangler versions secret put` is the command for this model: it
   * creates a new version carrying the secret and deploys nothing.
   *
   * The plain form is kept as a fallback for a Worker that is NOT on versions,
   * so this script stays correct if the deployment model ever changes back.
   */
  const attempts = [
    ['versions', 'secret', 'put', 'CLERK_SECRET_KEY', ...ENV_ARGS],
    ['secret', 'put', 'CLERK_SECRET_KEY', ...ENV_ARGS],
  ];

  let ok = false;
  let lastError = '';
  for (const args of attempts) {
    try {
      execFileSync('npx', ['wrangler', ...args], {
        cwd: APP,
        input: sk,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });
      ok = true;
      console.log(`  ✔ Secret key uploaded via \`wrangler ${args.join(' ')}\` (not committed)`);

      /*
       * ASK CLOUDFLARE WHAT IT ACTUALLY HAS, rather than trusting a zero exit
       * code — the same reason the bundle gets grepped below. Lists NAMES only;
       * Cloudflare never returns secret values, and this must never print one.
       */
      try {
        const listed = execFileSync(
          'npx',
          ['wrangler', 'versions', 'secret', 'list', ...ENV_ARGS],
          { cwd: APP, encoding: 'utf8', shell: true },
        );
        /*
         * NOT LISTED IS THE EXPECTED ANSWER HERE, and calling it a warning was
         * misleading. `versions secret list` reports the secrets on the
         * DEPLOYED version. `versions secret put` deliberately does not deploy
         * — that is the whole reason it is the command this Worker needs — so a
         * freshly uploaded secret is absent from that list until the next
         * Workers Builds deploy carries it forward.
         *
         * ⚠  BUT "EXPECTED" IS NOT THE SAME AS "DONE", AND THE OLD ONE-LINER
         * READ AS IF IT WERE. The key is sitting on a version nothing is
         * serving; every request still runs the previously deployed one, where
         * `CLERK_SECRET_KEY` is absent and `/api/auth/bridge` answers
         * `501 not_implemented`. On production that resolves itself, because
         * merging to `master` deploys within the hour. On the DEVELOPMENT
         * Worker it does not: `develop` can sit untouched for days, so the
         * secret waits on an undeployed version and sign-in stays broken with
         * a green build, a green deploy and a successful run of this script.
         *
         * That is exactly what happened — `wrangler versions list --env dev`
         * showed `Add variable: CLERK_SECRET_KEY` on a version created hours
         * after the one actually serving traffic. So say what makes it live.
         */
        if (listed.includes('CLERK_SECRET_KEY')) {
          console.log('  ✔ Cloudflare lists CLERK_SECRET_KEY on the deployed version');
        } else {
          const envFlag = ENV_ARGS.join(' ');
          console.log(
            '  · Uploaded, but NOT on the version currently serving traffic.\n' +
              '    Until a deploy carries it forward, sign-in still answers 501.\n' +
              '    Ship the next build, or promote the version holding it now:\n\n' +
              `      cd apps/storefront\n` +
              `      npx wrangler versions list ${envFlag}`.trimEnd() +
              '\n' +
              `      npx wrangler versions deploy <id-of-"Add variable: CLERK_SECRET_KEY"> ${envFlag}`.trimEnd() +
              '\n',
          );
        }
      } catch {
        /* Non-fatal: the upload above succeeded, this is only corroboration. */
      }
      break;
    } catch (error) {
      /* Wrangler explains itself well. Show WHAT IT SAID rather than guessing —
         the previous version of this script asserted "run wrangler login" for
         every failure, which sent somebody to fix an auth problem they did not
         have while the real cause was printed directly above it. */
      lastError = [error?.stdout?.toString(), error?.stderr?.toString()]
        .filter(Boolean)
        .join('\n')
        .trim();
    }
  }

  if (!ok) {
    die(
      'wrangler could not set CLERK_SECRET_KEY. It said:\n\n' +
        lastError.split('\n').map((l) => `      ${l}`).join('\n') +
        '\n\n    If that mentions authentication, run `npx wrangler login` from\n' +
        '    apps/storefront. The publishable key was still written, so\n' +
        '    re-running this is safe and repeats no work.',
    );
  }
}

/* ── 3. Prove the publishable key actually reaches the bundle ────────────── */
/*
 * ALWAYS THE DEFAULT (PRODUCTION) BUILD, EVEN UNDER `--env dev`, and that is
 * not an oversight. What this step checks is that the committed publishable key
 * survives compilation, and that key is one constant serving both deployments —
 * so a development-target build would prove exactly the same thing while
 * leaving a development-target `.open-next/` on disk. `deploy-dev.mjs` has the
 * long note on why a stale build directory is the hazard here: `wrangler deploy`
 * ships whatever is already in it, so the wrong one lying around is how
 * `dev.plaspool.com` config reaches production.
 */
console.log('\n  Building — this is the check that was missing last time.\n');
execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit', shell: true });

/*
 * ═══ WHERE THE KEY ACTUALLY LANDS, WHICH IS NOT WHERE YOU WOULD GUESS ═══
 *
 * This searched `.next/static/chunks` only, and reported MISSING for a build
 * that was completely correct — nearly blocking a good deploy, which is the
 * mirror image of the bug the check exists to catch.
 *
 * `CLERK_PUBLISHABLE_KEY` is read in `app/layout.tsx`, a SERVER Component, and
 * handed to `<ClerkProvider>` as a prop. So it is serialised into the RSC
 * payload and the prerendered HTML under `.next/server/app/**` — NOT inlined
 * into a static JS chunk. A static chunk would only carry it if client-side
 * code referenced `process.env.NEXT_PUBLIC_*` directly, which nothing here
 * does any more, and deliberately so.
 *
 * Both trees are searched, so this stays correct either way.
 */
const SEARCH_DIRS = [join(APP, '.next/server/app'), join(APP, '.next/static')];

const found = execFileSync(
  'node',
  [
    '-e',
    `const {readdirSync,readFileSync,statSync,existsSync}=require('fs');const {join}=require('path');
     const dirs=${JSON.stringify(SEARCH_DIRS)};const needle=${JSON.stringify(pk)};
     let where='';
     const walk=(d)=>{if(where||!existsSync(d))return;
       for(const f of readdirSync(d)){const p=join(d,f);
         if(statSync(p).isDirectory()){walk(p);if(where)return;continue;}
         if(!/\\.(js|html|rsc|json|txt)$/.test(f))continue;
         try{if(readFileSync(p,'utf8').includes(needle)){where=p;return;}}catch{}}};
     for(const d of dirs){walk(d);if(where)break;}
     process.stdout.write(where||'MISSING');`,
  ],
  { cwd: ROOT, encoding: 'utf8' },
).trim();

if (found === 'MISSING') {
  die(
    'Built, but the publishable key is in NEITHER the server render nor the\n' +
      '    client chunks. Do not deploy — Clerk would not initialise.',
  );
}
console.log(
  `\n  ✔ Publishable key confirmed in the build output\n      ${found.replace(ROOT, '.')}`,
);

/* ── 4. Clean up the secret from disk ────────────────────────────────────── */
if (sk && !skipSecret) {
  unlinkSync(ENV_FILE);
  console.log('  ✔ Deleted .env.clerk.local (it held the secret key)');
}

if (!push) {
  console.log(
    '\n  Nothing committed. Review, then:\n' +
      '    git add -A && git commit -m "Commit the Clerk publishable key" && git push\n' +
      '  Or re-run with --push.\n',
  );
  process.exit(0);
}

execFileSync('git', ['add', 'apps/storefront/lib/auth/publishable.ts'], { cwd: ROOT, stdio: 'inherit' });

/* Nothing staged means the key was already committed — a re-run after a
   partial failure, which is a success here and not an error to stop on. */
let staged = true;
try {
  execFileSync('git', ['diff', '--cached', '--quiet'], { cwd: ROOT });
  staged = false;
} catch {
  /* non-zero exit means there ARE staged changes */
}

if (!staged) {
  console.log('\n  ✔ Publishable key already committed — pushing any pending commits.\n');
  execFileSync('git', ['push'], { cwd: ROOT, stdio: 'inherit' });
  process.exit(0);
}

execFileSync(
  'git',
  [
    '-c', 'user.name=nathanieluriri',
    '-c', 'user.email=uririnathaniel@gmail.com',
    'commit', '-m',
    'Commit the Clerk publishable key\n\n' +
      'Public by design — inlined into the client bundle and served to every\n' +
      'visitor. It is committed because as a build-time environment variable it\n' +
      'silently never arrived: Workers Builds keeps build variables separate\n' +
      'from runtime secrets, so the bundle shipped without it and sign-in\n' +
      'rendered perfectly while doing nothing, on a green build.\n\n' +
      'CLERK_SECRET_KEY is unaffected and remains a Worker secret.',
  ],
  { cwd: ROOT, stdio: 'inherit' },
);
execFileSync('git', ['push'], { cwd: ROOT, stdio: 'inherit' });
console.log('\n  ✔ Pushed. Workers Builds will redeploy.\n');
