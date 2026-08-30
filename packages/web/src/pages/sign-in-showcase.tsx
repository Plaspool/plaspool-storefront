"use client";

import * as React from "react";

/**
 * The panel beside the sign-in form: five abstract scenes drawn from 3D
 * printing, on a slow crossfade.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THE ART IS DRAWN RATHER THAN PHOTOGRAPHED.
 *
 * A photographic carousel here would need licensed stock, and licensed stock
 * is the one asset a repository cannot honestly fake — an unlicensed photo of a
 * person is a legal problem that ships to production looking exactly like a
 * design win. So these are generated: pure SVG, no bytes over the network, no
 * `img-src` entry, no layout shift while they load, and legible at any size
 * because nothing is rasterised.
 *
 * They are also the *subject* rather than decoration. Every scene is a real
 * artefact of the thing this shop sells — a sliced toolpath, gyroid infill,
 * filament on a reel, a nozzle laying a bead, a first layer on a build plate.
 *
 * ═══ SWAPPING IN PHOTOGRAPHY LATER ═══
 * `SCENES` is the whole contract. Give an entry an `image` (a `/public` path)
 * and it renders that instead of its `art`, keeping the caption, the dots and
 * the timing untouched. Nothing else needs to change, and a half-migrated list
 * — some drawn, some shot — renders correctly.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const ADVANCE_MS = 6000;

interface Scene {
  /** Stable key, also the dot's accessible name. */
  id: string;
  title: string;
  body: string;
  /** Drawn artwork. Ignored when `image` is set. */
  art: React.ReactNode;
  /**
   * A photograph, once there is a licensed one. Path under `/public`, e.g.
   * `/brand/sign-in/workshop.jpg`. Rendered with a plain `<img>` for the same
   * reason blog covers are: `images.unoptimized` is on for Workers, so
   * `next/image` would buy nothing here.
   */
  image?: { src: string; alt: string };
}

/*
 * ONE PALETTE, DECLARED ONCE. Every scene draws from these so the crossfade
 * between any two reads as one continuous surface rather than five unrelated
 * illustrations. They are the brand ramp's own values — see `globals.css`.
 */
const INK = "hsl(248 48% 21%)";
const LINE = "hsl(250 31% 77%)";
const SOFT = "hsl(250 33% 93%)";
const GLOW = "hsl(247 43% 70%)";

/** Concentric sliced contours — the toolpath a slicer emits for one layer. */
function ToolpathArt() {
  return (
    <svg viewBox="0 0 400 400" className="h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="400" height="400" fill={SOFT} />
      <g fill="none" stroke={INK} strokeLinejoin="round">
        {Array.from({ length: 14 }, (_, i) => {
          const inset = 52 + i * 9;
          return (
            <rect
              key={i}
              x={inset}
              y={inset}
              width={400 - inset * 2}
              height={400 - inset * 2}
              rx={60 - i * 3.2}
              strokeWidth={i % 3 === 0 ? 2.4 : 1}
              opacity={0.15 + i * 0.055}
            />
          );
        })}
      </g>
      {/* The travel move: where the head lifts and crosses the part. */}
      <path
        d="M200 60 L200 340"
        stroke={GLOW}
        strokeWidth="2"
        strokeDasharray="7 11"
        opacity="0.85"
      />
      <circle cx="200" cy="60" r="6" fill={INK} />
    </svg>
  );
}

/** Gyroid infill — the sparse lattice that makes a print light and stiff. */
function GyroidArt() {
  const rows = Array.from({ length: 9 }, (_, r) => r);
  return (
    <svg viewBox="0 0 400 400" className="h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="400" height="400" fill={INK} />
      <g fill="none" stroke={GLOW} strokeWidth="2.2" strokeLinecap="round">
        {rows.map((r) => {
          const y = 30 + r * 45;
          /* Alternating phase is what makes a gyroid read as woven rather
             than as stacked sine waves. */
          const shift = r % 2 === 0 ? 0 : 45;
          return (
            <path
              key={r}
              d={`M-20 ${y} q 22.5 -34 45 0 t 45 0 t 45 0 t 45 0 t 45 0 t 45 0 t 45 0 t 45 0 t 45 0`}
              transform={`translate(${shift} 0)`}
              opacity={0.28 + (r % 3) * 0.24}
            />
          );
        })}
      </g>
    </svg>
  );
}

/** Filament on a reel, abstracted to wound arcs. */
function SpoolArt() {
  return (
    <svg viewBox="0 0 400 400" className="h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="400" height="400" fill={SOFT} />
      <g transform="translate(200 200)">
        <circle r="150" fill="none" stroke={LINE} strokeWidth="2" />
        {/* The wind: many turns, each a fraction off the last. */}
        {Array.from({ length: 26 }, (_, i) => (
          <circle
            key={i}
            r={52 + i * 3.7}
            fill="none"
            stroke={i % 2 === 0 ? INK : GLOW}
            strokeWidth="1.5"
            strokeDasharray={`${180 + i * 22} 60`}
            transform={`rotate(${i * 27})`}
            opacity={0.5 + (i % 4) * 0.12}
          />
        ))}
        <circle r="44" fill={SOFT} stroke={INK} strokeWidth="2.5" />
        <circle r="13" fill={INK} />
        {/* The loose end, feeding off toward the printer. */}
        <path
          d="M148 18 C 210 34, 236 74, 232 126"
          fill="none"
          stroke={INK}
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

/** A nozzle laying a bead, mid-extrusion. */
function NozzleArt() {
  return (
    <svg viewBox="0 0 400 400" className="h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="400" height="400" fill={INK} />
      {/* Beads already laid, receding. */}
      <g fill="none" stroke={GLOW} strokeLinecap="round">
        {Array.from({ length: 7 }, (_, i) => (
          <path
            key={i}
            d={`M56 ${268 + i * 11} H 344`}
            strokeWidth="7"
            opacity={0.14 + i * 0.11}
          />
        ))}
      </g>
      {/* The bead being laid right now, with its meniscus. */}
      <path
        d="M56 257 H 268"
        stroke={SOFT}
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
      />
      {/* Hot end. */}
      <g transform="translate(268 120)">
        <rect x="-34" y="0" width="68" height="76" rx="9" fill={SOFT} opacity="0.92" />
        <rect x="-22" y="76" width="44" height="26" fill={LINE} />
        <path d="M-22 102 L-7 130 H7 L22 102 Z" fill={SOFT} />
        {/* Filament entering the top. */}
        <path
          d="M0 -70 V 0"
          stroke={GLOW}
          strokeWidth="6"
          strokeLinecap="round"
        />
        {/* The extruded thread. */}
        <path d="M0 130 V 137" stroke={SOFT} strokeWidth="8" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** A first layer going down on a build plate, in perspective. */
function BuildPlateArt() {
  return (
    <svg viewBox="0 0 400 400" className="h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="400" height="400" fill={SOFT} />
      {/* `scale(0.78)` KEEPS THE DIAMOND'S CORNERS ON SCREEN. With
            `preserveAspectRatio="slice"` a 690x870 panel crops the 400-unit
            viewBox to roughly x in [41, 359]; the unscaled plate's widest
            points sit at x=7.7 and x=392.3, so both corners — the most
            recognisable thing about the shape — were being cut clean off. */}
      <g transform="translate(200 232) scale(0.78) scale(1 0.5) rotate(45)">
        <rect x="-136" y="-136" width="272" height="272" fill="none" stroke={INK} strokeWidth="2.5" />
        <g stroke={LINE} strokeWidth="1.2">
          {Array.from({ length: 15 }, (_, i) => {
            const p = -136 + i * 19.4;
            return (
              <React.Fragment key={i}>
                <path d={`M${p} -136 V 136`} />
                <path d={`M-136 ${p} H 136`} />
              </React.Fragment>
            );
          })}
        </g>
        {/* The solid first layer, filled in. */}
        <g stroke={INK} strokeWidth="4" strokeLinecap="round">
          {Array.from({ length: 11 }, (_, i) => (
            <path key={i} d={`M-64 ${-58 + i * 11.6} H 64`} opacity="0.9" />
          ))}
        </g>
      </g>
      {/* The part rising off the plate. */}
      <g fill="none" stroke={INK} strokeWidth="2" opacity="0.55">
        {Array.from({ length: 6 }, (_, i) => (
          <ellipse key={i} cx="200" cy={200 - i * 17} rx={64 - i * 3} ry={32 - i * 1.5} />
        ))}
      </g>
    </svg>
  );
}

const SCENES: Scene[] = [
  {
    id: "toolpath",
    title: "Filament that prints the first time",
    body: "Tight diameter tolerance, so the slicer's numbers and the nozzle's reality agree.",
    art: <ToolpathArt />,
  },
  {
    id: "gyroid",
    title: "Infill you can trust to hold",
    body: "Consistent flow, so a sparse lattice comes out as strong as the slicer promised.",
    art: <GyroidArt />,
  },
  {
    id: "spool",
    title: "Stocked in Nigeria, delivered from here",
    body: "No customs wait and no month-long shipping. It leaves Lagos, not Shenzhen.",
    art: <SpoolArt />,
  },
  {
    id: "nozzle",
    title: "Lays down clean, layer after layer",
    body: "Every spool is printed from before it ships — the batch you buy, not a sample of it.",
    art: <NozzleArt />,
  },
  {
    id: "plate",
    title: "A first layer that just sticks",
    body: "Sign in and your past orders keep their settings, so restocking a colour is two taps.",
    art: <BuildPlateArt />,
  },
];

/**
 * Auto-advance that is polite about it.
 *
 * PAUSES ON HOVER AND ON FOCUS-WITHIN, because a panel that keeps moving while
 * somebody is reading it — or tabbing its dots — is the carousel behaviour
 * everybody complains about. STOPS ENTIRELY under `prefers-reduced-motion`: the
 * scene the shopper landed on stays, and the dots still work, so the content is
 * reachable without any movement at all.
 */
function useAutoAdvance(count: number, paused: boolean) {
  const [index, setIndex] = React.useState(0);
  const [reduced, setReduced] = React.useState(true);

  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  React.useEffect(() => {
    if (reduced || paused) return;
    const timer = window.setInterval(
      () => setIndex((i) => (i + 1) % count),
      ADVANCE_MS,
    );
    return () => window.clearInterval(timer);
  }, [count, paused, reduced]);

  return [index, setIndex] as const;
}

export function SignInShowcase() {
  /**
   * TWO REASONS TO STOP, KEPT APART.
   *
   * `paused` is the shopper pressing the button and meaning it. `visiting` is
   * the transient courtesy of not moving while the pointer is over the panel or
   * focus is inside it. Folded into one flag — which they were — moving the
   * mouse off the panel silently resumed a slideshow the shopper had just
   * explicitly paused, so the button appeared not to work.
   */
  const [paused, setPaused] = React.useState(false);
  const [visiting, setVisiting] = React.useState(false);
  const [index, setIndex] = useAutoAdvance(SCENES.length, paused || visiting);

  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-2xl border-2 border-foreground bg-brand-soft"
      onMouseEnter={() => setVisiting(true)}
      onMouseLeave={() => setVisiting(false)}
      onFocusCapture={() => setVisiting(true)}
      onBlurCapture={() => setVisiting(false)}
      /* A region rather than a live region: the captions are decorative
         reassurance, and announcing each rotation would interrupt somebody
         filling in the form beside it. */
      role="group"
      aria-roledescription="carousel"
      aria-label="What PlaSpool sells, and why an account helps"
    >
      {SCENES.map((scene, i) => (
        <div
          key={scene.id}
          className={[
            "absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none",
            i === index ? "opacity-100" : "opacity-0",
          ].join(" ")}
          /* Hidden from assistive tech AND from tab order when off-screen —
             `opacity: 0` alone would leave five stacked captions readable. */
          aria-hidden={i !== index}
          inert={i !== index}
          role="group"
          aria-roledescription="slide"
          aria-label={`${i + 1} of ${SCENES.length}`}
        >
          {scene.image ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={scene.image.src}
              alt={scene.image.alt}
              className="h-full w-full object-cover"
            />
          ) : (
            scene.art
          )}

          {/* The caption plate. Its own solid ground rather than a gradient
              over the art, so contrast is a known quantity on every scene
              instead of depending on what happens to be behind it. */}
          <div className="absolute inset-x-0 bottom-0 border-t-2 border-foreground bg-background/95 px-6 pb-12 pt-5 backdrop-blur-sm sm:px-8 sm:pt-6">
            <p className="text-lg font-semibold leading-tight text-foreground sm:text-xl">
              {scene.title}
            </p>
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
              {scene.body}
            </p>
          </div>
        </div>
      ))}

      {/* Dots, sitting in the padding the caption plate reserves for them.
          Real buttons: reachable by keyboard, and each says which scene it goes
          to rather than "slide 3". */}
      <div className="absolute inset-x-0 bottom-5 z-10 flex items-center gap-2 px-6 sm:px-8">
        {SCENES.map((scene, i) => (
          <button
            key={scene.id}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={scene.title}
            aria-current={i === index}
            /* The visible dot is 6px, but the BUTTON is 44px tall via the
               vertical padding — the dot is drawn by the inner span. A 6px
               pointer target is a miss for anybody without a steady hand, and
               it is the only navigation this panel has. */
            className="group -my-5 px-1 py-5 focus-visible:outline-none"
          >
            <span
              className={[
                "block h-1.5 rounded-full border border-foreground",
                "transition-all motion-reduce:transition-none",
                "group-focus-visible:ring-2 group-focus-visible:ring-brand group-focus-visible:ring-offset-2",
                i === index
                  ? "w-8 bg-foreground"
                  : "w-4 bg-transparent group-hover:bg-brand-line",
              ].join(" ")}
            />
          </button>
        ))}

        {/*
          * ═══ WCAG 2.2.2 (Pause, Stop, Hide) IS A LEVEL A CRITERION ═══
          * Anything that moves automatically for more than five seconds needs a
          * MECHANISM to stop it. Hover and focus-within are not one: a shopper
          * reading the captions with their hands off the mouse, and a keyboard
          * user whose focus is in the form next to it, both had no way to stop
          * a panel that changes every six seconds beside the field they are
          * typing into. `prefers-reduced-motion` only helps people who set it.
          *
          * Placed last in the dot row so the tab order runs
          * scene → scene → … → stop, which is the order somebody discovering
          * the control would look in.
          */}
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-pressed={paused}
          className="ml-1 -my-5 rounded-md px-1.5 py-5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          <span className="sr-only">
            {paused ? "Resume the slideshow" : "Pause the slideshow"}
          </span>
          <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true" fill="currentColor">
            {paused ? (
              <path d="M2.5 1.3 10 6l-7.5 4.7Z" />
            ) : (
              <>
                <rect x="2" y="1.5" width="3" height="9" rx="0.8" />
                <rect x="7" y="1.5" width="3" height="9" rx="0.8" />
              </>
            )}
          </svg>
        </button>
      </div>
    </div>
  );
}
