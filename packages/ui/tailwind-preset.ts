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
          /* Text and hairlines, never a fill. `DEFAULT` is a fill colour and
             measures 3.76:1 as text — see the note in `globals.css`. */
          strong: "hsl(var(--destructive-strong))",
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

        /* ═══════════════════════════════════════════════════════════════════
         * THE THREE THE STATUS HISTORY IS BUILT FROM.
         *
         * They are HERE rather than in the component so that the durations
         * agree. A timeline whose rule finishes drawing after its own marker
         * has landed reads as two animations fighting, and that only stays
         * fixed if one file owns both numbers.
         *
         * EVERY ONE ENDS IN THE RESTING STATE AND IS RUN WITH `both`. The
         * elements are therefore correct before the animation starts and after
         * it finishes, so dropping the animation entirely — which is exactly
         * what `motion-reduce:animate-none` does — leaves a finished timeline
         * rather than a collapsed rule and an invisible marker. That is the
         * property that makes reduced motion safe here, and it is a property of
         * the KEYFRAMES, not of the component.
         * ═══════════════════════════════════════════════════════════════════ */

        /**
         * The rule between two stops, drawn downward from the marker above.
         *
         * ═══ `translateX(-50%)` IS IN HERE, AND IT IS NOT DECORATION ═══
         * The rule is a 1px line centred in a 32px column, which needs a half
         * pixel of offset — `left-1/2 -translate-x-1/2` — that no integer
         * `left-*` can express. `transform` IS ONE PROPERTY: a keyframe setting
         * `scaleY()` replaces the utility's `translateX()` outright rather than
         * composing with it, so the animated rule sat 0.5px right of every
         * marker's centre, for the whole animation and for ever after it.
         * Measured at ruleX 32.5 against a marker centre of 32.0.
         * Carrying the translate through both frames restores it. The element
         * keeps `-translate-x-1/2` as well, because that is what positions it
         * when the animation is dropped under `prefers-reduced-motion`.
         */
        "rule-draw": {
          from: { transform: "translateX(-50%) scaleY(0)" },
          to: { transform: "translateX(-50%) scaleY(1)" },
        },
        /** A stop's marker arriving. Scale only — a marker that slid would
         *  leave the rule it is anchored to pointing at nothing. */
        "stop-in": {
          from: { opacity: "0", transform: "scale(0.72)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        /** The words beside a marker. 4px, not 12 — this is a hint that the
         *  row is arriving, not a slide the eye has to follow. */
        "row-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",

        /* `both` is load-bearing — see the keyframes above. `ease-out` on all
           three: motion that decelerates into place reads as something
           arriving, where `ease-in` reads as something leaving. */
        "rule-draw": "rule-draw 0.26s ease-out both",
        "stop-in": "stop-in 0.24s ease-out both",
        "row-in": "row-in 0.28s ease-out both",
      },
    },
  },
} satisfies Partial<Config>;

export default preset;
