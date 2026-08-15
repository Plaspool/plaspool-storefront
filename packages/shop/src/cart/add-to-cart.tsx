"use client";

import * as React from "react";
import { Check, ShoppingCart } from "lucide-react";
import { Button, cn } from "@plaspool/ui";

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
  className?: string;
}

export function AddToCartButton({
  line,
  qty,
  disabled = false,
  variant = "default",
  label = "Add to cart",
  className,
}: AddToCartButtonProps) {
  const cart = useCart();
  const [justAdded, setJustAdded] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // A stale "Added to cart" must not survive a colour or size change on a
  // reused button instance — a buy box keeps the same `AddToCartButton`
  // mounted while its `line` prop changes under it.
  React.useEffect(() => {
    setJustAdded(false);
  }, [line.productSlug, line.colourId, line.sizeId]);

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
        aria-label={disabled ? `${label} — out of stock` : undefined}
        className={cn("focus-visible:ring-brand focus-visible:ring-offset-background", className)}
      >
        {justAdded ? (
          <>
            <Check aria-hidden="true" className="mr-2 h-4 w-4" />
            Added to cart
          </>
        ) : (
          <>
            <ShoppingCart aria-hidden="true" className="mr-2 h-4 w-4" />
            {label}
          </>
        )}
      </Button>
      <span role="status" aria-live="polite" className="sr-only">
        {justAdded ? "Added to cart" : ""}
      </span>
    </>
  );
}
