"use client";

import { Link } from "../components/link";
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
  Skeleton,
  SkeletonRegion,
  TextSkeleton,
} from "@plaspool/ui";

import { EmptyState } from "../components/empty-state";
import { Price } from "../components/price";
import { QuantityStepper } from "../components/quantity-stepper";
import { ProductPhoto } from "../components/product-photo";
import { formatNaira } from "../data/money";
import { BulkLinePrice } from "./bulk-line-price";
import { useCart } from "./cart-context";
import { stockWarning } from "./stock";
import { UnsellableNotice } from "./unsellable-notice";
import type { CartLineKey, ResolvedLine } from "./types";
import { lineDescriptor, variantDescriptor } from "./line-descriptor";

/**
 * The one cart overlay for the whole store, mounted once (in `ShopShell`) and
 * driven entirely by `useCart()`. There is no `SheetTrigger` here — the
 * controls that open it (the nav's cart icon, a successful add, "Buy Now")
 * live elsewhere in the tree and just call `open()` on the shared context.
 *
 * Checkout exists now — the footer's "Checkout" link is the drawer's way in,
 * landing on `/checkout` (`CheckoutFlow`), which owns everything from the
 * address on. The drawer itself changes nothing about how a line is edited.
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
  const { product, colour, size, qty, unitPrice, effectiveUnitPrice, bulkPercentBps, bulkQty, total } =
    line;
  const descriptor = lineDescriptor(product.name, colour.name, size.label);
  /* Null unless the shopper has actually reached a SHELF limit — never at the
     stepper's own sanity ceiling, which is not an inventory claim. See
     `stockWarning`. */
  const left = stockWarning(qty, line.maxQty);

  return (
    <li className="flex gap-3 py-4">
      <ProductPhoto
        src={colour.imageUrl ?? product.coverImageUrl}
        /* Decorative: the row states the product, the colour and the size in
           text right beside it, so naming the picture too is a second reading
           of the same line — and naming it by a colour the product cover is not
           a picture of would be worse than redundant. */
        alt=""

        colourHex={colour.hex}
        weightGrams={size.weightGrams}
        className="aspect-square w-16 shrink-0"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <SheetClose asChild>
              <Link
                href={`/store/products/${product.slug}`}
                className="block truncate rounded-sm text-sm font-semibold text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {product.name}
              </Link>
            </SheetClose>
            <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
              {variantDescriptor(colour.name, size.label)}
            </p>
          </div>
          {/* ═══ ×100 BECAUSE THE PROVIDER IS IN WHOLE UNITS AND `Price` IS IN MINOR ═══
              `cart-context` runs every figure through `majorUnits()`, so `total` is
              whole naira; `Price` takes minor units so it can render a currency
              with sub-units at all. Converting HERE, explicitly, rather than
              letting `Price` guess: the moment a cart can be USD this whole
              provider has to move to minor units, and this multiplication is
              the marker for where that starts. Lossless for NGN, which is the
              only currency a cart can be today. */}
          <Price
            amount={total * 100}
            currency={size.currency}
            size="sm"
            className="shrink-0"
          />
        </div>

        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
          {/* `max` IS THE WHOLE FIX ON THIS SURFACE. Without it the stepper
              offered 99 of a variant the shop had four of, and the refusal
              arrived at the checkout freeze — after the address. */}
          <QuantityStepper value={qty} onChange={onQtyChange} max={line.maxQty} label={descriptor} />
          <BulkLinePrice
            unitPrice={unitPrice}
            effectiveUnitPrice={effectiveUnitPrice}
            bulkPercentBps={bulkPercentBps}
            bulkQty={bulkQty}
            lineQty={qty}
          />
        </div>

        {/* WHY THE PLUS BUTTON STOPPED. A disabled control with no explanation
            reads as a broken one; the number is what makes it an answer. Not
            `role="alert"` — nothing has gone wrong, and the shopper caused this
            by pressing the button they are looking at. */}
        {left !== null && (
          <p className="font-mono text-xs font-medium text-muted-foreground">
            {`Only ${left} left`}
          </p>
        )}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          aria-label={`Remove ${descriptor} from cart`}
          className="h-auto w-fit gap-1.5 px-2 py-1 text-xs text-muted-foreground focus-visible:ring-brand focus-visible:ring-offset-background"
        >
          <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
          Remove
        </Button>
      </div>
    </li>
  );
}

/**
 * The basket's shape, while the basket is still on its way.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DRAWER USED TO OPEN ONTO NOTHING AT ALL.
 *
 * Every block below `hydrated` is gated on it, so until the client's first read
 * lands the sheet was a title and dead space — and that wait is a real network
 * round trip to the commerce API, on a cookie, at the moment the shopper has
 * just clicked. The empty state could not fill it either: "Your cart is empty"
 * is a CLAIM, and it is the one thing we do not yet know. Showing it and then
 * replacing it with three rows is worse than showing nothing.
 *
 * So: the layout, drawn as itself. Per `CLAUDE.md` ("Loading states") — once a
 * section's shape is known, the loading state renders that shape.
 *
 * ═══ IT MIRRORS `CartLineRow`'S BOX, CLASS FOR CLASS ═══
 * Same `flex gap-3 py-4` row, same `w-16` square photograph, same two-line
 * head, same stepper-height block. A skeleton that reflows when the data lands
 * moves the text under the shopper's eye exactly as they start reading it,
 * which is the failure this is supposed to prevent rather than cause.
 *
 * THREE ROWS because a basket the shopper is opening has at least one thing in
 * it and a median cart is small; three is enough to read as a list without
 * promising a fuller basket than arrives.
 *
 * EXPORTED SO A TEST CAN SEE IT. The drawer itself is unreachable from this
 * suite twice over — `useCart` needs a provider that does not run under
 * `react-dom/server`, and the sheet renders behind a Radix portal. `CLAUDE.md`
 * names the way out and `returns/return-intro.tsx` is its worked example: pull
 * the presentational half into its own component and assert THAT. This one is
 * pure markup with no props, no hooks and no context, so it costs nothing.
 */
export function CartSkeleton() {
  return (
    <SkeletonRegion label="Loading your cart" className="min-h-0 flex-1">
      <ul className="divide-y divide-brand-line px-6">
        {[0, 1, 2].map((row) => (
          <li key={row} className="flex gap-3 py-4">
            {/* `self-start` IS LOAD-BEARING, and measurement is the only way to
                see it. A flex child defaults to `align-self: stretch`, which
                hands this a definite height — the row's — and a definite height
                beats `aspect-ratio`. Measured at 375px it rendered 64×106: a
                filled grey PORTRAIT block standing in for what reads on screen
                as a square thumbnail, because the real `ProductPhoto` is an
                `object-contain` image that letterboxes inside the same tall box
                and so LOOKS 64×64. Opting out of the stretch makes the
                placeholder the size the photograph appears to be.

                It cannot change the row's height: the column beside it is
                106px of content and is what drives the row either way. */}
            <Skeleton className="aspect-square w-16 shrink-0 self-start rounded-md" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <TextSkeleton className="w-3/5 text-sm font-semibold" />
                  <TextSkeleton className="mt-0.5 w-2/5 font-mono text-xs" />
                </div>
                <TextSkeleton className="w-16 shrink-0 text-sm" />
              </div>
              {/* The stepper is a fixed 36px control (`h-9`), so this is a
                  height rather than a line box — the one place in this row
                  where a `TextSkeleton` would be the wrong tool. */}
              <Skeleton className="h-9 w-28 rounded-lg" />
              <TextSkeleton className="w-20 text-xs" />
            </div>
          </li>
        ))}
      </ul>
    </SkeletonRegion>
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

        {/* THE ONE THING THAT RENDERS BEFORE ANYTHING ELSE. A write that did not
            land is the shopper's own action failing, and it used to be silent:
            the drawer kept drawing the basket it already had and the button
            simply did nothing. `role="alert"` because they pressed something
            and are owed an answer. */}
        {cart.problem && (
          <p
            role="alert"
            /* WAS `red-700`, HAND-PICKED. Same colour — `--destructive-strong`
               IS red-700 — so this is a change of spelling, not of pixels, and
               the repo-wide grep in `house-rules.test.ts` can hold it. */
            className="mx-6 mt-4 border border-destructive-strong px-3 py-2 text-sm text-destructive-strong"
          >
            {cart.problem}
          </p>
        )}

        {/* The lines the server is holding that nothing can buy, and the only
            control in the store that can remove them. Above the basket because
            it is what stops the basket working. */}
        <UnsellableNotice
          lines={cart.unsellable}
          pending={cart.pending}
          onRemove={cart.removeLineId}
          className="mx-6 mt-4"
        />

        {/* Anything derived from the cart renders nothing until hydrated —
            otherwise this would flash an empty cart before the real one
            loads from the server. See cart-context.tsx. */}

        {/* `!cart.problem` FOR THE SAME REASON THE EMPTY STATE CARRIES IT. A
            read that failed is not a read still running, and a basket shape
            drawn over "We couldn't load your cart" promises rows that are
            never coming. The notice is the whole answer in that case. */}
        {!cart.hydrated && !cart.problem && <CartSkeleton />}

        {/* `!cart.problem`: an empty basket and an unreadable one are different
            claims, and only one of them is ours to make. Without this the
            drawer stacked "We couldn't load your cart" directly on top of "Your
            cart is empty" — the second sentence being exactly what the first
            one says we do not know. */}
        {/* `unsellable.length === 0` TOO. A basket holding one unbuyable line
            is not empty — it is stuck, and those are opposite instructions.
            Saying "empty" over the notice that names the blocking row would be
            the drawer contradicting itself in adjacent paragraphs. */}
        {cart.hydrated && cart.resolved.length === 0 && cart.unsellable.length === 0 && !cart.problem && (
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
                <span className="text-sm text-muted-foreground">Subtotal</span>
                <span className="font-mono text-base font-bold tabular-nums text-foreground">
                  {formatNaira(cart.subtotal)}
                </span>
              </div>

              {cart.savings > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">You save</span>
                  <span className="font-mono text-sm font-semibold tabular-nums text-brand">
                    {formatNaira(cart.savings)}
                  </span>
                </div>
              )}

              {/* NOT A LINK WHILE SOMETHING UNBUYABLE IS IN THE BASKET.
                  `/checkout` answers `unresolved_lines` for exactly this cart
                  and tells the shopper to go back and remove the line, so an
                  enabled button here is a round trip whose only outcome is
                  being sent back to the notice above it. */}
              {cart.unsellable.length > 0 ? (
                <Button type="button" disabled className="w-full">
                  Checkout
                </Button>
              ) : (
                <SheetClose asChild>
                  <Button asChild className="w-full focus-visible:ring-brand focus-visible:ring-offset-background">
                    <Link href="/checkout">Checkout</Link>
                  </Button>
                </SheetClose>
              )}

              <SheetClose asChild>
                <Button
                  asChild
                  variant="outline"
                  className="w-full focus-visible:ring-brand focus-visible:ring-offset-background"
                >
                  <Link href="/cart">View cart</Link>
                </Button>
              </SheetClose>

              {/* THIS SENTENCE USED TO SAY "it stays on this device", WHICH WAS
                  TRUE OF A `localStorage` CART AND IS NOT TRUE OF THIS ONE. The
                  basket is now held by the commerce API against a cookie, so it
                  survives a reload and a new tab in this browser, and it
                  EXPIRES — the cart cookie carries a two-week `Max-Age`. */}
              <p className="text-center text-xs text-muted-foreground">
                {"Your cart is saved for two weeks — come back to it in this browser."}
              </p>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
