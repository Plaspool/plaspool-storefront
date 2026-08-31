"use client";

import * as React from "react";
import { Check, ShoppingCart } from "lucide-react";
import { Button, cn } from "@plaspool/ui";

/**
 * THE DEEP BLUE, AND WHERE IT WENT.
 *
 * Issue #10 asked for the black fill to become a rich deep blue, and to
 * confirm the shade with design so it lands in the palette rather than as a
 * one-off. The palette already has it: `--brand-accent` is a deep indigo-navy
 * (`#231c50`), it is the accent the whole storefront is built around, and
 * `--brand-ink` is its paired foreground. So this is the ramp doing its job,
 * not a colour invented for one button. Contrast of white on `#231c50` is
 * roughly 13:1, comfortably past WCAG AA's 4.5:1 and AAA's 7:1.
 *
 * The literal `bg-brand text-brand-ink hover:bg-brand-hover` that used to sit
 * here is now the `primary` row of the `neo` table in
 * `packages/ui/src/surface.ts`, reached by the `surface="neo"` pin below. The
 * fill is byte-identical; it is simply no longer this file's opinion.
 */

import { useCart } from "./cart-context";
import type { CartLineKey } from "./types";

/**
 * Adds one line to the cart and shows a brief on-button confirmation. No
 * toast library: `react-hot-toast` lives in the host app, not this package,
 * and a local inline confirmation does the whole job without a dependency to
 * declare. The confirmation is also announced through a hidden live region —
 * the same `role="status"`/`aria-live="polite"` pattern `QuantityStepper`
 * uses for its value — rather than relying on the visible text swap alone.
 */

const CONFIRM_MS = 1800;

export interface AddToCartButtonProps {
  line: CartLineKey;
  qty: number;
  /** Disable when the selected colour is out of stock. The visible label
   *  stays put — only the accessible name changes, to carry the reason. */
  disabled?: boolean;
  variant?: "default" | "outline";
  label?: string;
  /**
   * The accessible name, when the visible label has to be shorter than the
   * action. The sticky bar renders "Add" because a third of a 320px viewport
   * will not hold "Add to cart" — but "Add" on its own is not a description of
   * anything, so the button keeps the full name for assistive tech. Defaults to
   * `label`, which is the right answer everywhere the label already fits.
   */
  srLabel?: string;
  /** Confirmation text, for the same width reason. Defaults to "Added to cart". */
  addedLabel?: string;
  className?: string;
}

export function AddToCartButton({
  line,
  qty,
  disabled = false,
  variant = "default",
  label = "Add to cart",
  srLabel,
  addedLabel = "Added to cart",
  className,
}: AddToCartButtonProps) {
  const name = srLabel ?? label;
  const cart = useCart();
  const [justAdded, setJustAdded] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  /*
   * A stale "Added to cart" must not survive a colour or size change on a
   * reused button instance — a buy box keeps the same `AddToCartButton`
   * mounted while its `line` prop changes under it.
   *
   * ADJUSTED DURING RENDER, NOT IN AN EFFECT. This was a `useEffect` that called
   * `setJustAdded(false)`, which React 19's hook lint rule
   * (`react-hooks/set-state-in-effect`, new in the plugin Next 16 ships) flags —
   * correctly, because it paints the stale label once and then corrects it.
   * Comparing against the previous key during render is React's own documented
   * pattern for resetting state when a prop changes: the re-render happens
   * before the browser paints, so the stale label is never visible.
   */
  const lineId = `${line.productSlug}:${line.colourId}:${line.sizeId}`;
  const [seenLineId, setSeenLineId] = React.useState(lineId);
  if (seenLineId !== lineId) {
    setSeenLineId(lineId);
    setJustAdded(false);
  }

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function handleClick() {
    cart.add(line, qty);
    setJustAdded(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setJustAdded(false), CONFIRM_MS);
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        disabled={disabled}
        onClick={handleClick}
        /* Always set, not only when disabled: the visible label may be an
           abbreviation, and the out-of-stock reason belongs in the name. */
        aria-label={disabled ? `${name} — out of stock` : name}
        /* ═══ SURFACE PIN — EXCUSED FROM THE FLAG, ON PURPOSE ═══════════════
           Owner decision: "for now leave the add to cart and buy now buttons
           they are okay". This one prop is the ENTIRE exception — delete it
           and the button rejoins `DEFAULT_BUTTON_SURFACE` with no other edit.
           Keep it matched to `BuyNowButton`, which carries the same pin: the
           two sit side by side and must not split into two looks. */
        surface="neo"
        className={cn(
          // Taller than the shadcn default `h-10`, with the label stepped up
          // to match: this is the page's primary action and it is thumbed on
          // a phone. 48px is also the tap target Android and iOS both ask for.
          "h-12 px-5 text-base",
          className,
        )}
      >
        {justAdded ? (
          <>
            <Check aria-hidden="true" className="mr-2 h-4 w-4 shrink-0" />
            <span className="truncate">{addedLabel}</span>
          </>
        ) : (
          <>
            <ShoppingCart aria-hidden="true" className="mr-2 h-4 w-4 shrink-0" />
            <span className="truncate">{label}</span>
          </>
        )}
      </Button>
      <span role="status" aria-live="polite" className="sr-only">
        {justAdded ? "Added to cart" : ""}
      </span>
    </>
  );
}
