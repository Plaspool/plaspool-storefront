import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

// `next lint` roots at apps/storefront and only scans app|pages|components|lib|src
// inside that project, so nothing under packages/ is reachable from it. This config
// restores the coverage those files had before they moved out of the app, using the
// same ruleset the storefront uses (`next/core-web-vitals`) so the bar is unchanged.
const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/out/**",
      "**/build/**",
      "**/coverage/**",
      // Linted by `next lint` via apps/storefront/.eslintrc.json.
      "apps/**",
    ],
  },
  ...compat.extends("next/core-web-vitals").map((config) => ({
    ...config,
    files: ["packages/**/*.ts", "packages/**/*.tsx"],
  })),
  {
    files: ["packages/**/*.ts", "packages/**/*.tsx"],
    settings: {
      // Packages are consumed by the storefront; point the Next plugin at it so it
      // does not warn about being unable to detect the Next.js root directory.
      next: { rootDir: "apps/storefront" },
    },
  },
];
