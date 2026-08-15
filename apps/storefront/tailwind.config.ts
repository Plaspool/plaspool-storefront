import type { Config } from "tailwindcss";
import preset from "@plaspool/ui/tailwind-preset";

export default {
  presets: [preset],
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/*/src/**/*.{ts,tsx}",
  ],
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
