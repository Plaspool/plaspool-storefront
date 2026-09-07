"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { BrandLogo } from "@plaspool/brand";
import { Button, cn } from "@plaspool/ui";

import type { AddOnOffer } from "../data/cart-api";
import { addOnImageSrc, addOnPriceLabel, addOnUnitLabel, potentialSavingOf, savingAmountLabel } from "./add-ons";

/**
 * The extras step's pieces: one offer card, the stack of them, and the short
 * block a phone shows under the sheet.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * PRESENTATIONAL ON PURPOSE — the `returns/return-intro.tsx` pattern.
 *
 * On a phone the extras step is drawn inside a Radix dialog re-seated as a
 * bottom sheet, and everything a Radix dialog renders goes through a portal
 * this suite cannot reach (`environment: "node"`, no jsdom). So nothing in
 * this file decides anything: every card takes the offer and two callbacks,
 * `checkout-flow.tsx` owns the state and the sheet, and the copy rules below
 * are pinned by `add-on-offer-card.test.tsx` through `renderToStaticMarkup`
 * whether the card is on the page or in the sheet.
 *
 * ═══ THE TITLE AND THE DESCRIPTION ARE THE OPERATOR'S ═══
 * Rendered verbatim, never lower-cased, never truncated, never given a noun
 * of ours — the same rule `adjustment.label` lives under. The two buttons
 * and the "+" on the price are the only words this file spells.
 *
 * ═══ NO ARITHMETIC, AND THE COST IS `amount` ═══
 * The figure on the card is the API's `amount` — what the rule will charge,
 * which is `price` until an operator makes the packaging free — formatted.
 * What it does to the total is the freeze's business; the review step shows
 * that answer.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export type AddOnChoice = "accepted" | "declined";

/** The picture's edge, in px. One number for the photograph and for the
 *  placeholder, so the card is the same height whichever it draws. */
const PICTURE_PX = 96;

export interface AddOnOfferCardProps {
  offer: AddOnOffer;
  /** A write is in flight. Both buttons hold: two answers racing would land
   *  in whichever order the network chose. */
  disabled?: boolean;
  onChoose: (choice: AddOnChoice) => void;
}

export function AddOnOfferCard({ offer, disabled = false, onChoose }: AddOnOfferCardProps) {
  const titleId = React.useId();
  const src = addOnImageSrc(offer.imageUrl);
  /* "Already in the price", and the money that comes back for taking it out.
     `potentialSavingOf` reads `unitAmount × units` rather than `amount`,
     because `amount` is 0 for as long as the box is being kept. */
  const optOut = offer.mode === "opt_out";
  const saving = optOut ? potentialSavingOf(offer) : 0;
  const unitLabel = addOnUnitLabel(offer);

  return (
    <article
      aria-labelledby={titleId}
      className="flex flex-col gap-4 border-2 border-foreground p-4 sm:flex-row sm:items-start"
    >
      <AddOnPicture src={src} />

      <div className="min-w-0 flex-1">
        <h2 id={titleId} className="text-base font-semibold text-foreground">
          {offer.title}
        </h2>
        {offer.description && (
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{offer.description}</p>
        )}
        {/* ═══ TWO QUESTIONS WEARING THE SAME CARD ═══
            An `ask` is "shall we add this?", and its figure is a charge on top
            of a total the shopper has been looking at since the cart — the "+"
            says so, and `addOnPriceLabel` spells it from `amount`, what the
            rule will charge, never `price`.

            An `opt_out` is "shall we take this out?", and its figure is not a
            charge at all: `amount` is 0 because the box was bought inside the
            product price. Printing "Free" there would read as a gift being
            offered. What belongs on the card is what it is worth per unit and
            the fact that it is already paid for — the SAVING lives on the
            button that grants it. */}
        {optOut ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {unitLabel ? (
              <span className="font-mono tabular-nums text-foreground">{unitLabel}</span>
            ) : null}
            {unitLabel ? " · " : null}
            Already in the price.
          </p>
        ) : (
          <p className="mt-2 font-mono text-sm tabular-nums text-foreground">
            {addOnPriceLabel(offer.amount)}
          </p>
        )}

        {/* `accepted` FIRST IN THE DOM AND ON THE LEFT, because it is the
            answer the offer exists to invite — but the other is a full button
            of the same height, not a text link: declining has to be as easy to
            press as accepting, or the card is a nag rather than a question.

            ═══ THE SAME TWO ANSWERS MEAN OPPOSITE THINGS ═══
            For an `ask`, `accepted` adds something and `declined` costs
            nothing. For an `opt_out` it is the other way round: `accepted`
            KEEPS what is already paid for and `declined` is what pays money
            back. So the labels come off the mode, and the saving is printed on
            the button that grants it — a shopper should never have to work out
            which way round this particular question runs. */}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            tone="primary"
            disabled={disabled}
            onClick={() => onChoose("accepted")}
            className="h-11 sm:min-w-32"
          >
            {disabled && <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />}
            {optOut ? "Keep it" : "Add it"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => onChoose("declined")}
            className="h-11 sm:min-w-32"
          >
            {optOut && saving > 0 ? `Send it without — save ${savingAmountLabel(saving)}` : "No thanks"}
          </Button>
        </div>
      </div>
    </article>
  );
}

/**
 * The add-on's picture, or the box that says there is none.
 *
 * THE PLACEHOLDER IS `line-thumb.tsx`'s, deliberately: a dashed, tinted square
 * carrying the mark in greyscale is what "we have no picture of this" already
 * looks like everywhere else in the shop, and a shopper who has seen an order
 * page should recognise it here. `alt=""` on both branches — the title is
 * printed beside the picture, so naming it too is a second reading of the
 * same card.
 */
function AddOnPicture({ src }: { src: string | null }) {
  const box = { width: PICTURE_PX, height: PICTURE_PX };
  if (!src) {
    return (
      <div
        style={box}
        aria-hidden="true"
        className="flex shrink-0 items-center justify-center border border-dashed border-brand-line bg-brand-soft/40"
      >
        <BrandLogo
          variant="mark"
          tone="light"
          alt=""
          priority={false}
          className="h-auto opacity-45 grayscale"
          style={{ width: Math.round(PICTURE_PX * 0.52) }}
        />
      </div>
    );
  }
  return (
    /* Workers has no sharp, and every other API-origin picture in the shop
       is a plain <img> for the reason `next.config.ts` records. */
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={PICTURE_PX}
      height={PICTURE_PX}
      loading="lazy"
      style={box}
      className="shrink-0 border border-brand-line bg-background object-cover"
    />
  );
}

export interface AddOnOfferListProps {
  offers: AddOnOffer[];
  disabled?: boolean;
  onChoose: (addOnId: string, choice: AddOnChoice) => void;
}

/** Every pending offer, stacked. Multiple offers are one step, not several. */
export function AddOnOfferList({ offers, disabled = false, onChoose }: AddOnOfferListProps) {
  return (
    <div className="flex flex-col gap-4">
      {offers.map((offer) => (
        <AddOnOfferCard
          key={offer.id}
          offer={offer}
          disabled={disabled}
          onChoose={(choice) => onChoose(offer.id, choice)}
        />
      ))}
    </div>
  );
}

export interface AddOnPendingSummaryProps {
  offers: AddOnOffer[];
  disabled?: boolean;
  /** Re-opens the sheet. */
  onContinue: () => void;
  className?: string;
}

/**
 * What a phone shows on the extras step UNDER the sheet — and after the
 * sheet is closed without an answer.
 *
 * The sheet is how the step is drawn on a narrow screen, not a different
 * flow, so closing it must leave the shopper ON the step with a way back
 * into the question. This is that way back: the offers named with their
 * prices, and one Continue that re-opens the sheet. It never answers for
 * them.
 */
export function AddOnPendingSummary({
  offers,
  disabled = false,
  onContinue,
  className,
}: AddOnPendingSummaryProps) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <p className="text-sm text-muted-foreground">
        {offers.length === 1
          ? "One thing to decide before your total."
          : `${offers.length} things to decide before your total.`}
      </p>
      <ul className="divide-y divide-brand-line border-y border-brand-line">
        {offers.map((offer) => (
          <li key={offer.id} className="flex items-center justify-between gap-3 py-2.5">
            <span className="min-w-0 truncate text-sm text-foreground">{offer.title}</span>
            <span className="shrink-0 font-mono text-sm tabular-nums text-foreground">
              {addOnPriceLabel(offer.amount)}
            </span>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        tone="primary"
        disabled={disabled}
        onClick={onContinue}
        className="h-12 text-base"
      >
        Continue
      </Button>
    </div>
  );
}
