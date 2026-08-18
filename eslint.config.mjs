import next from "eslint-config-next/core-web-vitals";

/**
 * One ESLint config for the whole monorepo.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * IT USED TO BE TWO, AND THE REASON IS GONE.
 *
 * `next lint` rooted at `apps/storefront` and only scanned `app|pages|
 * components|lib|src` inside that project, so nothing under `packages/` was
 * reachable from it. This file existed to restore that coverage, and deliberately
 * ignored `apps/**` so the two did not lint the same files twice — with
 * `apps/storefront/.eslintrc.json` holding the other half.
 *
 * Next.js 16 REMOVED `next lint`. So the split has nothing left to reconcile:
 * one flat config at the root covers the app and the packages with the same
 * ruleset, which is what the old comment said it was trying to achieve anyway.
 *
 * `.eslintrc.json` is deleted with it. `@next/eslint-plugin-next` defaults to
 * flat config in 16, ahead of ESLint v10 dropping legacy support, and
 * `eslint-config-next/core-web-vitals` now exports a flat array directly — so
 * `FlatCompat` is gone too, along with the `@eslint/eslintrc` dependency that
 * existed only to provide it.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/.open-next/**",
      "**/.wrangler/**",
      "**/out/**",
      "**/build/**",
      "**/coverage/**",
    ],
  },
  ...next.map((config) => ({
    ...config,
    files: ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}"],
  })),
  {
    files: ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}"],
    settings: {
      /* The packages are consumed by the storefront rather than being apps of
         their own, so the Next plugin is pointed at the one real app — without
         it, it warns that it cannot detect the Next.js root directory. */
      next: { rootDir: "apps/storefront" },
    },
  },
];
