"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { Button, NEO_SURFACE, cn } from "@plaspool/ui";

import { EmptyState } from "../components/empty-state";
import { Price } from "../components/price";
import { QuantityStepper } from "../components/quantity-stepper";
import { ProductPhoto } from "../components/product-photo";
import { formatNaira } from "../data/money";
import { useCart } from "../cart/cart-context";
import type { CartLineKey, ResolvedLine } from "../cart/types";

/**
 * `/cart` — the full-page basket, next to the drawer rather than instead of
 * it. The drawer stays the fast in-and-out from an add; this is the
 * destination a cart badge or a bookmark lands on, and it is where "Checkout"
 * actually starts the flow rather than just opening the drawer.
 */

function toKey(line: ResolvedLine): CartLineKey {
  return { productSlug: line.product.slug, colourId: line.colour.id, sizeId: line.size.id };
}

export function CartPage() {
  const cart = useCart();

  if (!cart.hydrated) return null;

  if (cart.resolved.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={<ShoppingCart aria-hidden="true" />}
          title="Your cart is empty"
          body="Browse PLA, PETG and TPU by the spool or by the box."
          action={
            <Button asChild className="focus-visible:ring-brand focus-visible:ring-offset-background">
              <Link href="/store">Browse the store</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_320px] lg:py-16">
      <div>
        <h1 className="mb-6 font-sans text-2xl font-bold text-foreground">Your cart</h1>
        <ul className="flex flex-col divide-y divide-brand-line border-y border-brand-line">
          {cart.resolved.map((line) => (
            <li key={line.key} className="flex gap-4 py-5">
              <ProductPhoto
                src={line.colour.imageUrl ?? line.product.coverImageUrl}
                alt={`${line.colour.name} filament spool, ${line.size.label}`}
                colourHex={line.colour.hex}
                weightGrams={line.size.weightGrams}
                className="aspect-square w-20 shrink-0"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/store/products/${line.product.slug}`}
                      className="block truncate font-sans text-sm font-semibold text-foreground hover:underline"
                    >
                      {line.product.name}
                    </Link>
                    <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                      {line.colour.name} · {line.size.label}
                    </p>
                  </div>
                  <Price amount={line.total} size="sm" className="shrink-0" />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <QuantityStepper
                    value={line.qty}
                    onChange={(qty) => cart.setQty(toKey(line), qty)}
                    label={`${line.product.name}, ${line.colour.name}, ${line.size.label}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => cart.remove(toKey(line))}
                    className="h-auto px-2 py-1 font-sans text-xs text-muted-foreground"
                  >
                    Remove
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <aside>
        <div className="sticky top-24 border-2 border-foreground p-4">
          <div className="flex items-center justify-between">
            <span className="font-sans text-sm text-muted-foreground">Subtotal</span>
            <span className="font-mono text-base font-bold tabular-nums text-foreground">
              {formatNaira(cart.subtotal)}
            </span>
          </div>
          {cart.savings > 0 && (
            <div className="mt-1 flex items-center justify-between">
              <span className="font-sans text-sm text-muted-foreground">You save</span>
              <span className="font-mono text-sm font-semibold tabular-nums text-brand">
                {formatNaira(cart.savings)}
              </span>
            </div>
          )}
          <Button
            asChild
            className={cn("mt-4 w-full h-12 text-base", NEO_SURFACE)}
          >
            <Link href="/checkout">Checkout</Link>
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Delivery and tax are calculated at checkout.
          </p>
        </div>
      </aside>
    </div>
  );
}
