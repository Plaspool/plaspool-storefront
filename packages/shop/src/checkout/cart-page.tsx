"use client";

import { Link } from "../components/link";
import { ShoppingCart } from "lucide-react";
import { Button } from "@plaspool/ui";

import { EmptyState } from "../components/empty-state";
import { Price } from "../components/price";
import { QuantityStepper } from "../components/quantity-stepper";
import { ProductPhoto } from "../components/product-photo";
import { formatNaira } from "../data/money";
import { BulkLinePrice } from "../cart/bulk-line-price";
import { useCart } from "../cart/cart-context";
import { stockWarning } from "../cart/stock";
import { UnsellableNotice } from "../cart/unsellable-notice";
import type { CartLineKey, ResolvedLine } from "../cart/types";
import { lineDescriptor, variantDescriptor } from "../cart/line-descriptor";

/**
 * `/cart` — the full-page basket, next to the drawer rather than instead of
 * it. The drawer stays the fast in-and-out from an add; this is the
 * destination a cart badge or a bookmark lands on, and it is where "Checkout"
 * actually starts the flow rather than just opening the drawer.
 */

function toKey(line: ResolvedLine): CartLineKey {
  return { productSlug: line.product.slug, colourId: line.colour.id, sizeId: line.size.id };
}

/* ═══ THE TRACK HAS TO BE ALLOWED TO SHRINK, OR THE PHONE SCROLLS SIDEWAYS ═══
   Every name on this page is `truncate`, which is `white-space: nowrap` — so a
   row's MIN-CONTENT width is the product name at full length, ellipsis or not.
   A grid track written `1fr` is `minmax(auto, 1fr)`, and `auto` as a MINIMUM is
   exactly that min-content: the column is floored at the longest name, and the
   items overflow a container that is itself the correct width.

   Measured on the live cart at a 375px viewport, one line, one ordinary
   product name:

       80 photo + 16 gap + 319 name + 12 gap + 64 price = a 491px track

   inside a grid box measuring 375px — 132px of horizontal scroll on every
   phone, which drags the header, the footer and the cookie banner off-screen
   with it. The `min-w-0` further down the row does NOT reach this. That lets a
   FLEX item shrink once a width is being distributed; the track is sized from
   min-content CONTRIBUTIONS before any of that applies.

   `minmax(0, 1fr)` drops the floor to zero, which is what finally lets
   `truncate` truncate. Same trap and same fix as `ROW_BOX` in
   `account/orders-list.tsx`, whose comment is worth reading next to this one.

   BOTH tracks are spelled out on purpose. Bare `grid` leaves an IMPLICIT
   `auto` column carrying the identical floor, so the phone layout needs its
   own declaration rather than inheriting one; and `lg` gets `minmax(0, …)`
   too, so a long enough product name cannot push the desktop layout out by the
   same mechanism. `grid-cols-2` and friends compile to `repeat(N, minmax(0,
   1fr))` for this reason — an arbitrary track opts out of that protection.

   Exported so a test can read it: this page returns null until `cart.hydrated`,
   so the class never appears in server-rendered markup and cannot be asserted
   the way `orders-list.test.tsx` asserts its row box. */
export const CART_GRID =
  "mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)] gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:py-16";

export function CartPage() {
  const cart = useCart();

  if (!cart.hydrated) return null;

  /* ═══ THE SAME GUARD THE DRAWER HAS, ON THE PAGE A BOOKMARK LANDS ON ═══
     The drawer stopped asserting an empty basket on a failed read; this page
     and the checkout did not, so the identical failure produced "Your cart is
     empty" here and "We couldn't load your cart" in the drawer — at the same
     instant, about the same cart. An empty basket and an unreadable one are
     different claims and only one of them is ours to make. */
  if (cart.problem) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Your cart
        </h1>
        <p
          role="alert"
          /* WAS `red-700`, HAND-PICKED — same colour, now the token. See the
             twin of this line in `cart-drawer.tsx`. */
          className="mt-8 border border-destructive-strong px-4 py-3 text-sm text-destructive-strong"
        >
          {cart.problem}
        </p>
        <Button type="button" variant="outline" onClick={() => window.location.reload()} className="mt-4">
          Try again
        </Button>
      </div>
    );
  }

  /* ═══ A STUCK BASKET IS NOT AN EMPTY ONE, AND MUST NOT SAY IT IS ═══
     `resolved` alone said "empty" for a cart still holding a line nothing can
     buy — the same claim the badge was contradicting one page up. Printing the
     notice ABOVE an "Your cart is empty" heading would not fix that, it would
     just move the contradiction into a single viewport: one paragraph naming
     the item that is blocking checkout, the next saying there is no item.

     So when the only thing left is unbuyable, this page names it and offers the
     Remove that no other control in the store can reach — and does not claim
     the basket is empty until it actually is. */
  if (cart.resolved.length === 0 && cart.unsellable.length > 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Your cart
        </h1>
        <UnsellableNotice
          lines={cart.unsellable}
          pending={cart.pending}
          onRemove={cart.removeLineId}
        />
        <p className="mt-6 text-sm text-muted-foreground">
          Nothing else is in your cart yet.
        </p>
        <Button
          asChild
          variant="outline"
          className="mt-4"
        >
          <Link href="/store">Browse the store</Link>
        </Button>
      </div>
    );
  }

  if (cart.resolved.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={<ShoppingCart aria-hidden="true" />}
          title="Your cart is empty"
          action={
            <Button asChild>
              <Link href="/store">Browse the store</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className={CART_GRID}>
      <div>
        <h1 className="mb-6 text-2xl font-bold text-foreground">Your cart</h1>
        <UnsellableNotice
          lines={cart.unsellable}
          pending={cart.pending}
          onRemove={cart.removeLineId}
          className="mb-6"
        />
        <ul className="flex flex-col divide-y divide-brand-line border-y border-brand-line">
          {cart.resolved.map((line) => (
            <li key={line.key} className="flex gap-4 py-5">
              <ProductPhoto
                src={line.colour.imageUrl ?? line.product.coverImageUrl}
                /* Decorative, like the drawer's row: the product, colour and
                   size are already stated in text beside it. */
                alt=""

                colourHex={line.colour.hex}
                weightGrams={line.size.weightGrams}
                className="aspect-square w-20 shrink-0"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/store/products/${line.product.slug}`}
                      className="block truncate text-sm font-semibold text-foreground hover:underline"
                    >
                      {line.product.name}
                    </Link>
                    <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                      {variantDescriptor(line.colour.name, line.size.label)}
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
                    amount={line.total * 100}
                    currency={line.size.currency}
                    size="sm"
                    className="shrink-0"
                  />
                </div>
                {/* The per-unit price and, when a bulk rung applied, the
                    struck-through list price and the quantity that earned it.
                    The `Price` above is the LINE total — the server's
                    `lineTotal`, never `unitPrice × qty`. */}
                <BulkLinePrice
                  unitPrice={line.unitPrice}
                  effectiveUnitPrice={line.effectiveUnitPrice}
                  bulkPercentBps={line.bulkPercentBps}
                  bulkQty={line.bulkQty}
                  lineQty={line.qty}
                />

                {/* THE SAME CAP THE DRAWER APPLIES, from the same `maxQty` the
                    provider computed — not a second reading of the rule here.
                    `/cart` and the drawer are two renderings of one basket, and
                    a ceiling that held in one and not the other is the class of
                    split `sellable.ts` records at length. */}
                {stockWarning(line.qty, line.maxQty) !== null && (
                  <p className="font-mono text-xs font-medium text-muted-foreground">
                    {`Only ${line.maxQty} left`}
                  </p>
                )}

                <div className="flex items-center justify-between gap-3">
                  <QuantityStepper
                    value={line.qty}
                    onChange={(qty) => cart.setQty(toKey(line), qty)}
                    max={line.maxQty}
                    pending={cart.pendingKey === line.key}
                    label={lineDescriptor(line.product.name, line.colour.name, line.size.label)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => cart.remove(toKey(line))}
                    disabled={cart.pendingKey === line.key}
                    className="h-auto px-2 py-1 text-xs text-muted-foreground"
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
            <span className="text-sm text-muted-foreground">Subtotal</span>
            <span className="font-mono text-base font-bold tabular-nums text-foreground">
              {formatNaira(cart.subtotal)}
            </span>
          </div>
          {cart.savings > 0 && (
            <div className="mt-1 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">You save</span>
              <span className="font-mono text-sm font-semibold tabular-nums text-brand">
                {formatNaira(cart.savings)}
              </span>
            </div>
          )}
          {/* `/checkout` refuses this exact cart with `unresolved_lines`, whose
              own copy is "go back to the cart and remove it" — so an enabled
              button here sends the shopper on a round trip back to the notice
              already on this page. Disabled, with that notice as the reason. */}
          {cart.unsellable.length > 0 ? (
            <Button type="button" disabled tone="primary" className="mt-4 w-full h-12 text-base">
              Checkout
            </Button>
          ) : (
            <Button
              asChild
              tone="primary"
              className="mt-4 w-full h-12 text-base"
            >
              <Link href="/checkout">Checkout</Link>
            </Button>
          )}
          <p className="mt-3 text-center text-xs text-muted-foreground">
            {cart.unsellable.length > 0
              ? "Remove the unavailable item above to continue."
              : "Delivery and tax are calculated at checkout."}
          </p>
        </div>
      </aside>
    </div>
  );
}
