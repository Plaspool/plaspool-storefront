"use client";

import * as React from "react";
import { ArrowRight } from "lucide-react";
import { Button, Label, cn } from "@plaspool/ui";

import { SpoolImage } from "../components/spool-image";
import { HERO_COLOURS } from "../data/policy";
import { onePointLabel, pointValue, programOffer, programOpening } from "../data/marketing";
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
 * `pointsPerUnit` is what the API actually pays, and `ReturnForm`'s own
 * arithmetic line renders the same number one step later — a hardcoded one
 * here would be a promise the very next screen contradicts.
 *
 * The ONE exception is what a point is worth in naira, which the rewards
 * endpoint does not send at all. It is `POINT_VALUE_NAIRA` in
 * `data/marketing.ts`, spelled once for the whole storefront; see that
 * constant's own note for what happens when the admin grows the field.
 *
 * ═══ THE TWO SENTENCES ARE NOT WRITTEN HERE ANY MORE ═══
 * `programOpening()` and `programOffer()` build them, because the landing
 * page's rewards card now makes the same offer and the two must not be able to
 * drift apart. They still arrive as whole strings, which is the property the
 * suite below depends on.
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

  /* Both whole strings, and both built in `data/marketing.ts` — see this
     file's header for why they are no longer written here. */
  const opening = programOpening(program);
  const offer = programOffer(program);

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {/* DECORATION, AND SO HIDDEN OUTRIGHT. The band says nothing the two
          paragraphs below do not say in words, and a screen reader announcing
          three spools and two arrows before reaching the offer is worse than
          one that reaches the offer first. `label=""` is `SpoolImage`'s own
          idiom for "this adds nothing" — see the note on `decorative` in that
          file for the seven unnamed images that taught it the difference. */}
      <div
        aria-hidden="true"
        /* ═══ `bg-background`, NEVER A TINT — THIS IS A SYSTEM RULE ═══
           It was `bg-brand-soft`, which is unusable here: `SpoolImage` fills
           its own well with `hsl(var(--brand-soft))` and paints the near
           flange opaque `--background` before tinting it navy at 7%. On a
           `brand-soft` ground the well became invisible (identical colour)
           and the flange measured ~1.07:1 against it, rescued only by a
           0.5px hairline. Three spools at three fill levels rendered as
           three shrinking navy discs — the one thing the band exists to
           show was the thing it destroyed.

           `description-tab.tsx`, `category-tiles.tsx`, `line-thumb.tsx` and
           `bulk-promo.tsx` each state this rule; every other spool in the
           shop sits on `bg-background`.

           ═══ AND THE FRAME IS THE SETTLED ONE, NOT A NEW ONE ═══
           This briefly kept its `border-2 border-foreground` and added
           `rounded-lg ring-4 ring-brand-soft` to compensate for losing the
           tint. That invented a third idiom: all thirteen other
           `border-2 border-foreground` panels in this package are SQUARE
           (`guest-prompt.tsx`, `checkout-flow.tsx`, and two more on this
           dialog's own second step), and `ring-*` as decoration appears at no
           other call site in either package. A shopper pressing "Earn …"
           would have gone from a rounded, halo'd 2px panel to a square 2px
           one in the same slot, one screen apart.

           `rounded-lg border border-brand-line bg-background` is what the
           package already uses for a spool on a light ground —
           `category-tiles.tsx:40`, `gallery.tsx`, `description-tab.tsx`. A
           1px hairline, on the radius token. */
        className="flex items-center justify-center gap-2 rounded-lg border border-brand-line bg-background px-4 py-4 sm:gap-4 sm:py-8"
      >
        {BAND.map((spool, i) => (
          <React.Fragment key={spool.weightGrams}>
            {i > 0 && <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
            <SpoolImage
              colourHex={BAND_COLOUR}
              weightGrams={spool.weightGrams}
              empty={spool.empty}
              label=""
              className="w-12 sm:w-20"
            />
          </React.Fragment>
        ))}
      </div>

      {/* `text-sm` holds at every width — 14px is the floor for body copy, and
          a phone is where it is read most. The tightening is in the leading
          and the gaps, never in the type size. */}
      <div className="flex flex-col gap-1.5 sm:gap-2">
        <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-2xl">
          {SLOGAN}
        </h2>
        <p className="text-sm leading-5 text-muted-foreground sm:leading-6">{opening}</p>
        <p className="text-sm leading-5 text-muted-foreground sm:leading-6">{offer}</p>
      </div>

      {/* ═══ THE ONE THING THE PARAGRAPHS ABOVE NEVER SAY ═══
          "Save them up and use your points towards your next order" is a
          promise with no price on it: a shopper reading it cannot tell whether
          fifty returns are worth a spool or a sticker. This row is the
          exchange rate, and it is set as an EQUATION rather than a sentence
          because that is what it is — the same reason every quantity in this
          package is mono and tabular and no measurement is ever set in the
          body face.

          `bg-brand-soft` INSIDE the panel, where the spool band above may not
          have it: the band is defeated by a tint because `SpoolImage` fills
          its own well with that exact colour (see the long note on the band).
          Nothing is drawn here, so the tint is free — and it is what separates
          the figure from two paragraphs of grey without raising a second
          control against `Earn …`.

          THE `=` IS DECORATION AND THE WORDS ARE NOT. Punctuation-level
          settings decide whether a screen reader voices "equals" at all, so
          the glyph is hidden and an `sr-only` phrase carries the meaning —
          "1 Spool Point is worth ₦100" reads as a sentence either way. */}
      <div className="flex items-center justify-center gap-3 rounded-lg border border-brand-line bg-brand-soft px-4 py-2.5 sm:gap-4 sm:py-3">
        <span className="text-sm text-muted-foreground">{onePointLabel(program)}</span>
        <span aria-hidden="true" className="text-sm text-muted-foreground">
          =
        </span>
        <span className="sr-only">is worth</span>
        <span className="font-mono text-lg font-semibold tabular-nums text-brand sm:text-xl">
          {pointValue()}
        </span>
      </div>

      {/* The checkbox and the way forward, on one line where there is room for
          one. The checkbox comes FIRST in the DOM in both layouts: it is the
          decision that changes what happens next time, and a keyboard reaching
          the primary button before it would step past it. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
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
