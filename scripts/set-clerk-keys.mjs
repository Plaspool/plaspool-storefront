#!/usr/bin/env node
/**
 * Put both Clerk keys where each one belongs, and prove it worked.
 *
 *   1. Create `.env.clerk.local` in the repo root (already gitignored):
 *
 *        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
 *        CLERK_SECRET_KEY=sk_live_...
 *
 *   2. node scripts/set-clerk-keys.mjs            # do it, stop before committing
 *      node scripts/set-clerk-keys.mjs --push     # ...and commit + push
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
const after = before.replace(
  /export const CLERK_PUBLISHABLE_KEY =[\s\S]*?;\s*$/,
  `export const CLERK_PUBLISHABLE_KEY =${EOL}  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '${pk}';${EOL}`,
);
if (after === before) {
  die(`Could not find CLERK_PUBLISHABLE_KEY to rewrite in\n    ${TARGET}`);
}
writeFileSync(TARGET, after);
console.log('  ✔ Publishable key written to apps/storefront/lib/auth/publishable.ts');

/* ── 2. Secret key → wrangler, via stdin, never to disk ──────────────────── */
if (sk && !skipSecret) {
  try {
    execFileSync('npx', ['wrangler', 'secret', 'put', 'CLERK_SECRET_KEY'], {
      cwd: APP,
      input: sk,
      stdio: ['pipe', 'inherit', 'inherit'],
      shell: true,
    });
    console.log('  ✔ Secret key uploaded as a Worker secret (not committed)');
  } catch {
    die(
      'wrangler could not set CLERK_SECRET_KEY.\n' +
        '    Run `npx wrangler login` from apps/storefront, then re-run this.\n' +
        '    The publishable key above was still written — re-running is safe.',
    );
  }
}

/* ── 3. Prove the publishable key actually reaches the bundle ────────────── */
console.log('\n  Building — this is the check that was missing last time.\n');
execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit', shell: true });

const found = execFileSync(
  'node',
  [
    '-e',
    `const {readdirSync,readFileSync,statSync}=require('fs');const {join}=require('path');
     const dir=${JSON.stringify(join(APP, '.next/static/chunks'))};let hit=false;
     const walk=(d)=>{for(const f of readdirSync(d)){const p=join(d,f);
       if(statSync(p).isDirectory())walk(p);
       else if(f.endsWith('.js')&&readFileSync(p,'utf8').includes(${JSON.stringify(pk)}))hit=true;}};
     walk(dir);process.stdout.write(hit?'FOUND':'MISSING');`,
  ],
  { cwd: ROOT, encoding: 'utf8' },
).trim();

if (found !== 'FOUND') {
  die('Built, but the publishable key is NOT in any client chunk. Do not deploy.');
}
console.log('\n  ✔ Publishable key confirmed present in the built client bundle.');

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
