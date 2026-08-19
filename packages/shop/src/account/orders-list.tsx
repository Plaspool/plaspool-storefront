"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PackageSearch, ShoppingBag } from "lucide-react";
import { Button, Skeleton, SkeletonRegion } from "@plaspool/ui";

import { EmptyState } from "../components/empty-state";
import { shortStatusFor } from "./order-progress";
import { getShopCustomer } from "../data/auth-api";
import { listOrders } from "../data/orders-api";
import type { OrderListItem } from "../data/orders-api";
import { majorUnits } from "../data/cart-api";
import { formatNaira } from "../data/money";
import { PointsSummary } from "./points-summary";

const PAGE_SIZE = 20;

/**
 * `/account/orders` — the signed-in customer's order list.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * `"use client"`, LIKE EVERY OTHER PER-CUSTOMER SCREEN IN THE SHOP.
 * `GET /orders` is cookie-identified and answers one customer's own rows —
 * fetching it from a server component would bake one customer's orders into
 * a page the Worker's cache could then serve to the next visitor. See
 * `cart-api.ts`'s file header for the same rule applied to the cart.
 *
 * A 401 HERE IS NOT AN ERROR SCREEN. It means "sign in to see these", so
 * this reads `GET /api/shop/customer/me` first — it never 401s — rather than
 * inferring identity from a failed list call, and sends a guest to
 * `/sign-in` instead of rendering a crash.
 *
 * CURSOR-PAGINATED, LIKE THE BLOG'S `LoadMore`. The API has no page numbers
 * and no total count, so neither exists here either.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function OrdersListPage() {
  const router = useRouter();
  const [status, setStatus] = React.useState<"checking" | "guest" | "ready">("checking");
  const [items, setItems] = React.useState<OrderListItem[]>([]);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [initialFailed, setInitialFailed] = React.useState(false);
  /* SEPARATE FROM `status`, and load-bearing. The session check resolving does
     not mean the orders have arrived, and `items.length === 0` is also what an
     empty account looks like — so without this the list flashed "No orders yet"
     at every customer who had some, for as long as the first page took. */
  const [firstPage, setFirstPage] = React.useState<"loading" | "done">("loading");

  React.useEffect(() => {
    let cancelled = false;
    getShopCustomer().then((customer) => {
      if (cancelled) return;
      if (!customer) {
        setStatus("guest");
        router.replace("/sign-in");
        return;
      }
      setStatus("ready");
      listOrders(undefined, PAGE_SIZE).then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          if (result.reason === "unauthenticated") {
            router.replace("/sign-in");
            return;
          }
          setInitialFailed(true);
          setFirstPage("done");
          return;
        }
        setItems(result.items);
        setCursor(result.nextCursor);
        setFirstPage("done");
      });
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    setFailed(false);
    const result = await listOrders(cursor, PAGE_SIZE);
    if (!result.ok) {
      setFailed(true);
      setLoading(false);
      return;
    }
    setItems((prev) => [...prev, ...result.items]);
    setCursor(result.nextCursor);
    setLoading(false);
  }

  if (status !== "ready" || (firstPage === "loading" && !initialFailed)) {
    return <OrdersListSkeleton />;
  }

  if (initialFailed) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={<PackageSearch aria-hidden="true" />}
          title="Couldn't load your orders"
          body="Something went wrong reaching the order history — refresh to try again."
          action={
            <Button type="button" onClick={() => window.location.reload()}>
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        Your orders
      </h1>

      {/* Absent for most accounts, and absent rather than zero — see the
          component's own header. */}
      <PointsSummary />

      {items.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<ShoppingBag aria-hidden="true" />}
            title="No orders yet"
            body="Once you check out, your orders will show up here."
            action={
              <Button asChild>
                <Link href="/store">Go to the store</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {items.map(({ order, lines }) => (
            <li key={order.orderNumber}>
              <Link
                href={`/account/orders/${encodeURIComponent(order.orderNumber)}`}
                className="flex items-center justify-between gap-4 border border-brand-line px-4 py-4 transition-colors hover:border-foreground hover:bg-brand-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <div className="min-w-0">
                  <p className="font-sans text-sm font-semibold text-foreground">
                    Order {order.orderNumber}
                  </p>
                  <p className="mt-1 font-sans text-xs text-muted-foreground">
                    {formatDate(order.placedAt)} · {lines.length} item
                    {lines.length === 1 ? "" : "s"} · {shortStatusFor(order)}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-foreground">
                  {formatNaira(majorUnits({ amount: order.grandTotal, currency: order.currency }))}
                </span>
              </Link>
            </li>
          ))}
          {/* THE NEXT PAGE, WHILE IT IS COMING. The button's label changing is
              the CONTROL's pending state; this is the CONTENT's. A list that
              only dims its button leaves the shopper watching nothing happen
              until the rows appear all at once — and the rows' shape is known,
              so `CLAUDE.md`'s rule applies to a second page exactly as it does
              to the first. Two rows, because the page is 20 but the wait is
              short and a screenful of grey would overstate it. */}
          {loading &&
            Array.from({ length: 2 }, (_, i) => (
              <li key={`pending-${i}`} aria-hidden="true">
                <div className="flex items-center justify-between gap-4 border border-brand-line px-4 py-4">
                  <div className="flex min-w-0 flex-col gap-2">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-4 w-20 shrink-0" />
                </div>
              </li>
            ))}
        </ul>
      )}

      {cursor && (
        <div className="mt-6 flex flex-col items-center gap-2">
          {/* `aria-busy` rather than a changed label: the rows above are
              already announcing the wait, and a button that renames itself
              mid-press is read out as a different control. */}
          <Button
            type="button"
            variant="outline"
            onClick={loadMore}
            disabled={loading}
            aria-busy={loading}
          >
            Load more orders
          </Button>
          {failed && (
            <p role="alert" className="font-sans text-sm text-destructive">
              Could not load more orders. Try again.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The wait, shaped like the list.
 *
 * `CLAUDE.md`, "Loading states — skeletons, never prose". Four rows: enough to
 * read as a list, few enough that a customer with two orders does not watch
 * half the page collapse when the data lands.
 */
function OrdersListSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <SkeletonRegion label="Loading your orders">
        <Skeleton className="h-8 w-48 sm:h-9" />
        <ul className="mt-8 flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-4 border border-brand-line px-4 py-4"
            >
              <div className="flex min-w-0 flex-col gap-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-4 w-20 shrink-0" />
            </li>
          ))}
        </ul>
      </SkeletonRegion>
    </div>
  );
}

/** `placedAt` is epoch ms, not an ISO string. */
function formatDate(epochMs: number): string {
  const date = new Date(epochMs);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}
