"use client";

import Link from "next/link";
import { ShoppingCart, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  ScrollArea,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@plaspool/ui";

import { EmptyState } from "../components/empty-state";
import { Price } from "../components/price";
import { QuantityStepper } from "../components/quantity-stepper";
import { SpoolImage } from "../components/spool-image";
import { formatNaira } from "../data/money";
import { useCart } from "./cart-context";
import type { CartLineKey, ResolvedLine } from "./types";

/**
 * The one cart overlay for the whole store, mounted once (in `ShopShell`) and
 * driven entirely by `useCart()`. There is no `SheetTrigger` here — the
 * controls that open it (the nav's cart icon, a successful add, "Buy Now")
 * live elsewhere in the tree and just call `open()` on the shared context.
 *
 * Checkout does not exist yet. The footer says so in a plain sentence instead
 * of showing a disabled "Checkout" button — a disabled control invites
 * clicking; a sentence explains.
 */

function toKey(line: ResolvedLine): CartLineKey {
  return { productSlug: line.product.slug, colourId: line.colour.id, sizeId: line.size.id };
}

function CartLineRow({
  line,
  onQtyChange,
  onRemove,
}: {
  line: ResolvedLine;
  onQtyChange: (qty: number) => void;
  onRemove: () => void;
}) {
  const { product, colour, size, qty, unitPrice, total, tier } = line;
  const descriptor = `${product.name}, ${colour.name}, ${size.label}`;

  return (
    <li className="flex gap-3 py-4">
      <SpoolImage
        colourHex={colour.hex}
        weightGrams={size.weightGrams}
        label={`${colour.name} filament spool, ${size.label}`}
        className="w-16 shrink-0"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <SheetClose asChild>
              <Link
                href={`/store/products/${product.slug}`}
                className="block truncate rounded-sm font-sans text-sm font-semibold text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {product.name}
              </Link>
            </SheetClose>
            <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
              {colour.name} · {size.label}
            </p>
          </div>
          <Price amount={total} size="sm" className="shrink-0" />
        </div>

        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <QuantityStepper value={qty} onChange={onQtyChange} label={descriptor} />
          <div className="flex items-center gap-1.5">
            {tier && (
              <Badge
                variant="outline"
                className="gap-1 whitespace-nowrap border-transparent bg-brand-soft px-1.5 py-0 text-[11px] font-semibold text-brand"
              >
                <span className="font-mono tabular-nums">−{tier.discountPct}%</span>
                <span className="font-sans">bulk</span>
              </Badge>
            )}
            <span className="whitespace-nowrap font-mono text-xs tabular-nums text-muted-foreground">
              {formatNaira(unitPrice)}
            </span>
            <span className="whitespace-nowrap font-sans text-xs text-muted-foreground">each</span>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          aria-label={`Remove ${descriptor} from cart`}
          className="h-auto w-fit gap-1.5 px-2 py-1 font-sans text-xs text-muted-foreground focus-visible:ring-brand focus-visible:ring-offset-background"
        >
          <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
          Remove
        </Button>
      </div>
    </li>
  );
}

export function CartDrawer() {
  const cart = useCart();

  return (
    <Sheet open={cart.isOpen} onOpenChange={(open) => (open ? cart.open() : cart.close())}>
      <SheetContent side="right" className="flex flex-col gap-0 overflow-hidden p-0">
        <SheetHeader className="px-6 pt-6 text-left">
          <SheetTitle>Your cart</SheetTitle>
          <SheetDescription className="sr-only">
            Review items added to the cart, change quantity, or remove a line.
          </SheetDescription>
        </SheetHeader>

        {/* Anything derived from the cart renders nothing until hydrated —
            otherwise this would flash an empty cart before the real one
            loads from storage. See cart-context.tsx. */}

        {cart.hydrated && cart.resolved.length === 0 && (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              icon={<ShoppingCart aria-hidden="true" />}
              title="Your cart is empty"
              body="Browse PLA, PETG and TPU by the spool or by the box."
              action={
                <SheetClose asChild>
                  <Button
                    asChild
                    variant="outline"
                    className="focus-visible:ring-brand focus-visible:ring-offset-background"
                  >
                    <Link href="/store">Browse the store</Link>
                  </Button>
                </SheetClose>
              }
            />
          </div>
        )}

        {cart.hydrated && cart.resolved.length > 0 && (
          <>
            <ScrollArea className="min-h-0 flex-1">
              <ul className="divide-y divide-brand-line px-6">
                {cart.resolved.map((line) => (
                  <CartLineRow
                    key={line.key}
                    line={line}
                    onQtyChange={(qty) => cart.setQty(toKey(line), qty)}
                    onRemove={() => cart.remove(toKey(line))}
                  />
                ))}
              </ul>
            </ScrollArea>

            <SheetFooter className="flex-col items-stretch gap-3 border-t border-brand-line px-6 py-6 sm:flex-col sm:space-x-0">
              <div className="flex items-center justify-between">
                <span className="font-sans text-sm text-muted-foreground">Subtotal</span>
                <span className="font-mono text-base font-bold tabular-nums text-foreground">
                  {formatNaira(cart.subtotal)}
                </span>
              </div>

              {cart.savings > 0 && (
                <div className="flex items-center justify-between">
                  <span className="font-sans text-sm text-muted-foreground">You save</span>
                  <span className="font-mono text-sm font-semibold tabular-nums text-brand">
                    {formatNaira(cart.savings)}
                  </span>
                </div>
              )}

              <SheetClose asChild>
                <Button className="w-full focus-visible:ring-brand focus-visible:ring-offset-background">
                  Continue shopping
                </Button>
              </SheetClose>

              <p className="text-center text-xs text-muted-foreground">
                {"We're still building checkout. Save your cart and come back — it stays on this device."}
              </p>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
