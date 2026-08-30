#!/usr/bin/env node
/**
 * Set Clerk's publishable key, prove it reaches the bundle, and ship it.
 *
 *   node scripts/set-clerk-key.mjs pk_live_xxxxxxxxxxxxxxxxxxxx
 *   node scripts/set-clerk-key.mjs pk_live_xxxx --push
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY A SCRIPT AND NOT A DASHBOARD SETTING.
 *
 * The key belongs in the BUILD environment, and Cloudflare keeps Workers Builds
 * variables separate from runtime secrets — with no `wrangler` command for the
 * former. Set as a runtime secret alone it is invisible to `next build`, which
 * inlines `NEXT_PUBLIC_*`, so the bundle ships without it and Clerk never
 * initialises. The build stays green the whole way.
 *
 * A publishable key is not a secret — it is served to every visitor in the
 * client bundle — so committing it removes the dashboard from the loop
 * entirely. See `apps/storefront/lib/auth/publishable.ts`.
 *
 * WHAT THIS REFUSES TO DO: accept a SECRET key. `sk_` in this file would be a
 * catastrophe — it would be committed to the repository and compiled into the
 * browser bundle. The check below is the point of the script as much as the
 * edit is.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = join(ROOT, 'apps/storefront/lib/auth/publishable.ts');

const key = (process.argv[2] ?? '').trim();
const push = process.argv.includes('--push');

function die(message) {
  console.error(`\n  ✖ ${message}\n`);
  process.exit(1);
}

if (!key) {
  die(
    'Usage: node scripts/set-clerk-key.mjs <publishable-key> [--push]\n' +
      '    Find it at https://dashboard.clerk.com → API keys → "Publishable key".\n' +
      '    It starts with pk_live_ (production) or pk_test_ (development).',
  );
}

/* THE GUARD THAT MATTERS. A secret key here would be committed AND shipped to
   every browser — the two worst places it could possibly go. */
if (key.startsWith('sk_')) {
  die(
    'That is a SECRET key. It must never be committed or sent to a browser.\n' +
      '    Set it as a runtime secret instead, from apps/storefront:\n' +
      '      npx wrangler secret put CLERK_SECRET_KEY\n' +
      '    Then re-run this with the PUBLISHABLE key (pk_…).',
  );
}

if (!/^pk_(live|test)_[A-Za-z0-9+/=_-]{16,}$/.test(key)) {
  die(
    `That does not look like a Clerk publishable key: ${JSON.stringify(key.slice(0, 12))}…\n` +
      '    Expected pk_live_… or pk_test_… . Copy it from Clerk → API keys.',
  );
}

/*
 * A publishable key encodes its own Frontend API host, so it can be checked
 * rather than trusted: base64 of "<host>$". Decoding it here means a key pasted
 * from the wrong instance is caught now, not after a deploy.
 */
let host = '(could not decode)';
try {
  const decoded = Buffer.from(key.split('_').slice(2).join('_'), 'base64').toString('utf8');
  if (decoded.endsWith('$')) host = decoded.slice(0, -1);
} catch {
  /* Non-fatal — the regex above already established the shape. */
}

const before = readFileSync(TARGET, 'utf8');
const after = before.replace(
  /export const CLERK_PUBLISHABLE_KEY =[\s\S]*?;\n$/,
  `export const CLERK_PUBLISHABLE_KEY =\n  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '${key}';\n`,
);

if (after === before) {
  die(
    `Could not find the CLERK_PUBLISHABLE_KEY export to rewrite in\n    ${TARGET}\n` +
      '    Set it by hand instead — it is the last line of that file.',
  );
}

writeFileSync(TARGET, after);

console.log(`
  ✔ Wrote the publishable key.
      instance : ${host}
      file     : apps/storefront/lib/auth/publishable.ts

  Building to prove it actually reaches the client bundle — this is the step
  that was missing, and it is why the last deploy shipped a dead sign-in page.
`);

execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit', shell: true });

/*
 * THE ONLY CHECK THAT COUNTS. A green build proved nothing last time; the key
 * being present in a compiled chunk is the thing that was actually false.
 */
const grep = execFileSync(
  'node',
  [
    '-e',
    `const {readdirSync,readFileSync,statSync}=require('fs');const {join}=require('path');
     const dir=${JSON.stringify(join(ROOT, 'apps/storefront/.next/static/chunks'))};
     let hit=false;
     const walk=(d)=>{for(const f of readdirSync(d)){const p=join(d,f);
       if(statSync(p).isDirectory())walk(p);
       else if(f.endsWith('.js')&&readFileSync(p,'utf8').includes(${JSON.stringify(key)}))hit=true;}};
     walk(dir);process.stdout.write(hit?'FOUND':'MISSING');`,
  ],
  { cwd: ROOT, encoding: 'utf8' },
);

if (grep.trim() !== 'FOUND') {
  die('Built, but the key is NOT in any client chunk. Do not deploy this — investigate first.');
}

console.log('\n  ✔ Key confirmed present in the built client bundle.\n');

if (!push) {
  console.log(
    '  Nothing has been committed. Review, then:\n' +
      '    git add -A && git commit -m "Commit the Clerk publishable key" && git push\n' +
      '  Or re-run this with --push to do it for you.\n',
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
      'It is public by design — served to every visitor in the client bundle —\n' +
      'and it was the one value the deploy could not get hold of. As\n' +
      'NEXT_PUBLIC_* it is inlined by `next build`, and on Workers Builds a\n' +
      'value set only as a runtime secret is invisible to the build: the bundle\n' +
      'shipped without it, Clerk never initialised, and sign-in rendered\n' +
      'perfectly while doing nothing, on a green build.',
  ],
  { cwd: ROOT, stdio: 'inherit' },
);
execFileSync('git', ['push'], { cwd: ROOT, stdio: 'inherit' });

console.log('\n  ✔ Pushed. Workers Builds will redeploy master.\n');
