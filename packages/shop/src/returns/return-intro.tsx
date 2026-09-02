"use client";

import * as React from "react";
import { ArrowRight } from "lucide-react";
import { Button, Label, cn } from "@plaspool/ui";

import { SpoolImage } from "../components/spool-image";
import { HERO_COLOURS } from "../data/policy";
import { pointsLabel } from "../data/marketing";
import type { RewardsProgram } from "../data/marketing";

/**
 * Step one of the return dialog: what the programme is, before the form that
 * joins it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS IS ITS OWN COMPONENT AND NOT MARKUP INSIDE `ReturnModal`.
 *
 * `vitest.config.mts` runs `environment: "node"` — no jsdom, no
 * testing-library — and everything a Radix `Dialog` renders goes through a
 * portal that needs a DOM. That is why `returns-cta.test.tsx` can only reach
 * `isOwnEntry` and why `return-modal.tsx` has never had a test of its own.
 * Kept out here, the whole of step one renders through
 * `renderToStaticMarkup`, so the copy rules below are pinned by a suite
 * rather than by review. It also takes every piece of state as a prop for the
 * same reason: nothing here decides anything, so there is nothing to reach
 * through a portal to observe.
 *
 * ═══ NOT ONE PROGRAMME NOUN IS SPELLED IN THIS FILE ═══
 * `data/marketing.ts` sets the rule out and `house-rules.test.ts` greps for
 * breaches of it. This file is the most tempting place in the package to
 * break it — it is marketing copy, written by a human, handed over as
 * finished prose with "Spool Points" in it twice. Every one of those nouns is
 * `program.pointsLabel*` / `program.unitLabel*` here, so an operator renaming
 * the programme renames this announcement with it, and `pointsLabel()` is
 * what keeps the count agreeing with the noun. The live programme pays ONE
 * point per unit today, so the plural-only version of that sentence would
 * have read "1 Spool Points" in production on day one.
 *
 * ═══ NO FIGURE IS SPELLED EITHER, AND THAT IS THE SAME RULE ═══
 * The copy this was written from said "₦100". `pointsPerUnit` is what the API
 * actually pays, and `ReturnForm`'s own arithmetic line renders the same
 * number one step later — a hardcoded one here would be a promise the very
 * next screen contradicts.
 *
 * ═══ THE HEADINGS ARE PLAIN HTML, NOT `DialogTitle` ═══
 * Radix's title and description must sit inside a `Dialog` context, which
 * would put this component back behind the portal the suite cannot reach.
 * `ReturnModal` supplies both as visually-hidden elements for the accessible
 * name — Radix's own documented pattern where the visible heading is styled
 * differently — and everything visible is spelled here.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** The slogan. The one line here that names no programme, no unit and no
 *  figure, and so is the one line this file is free to spell. */
const SLOGAN = "Print. Return. Repeat.";

/**
 * One colour across all three spools, from the decorative palette
 * `hero-carousel.tsx` already draws from — never a hex chosen here, and never
 * a real product colour, which would read as an inventory claim (see
 * `HERO_COLOURS`' own note).
 *
 * The same colour three times is the whole point of the band: fill level is
 * the only thing that changes, so the row reads as one spool at three moments
 * of its life rather than three different products.
 */
const BAND_COLOUR = HERO_COLOURS["brand-navy"]!.hex;

/** Full, half, spent. `SpoolImage` draws its fill from the weight, so these
 *  are the three frames of `SLOGAN` in the order it says them. */
const BAND = [
  { weightGrams: 1000, empty: false },
  { weightGrams: 500, empty: false },
  { weightGrams: 0, empty: true },
];

export interface ReturnIntroProps {
  program: RewardsProgram;
  /** Whether "don't show this again" is currently ticked. Owned by
   *  `ReturnModal`, which is what actually persists it. */
  dismissed: boolean;
  onDismissedChange: (next: boolean) => void;
  onNext: () => void;
}

export function ReturnIntro({ program, dismissed, onDismissedChange, onNext }: ReturnIntroProps) {
  /* Per MOUNTED instance, not a constant — `ReturnsCta`'s own header explains
     that `/store` mounts two of these at once once an operator publishes a
     top-bar banner, and two checkboxes sharing one `id` means clicking the
     label of one toggles the other. */
  const checkboxId = React.useId();

  const earned = `${program.pointsPerUnit} ${pointsLabel(program.pointsPerUnit, program)}`;

  /* Built as whole strings rather than JSX fragments so each sentence is one
     text node — a sentence assembled from interpolated children is one the
     suite can only assert on in pieces. */
  const opening = `Your ${program.unitLabelSingular} doesn't have to become waste when the filament runs out.`;
  const offer =
    `Return your empty filament ${program.unitLabelPlural} to PlaSpool and earn ${earned} ` +
    `for every eligible ${program.unitLabelSingular}. Save them up and use your ` +
    `${program.pointsLabelPlural} towards your next PlaSpool order.`;

  return (
    <div className="flex flex-col gap-5">
      {/* DECORATION, AND SO HIDDEN OUTRIGHT. The band says nothing the two
          paragraphs below do not say in words, and a screen reader announcing
          three spools and two arrows before reaching the offer is worse than
          one that reaches the offer first. `label=""` is `SpoolImage`'s own
          idiom for "this adds nothing" — see the note on `decorative` in that
          file for the seven unnamed images that taught it the difference. */}
      <div
        aria-hidden="true"
        className="flex items-center justify-center gap-2 border-2 border-foreground bg-brand-soft px-4 py-6 sm:gap-4 sm:py-8"
      >
        {BAND.map((spool, i) => (
          <React.Fragment key={spool.weightGrams}>
            {i > 0 && <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
            <SpoolImage
              colourHex={BAND_COLOUR}
              weightGrams={spool.weightGrams}
              empty={spool.empty}
              label=""
              className="w-16 sm:w-20"
            />
          </React.Fragment>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {SLOGAN}
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">{opening}</p>
        <p className="text-sm leading-6 text-muted-foreground">{offer}</p>
      </div>

      {/* The checkbox and the way forward, on one line where there is room for
          one. The checkbox comes FIRST in the DOM in both layouts: it is the
          decision that changes what happens next time, and a keyboard reaching
          the primary button before it would step past it. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <input
            id={checkboxId}
            type="checkbox"
            checked={dismissed}
            onChange={(event) => onDismissedChange(event.target.checked)}
            className={cn(
              "h-4 w-4 shrink-0 rounded-sm border border-brand-line accent-brand",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
              "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
          />
          <Label htmlFor={checkboxId} className="text-sm font-normal text-muted-foreground">
            Don&apos;t show this again
          </Label>
        </div>

        {/* `h-12 text-base`, the same weight `ReturnForm` gives its submit —
            one screen apart, these are the two halves of one action, and a
            smaller control here would read as the lesser of them. */}
        <Button
          type="button"
          tone="primary"
          onClick={onNext}
          className="h-12 text-base sm:min-w-48"
        >
          {`Earn ${program.pointsLabelPlural}`}
        </Button>
      </div>
    </div>
  );
}
