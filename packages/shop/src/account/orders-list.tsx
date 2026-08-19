"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PackageSearch, ShoppingBag } from "lucide-react";
import { Button } from "@plaspool/ui";

import { EmptyState } from "../components/empty-state";
import { getShopCustomer } from "../data/auth-api";
import { listOrders } from "../data/orders-api";
import type { OrderListItem } from "../data/orders-api";
import { majorUnits } from "../data/cart-api";
import { formatNaira } from "../data/money";

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
          return;
        }
        setItems(result.items);
        setCursor(result.nextCursor);
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

  if (status !== "ready") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="font-sans text-sm text-muted-foreground">Checking your account…</p>
      </div>
    );
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
                className="flex items-center justify-between gap-4 border-2 border-foreground px-4 py-4 transition-colors hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <div className="min-w-0">
                  <p className="font-sans text-sm font-semibold text-foreground">
                    Order {order.orderNumber}
                  </p>
                  <p className="mt-1 font-sans text-xs text-muted-foreground">
                    {formatDate(order.createdAt)} · {lines.length} item
                    {lines.length === 1 ? "" : "s"} · {order.status}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-foreground">
                  {formatNaira(majorUnits(order.grandTotal))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {cursor && (
        <div className="mt-6 flex flex-col items-center gap-2">
          <Button type="button" variant="outline" onClick={loadMore} disabled={loading}>
            {loading ? "Loading…" : "Load more orders"}
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

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}
