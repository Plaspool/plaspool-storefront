"use client";

import * as React from "react";

/**
 * The panel beside the sign-in form: five photographs of the thing this shop
 * sells being used, on a slow crossfade.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE IMAGES ARE LOCAL FILES, NOT UNSPLASH URLS.
 *
 * They come from Unsplash, whose licence covers free commercial use with no
 * attribution required — but they are COMMITTED to `public/brand/sign-in/`
 * rather than hotlinked, for three reasons that all matter here:
 *
 *   - `img-src 'self'` already covers them, so the CSP in `next.config.ts`
 *     needs no third-party image origin.
 *   - Workers has no sharp (`images.unoptimized`), so a remote URL would be
 *     served at whatever size the CDN felt like. These are pre-sized to ~900px
 *     wide at q70; all five together are under 400 KB.
 *   - A sign-in page must not depend on a third party's CDN being up.
 *
 * Photographers, recorded because it is decent practice even where the licence
 * does not require it: Minku Kang, Kadir Celep, Christian Englmeier,
 * Osman Talha Dikyar, Opt Lasers.
 *
 * ⚠  ONE CANDIDATE WAS REJECTED ON PURPOSE. A well-shot photo of a printed
 * Grogu figurine was the best-looking image of the set. Unsplash's licence
 * covers the PHOTOGRAPH; it does not license the character depicted in it, and
 * putting a recognisable Disney character on a commercial storefront is a
 * trademark problem that looks exactly like a design win until it is a letter.
 * Prefer machines, materials and abstract detail over printed *characters*
 * when adding to this list.
 *
 * ═══ SWAPPING THEM ═══
 * `SCENES` is the whole contract: drop a file in `public/brand/sign-in/`, point
 * an entry at it, write a caption that describes what is actually in the frame.
 * Nothing else changes.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const ADVANCE_MS = 6000;

interface Scene {
  /** Stable key, also the dot's accessible name. */
  id: string;
  title: string;
  body: string;
  /** Path under `/public`. */
  src: string;
  /**
   * What is in the frame, for somebody who cannot see it. NOT a repeat of the
   * caption — the caption is already text on the page and is read separately.
   */
  alt: string;
}

const SCENES: Scene[] = [
  {
    id: "printers-row",
    title: "Filament that prints the first time",
    body: "Tight diameter tolerance, so the slicer's numbers and the nozzle's reality agree.",
    src: "/brand/sign-in/printers-row.jpg",
    alt: "A row of desktop 3D printers on a workbench, one part-way through printing a set of blue cylinders.",
  },
  {
    id: "first-layer",
    title: "A first layer that just sticks",
    body: "Consistent flow from the first millimetre, so a print is not lost an hour in.",
    src: "/brand/sign-in/first-layer.jpg",
    alt: "Close-up of a 3D printer hot end laying its first layer across the build plate.",
  },
  {
    id: "hotend-dark",
    title: "Lays down clean, layer after layer",
    body: "Every spool is printed from before it ships — the batch you buy, not a sample of it.",
    src: "/brand/sign-in/hotend-dark.jpg",
    alt: "A printer's extruder against a black background, building a small red part on the bed.",
  },
  {
    id: "printing-yellow",
    title: "Colours that match the last spool",
    body: "Reorder a colour months later and it still lands where the first one did.",
    src: "/brand/sign-in/printing-yellow.jpg",
    alt: "A yellow object part-way through printing, lit by the printer's blue status light.",
  },
  {
    id: "machine-violet",
    title: "Stocked in Nigeria, delivered from here",
    body: "No customs wait and no month-long shipping. It leaves Lagos, not Shenzhen.",
    src: "/brand/sign-in/machine-violet.jpg",
    alt: "A machine head moving over a work surface under violet light.",
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
          {/* A plain <img>, for the reason blog covers use one: Workers has no
              sharp, so `images.unoptimized` is on and `next/image` would add a
              component without adding an optimisation. `object-cover` fills the
              panel at any aspect ratio; `eager` on the first slide only, since
              the other four are behind a 6s crossfade. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={scene.src}
            alt={scene.alt}
            loading={i === 0 ? "eager" : "lazy"}
            decoding="async"
            className="h-full w-full object-cover"
          />

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
