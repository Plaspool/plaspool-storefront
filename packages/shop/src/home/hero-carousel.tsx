"use client";

import * as React from "react";
import { Link } from "../components/link";
import { cn, controlSurface } from "@plaspool/ui";

import { HERO_COLOURS as COLOURS } from "../data/catalog";
import type { CategoryLink } from "../data/catalog";
import { SpoolImage } from "../components/spool-image";
import { progressDot } from "../components/progress-dot";

/**
 * The shop home's first screen. Two slides, each a two-column split: copy on
 * the left, a large spool on the right.
 *
 * The spool is the hero image, per design system rule 3. There is no
 * photography in this store, and a gradient panel would be a second accent
 * competing with the navy — so what carries the hero is a filament colour on
 * a quiet ground, re-tinted per slide.
 */

const SLIDE_MS = 6000;

interface Slide {
  eyebrow: string;
  heading: string;
  body: string;
  colourHex: string;
  colourName: string;
}

const SLIDES: Slide[] = [
  {
    eyebrow: "Made in Abuja",
    heading: "Filament extruded in Nigeria",
    body: "Every spool is made here, not repackaged from an import — so a reorder in March matches the batch you printed in January.",
    colourHex: COLOURS["brand-navy"].hex,
    colourName: COLOURS["brand-navy"].name,
  },
  {
    eyebrow: "±0.02 mm, every batch",
    heading: "Measured before it ships",
    body: "Diameter is laser-checked along the whole spool, so your first layer behaves the same on the last hundred metres as the first.",
    colourHex: COLOURS["signal-red"].hex,
    colourName: COLOURS["signal-red"].name,
  },
];

export function HeroCarousel({ primary }: { primary: CategoryLink }) {
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);

  React.useEffect(() => {
    if (paused) return undefined;
    /* Read at effect time rather than at render: `matchMedia` does not exist
       on the server, and reading it during render would make the first client
       paint disagree with the server's. */
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return undefined;

    const timer = setInterval(
      () => setIndex((current) => (current + 1) % SLIDES.length),
      SLIDE_MS,
    );
    return () => clearInterval(timer);
  }, [paused]);

  function onKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setIndex((current) => (current + 1) % SLIDES.length);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      setIndex((current) => (current - 1 + SLIDES.length) % SLIDES.length);
    }
  }

  const slide = SLIDES[index];

  return (
    <section
      aria-label="Featured"
      aria-roledescription="carousel"
      onKeyDown={onKeyDown}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="border-b border-brand-line bg-background"
    >
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-16 lg:px-8">
        <div
          aria-roledescription="slide"
          aria-label={`Slide ${index + 1} of ${SLIDES.length}: ${slide.eyebrow}`}
          className="grid items-center gap-8 md:grid-cols-2 md:gap-12"
        >
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-brand">
              {slide.eyebrow}
            </p>
            <h1 className="mt-3 text-3xl font-bold leading-tight text-foreground sm:text-4xl lg:text-5xl">
              {slide.heading}
            </h1>
            <p className="mt-4 max-w-prose text-base leading-7 text-muted-foreground">
              {slide.body}
            </p>
            {/* ═══ ONE CTA, AND THE SECOND ONE IS GONE ON PURPOSE ═══
                "Browse all filament" stood here as a `default` key beside the
                primary. It pointed at `/store/all` — a superset of wherever
                `primary.href` sends a shopper — so the pair asked the same
                question twice and split the hero's emphasis between two
                controls that both mean "go look at spools".

                It had already been rewritten once: it was `#bulk` / "Bulk
                pricing" until that band stopped rendering for want of a
                discount ladder, and the catalogue link was what it was
                repointed to rather than what it was written for. A second CTA
                kept alive because the layout has room for one is the weaker
                half of this section, and the category tiles directly below are
                the browse affordance it was standing in for.

                `flex flex-wrap gap-3` stays: the row is still a row, and the
                moment there is a real second destination it goes back here. */}
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href={primary.href}
                className={cn(
                  "inline-flex h-11 items-center justify-center rounded-md px-6 text-sm font-medium",
                  controlSurface("primary"),
                )}
              >
                {primary.label}
              </Link>
            </div>
          </div>

          {/* Order-first on mobile would push the copy below the fold on a
              375 px screen, so the spool stays second and capped in width. */}
          <div className="flex justify-center md:justify-end">
            <SpoolImage
              colourHex={slide.colourHex}
              weightGrams={1000}
              label={`Filament spool in ${slide.colourName}`}
              className="w-56 max-w-full sm:w-72 lg:w-[22rem]"
            />
          </div>
        </div>

        <div className="mt-8 flex items-center gap-2">
          {SLIDES.map((item, dot) => (
            <button
              key={item.eyebrow}
              type="button"
              aria-label={`Show slide ${dot + 1}`}
              aria-current={dot === index ? "true" : undefined}
              onClick={() => setIndex(dot)}
              /* Shared with the return dialog's step indicator, which had
                 drifted to a different height, travel and hue — see
                 `progress-dot.ts`. These values are the ones that moved
                 there; nothing here changes. */
              className={progressDot(dot === index)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
