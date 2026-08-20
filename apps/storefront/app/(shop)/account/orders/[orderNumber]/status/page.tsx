import { Suspense } from "react";
import { OrderStatusPage, OrderStatusSkeleton } from "@plaspool/shop";

/**
 * The whole journey of one order, signed-in or guest-with-`?token=`.
 *
 * `useSearchParams` inside `OrderStatusPage` requires a `Suspense` boundary at
 * the route — the same shape `/account/orders/[orderNumber]` and
 * `/checkout/complete` use, for the same reason.
 *
 * ═══ THE FALLBACK IS THE REAL SKELETON, DRAWN ON THE SERVER ═══
 * It was `null`, and `null` here is not "nothing to show yet" — it is a blank
 * `<main>` in the server's HTML, so the first paint of this page was an empty
 * page. Measured: `<main>` came back 65 bytes, all of it Suspense markers.
 * `CLAUDE.md`'s loading rule is that a known layout is DRAWN, and this layout
 * is known — better than known, because the route can answer part of it
 * outright. The order number is in `params` and the guest's token is in
 * `searchParams`, so the skeleton renders the real breadcrumb and the real
 * title on the server and only the parts that need the order are grey.
 *
 * NO SERVER FETCH AT ALL, and that is the difference from the order page next
 * door. That one reads the public catalogue on the server because an order line
 * carries no image field and a picture has to be resolved `variantId` →
 * catalogue. This page shows no pictures — it shows stops, stamps and the
 * shop's own messages — so there is nothing anonymous to read, and it makes the
 * one call it needs (the order, over the caller's cookie or their token) in the
 * browser.
 */
export const dynamic = "force-dynamic";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ orderNumber }, query] = await Promise.all([params, searchParams]);
  /* A REPEATED `?token=` ARRIVES AS AN ARRAY, and `token=a&token=b` is a thing
     anyone can type. Only a single string is a credential; anything else is
     treated as no token at all, which degrades to the signed-in trail rather
     than to a link built out of `["a","b"].toString()`. */
  const token = typeof query.token === "string" ? query.token : null;

  return (
    <Suspense
      fallback={
        <OrderStatusSkeleton
          orderNumber={decodeURIComponent(orderNumber)}
          isGuest={token !== null}
          token={token}
        />
      }
    >
      <OrderStatusPage />
    </Suspense>
  );
}

/* Per-customer state, same reasoning as `/account/orders`: the order is
   cookie-identified or token-identified, so nothing keyed to a person is
   fetched on the server and `force-dynamic` keeps this segment out of the
   static shell rather than letting one customer's order get baked into a page
   the Worker's cache could hand to the next visitor.

   READING `searchParams` DOES NOT BREAK THAT. The token is already in the URL
   the visitor typed; it is used here only to shape a placeholder, and nothing
   is fetched with it on the server. */
