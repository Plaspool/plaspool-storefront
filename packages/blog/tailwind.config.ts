import path from "path";

import type { Config } from "tailwindcss";
import preset from "@plaspool/ui/tailwind-preset";

// Content globs are resolved with `path.join(__dirname, ...)` rather than
// left relative: Turbopack's postcss transform runs this config in a
// sandboxed Node context whose cwd is not reliably this package's
// directory, so plain relative globs silently match nothing there (Tailwind
// then emits Preflight only — no `bg-white`, `flex`, etc. — even though
// `next tailwindcss -i ... -c tailwind.config.ts` run from the CLI, which
// does use this directory as cwd, looks fine).
export default {
  presets: [preset],
  darkMode: ["class"],
  content: [
    path.join(__dirname, "dev/**/*.{ts,tsx}"),
    path.join(__dirname, "src/**/*.{ts,tsx}"),
    path.join(__dirname, "../*/src/**/*.{ts,tsx}"),
  ],
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
