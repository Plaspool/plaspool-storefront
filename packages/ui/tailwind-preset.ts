import type { Config } from "tailwindcss";

export const preset = {
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        mono: ["Space Mono", "Roboto Mono", "monospace"], // Engineering-focused monospace font
        sans: ["Titillium Web", "DIN", "sans-serif"], // Technical sans-serif font
      },
      colors: {
        brand: {
          DEFAULT: "hsl(var(--brand-accent))",
          hover: "hsl(var(--brand-hover))",
          soft: "hsl(var(--brand-soft))",
          line: "hsl(var(--brand-line))",
          ink: "hsl(var(--brand-ink))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        blue: {
          50: "#eef2ff",
          100: "#dce4ff",
          200: "#c0cfff",
          300: "#9eb1ff",
          400: "#7a8aff",
          500: "#5b63ff",
          600: "#4a3df7",
          700: "#3e2de0",
          800: "#2d2cb5", // Darker blue as requested
          900: "#252452", // Very dark blue for contrast
        },
        slate: {
          900: "#0f172a", // Darker slate for better contrast
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
} satisfies Partial<Config>;

export default preset;
