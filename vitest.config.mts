import { defineConfig } from "vitest/config";

/**
 * One Vitest config for the whole monorepo, for the same reason
 * `eslint.config.mjs` is one flat config: the packages are consumed by the one
 * app rather than being projects of their own, so a per-workspace runner would
 * be five copies of this file to keep in sync.
 *
 * `npm test` from the repo root runs everything under `apps/*` and
 * `packages/*`; `npm test -- packages/shop` narrows it to one workspace by
 * path, which is what a per-workspace script would have done anyway.
 *
 * VITEST RATHER THAN JEST, and the deciding reason is the peer-dependency rule
 * in CLAUDE.md: `next` and `react` are peers of every `packages/*` workspace,
 * and a Jest setup here means `jest-environment-jsdom`, `babel-jest` and a
 * transform chain, several of which pull their own React tooling. Vitest ships
 * one dependency tree (Vite + esbuild) that touches neither, so nothing in this
 * suite can install a second copy of react/next/@types/react and make prop
 * types mutually unassignable. It is also what `plaspool-admin` already runs,
 * so the two repos stay consistent.
 *
 * `environment: "node"` on purpose. Everything covered here is pure logic or a
 * fetch client; the one component test renders through `react-dom/server`,
 * which is how these components actually run — they are Server Components.
 * No jsdom, no testing-library, no second React.
 */
export default defineConfig({
  // The shared tsconfig sets `jsx: "preserve"` because Next does the
  // transform. Vitest is not Next, so the JSX runtime is named here instead.
  // (Vite's transformer is oxc as of Vite 7 / Vitest 4; an `esbuild` block is
  // accepted but ignored, with a warning.)
  oxc: {
    jsx: { runtime: "automatic" },
  },
  test: {
    environment: "node",
    include: ["{apps,packages}/*/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/.next/**", "**/.open-next/**", "**/.wrangler/**"],
  },
});
