"use client";

import * as React from "react";
import { Link } from "../components/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PackageSearch, ShoppingBag } from "lucide-react";
import { Button, NEO_SURFACE, Skeleton, SkeletonRegion, cn } from "@plaspool/ui";

import { EmptyState } from "../components/empty-state";
import { TabRow, TabRowSkeleton } from "./tab-row";
import { LineThumb, LineThumbSkeleton } from "../components/line-thumb";
import { outcomeOf, shortStatusFor } from "./order-progress";
import { readShopSession } from "../data/auth-api";
import { listOrders } from "../data/orders-api";
import type { OrderLine, OrderListItem } from "../data/orders-api";
import type { LineImageIndex } from "../data/catalog";
import { majorUnits } from "../data/cart-api";
import { formatNaira } from "../data/money";
import { formatStamp } from "./stamp";
import { AccountShell } from "./account-shell";

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
 *
 * ═══ `lineImages` IS THE ONE THING THIS PAGE DOES NOT FETCH ITSELF ═══
 * An order line carries no image field, so a picture has to be resolved
 * `variantId` → catalogue. That catalogue is PUBLIC and identical for every
 * visitor, which makes it the one part of this screen that may be read on the
 * server — and it has to be, so twenty rows cost one cached read instead of a
 * request per line. The route hands it in; the customer's own orders still come
 * from here, over their cookie, exactly as the rule above requires.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function OrdersListPage({ lineImages }: { lineImages: LineImageIndex }) {
  const router = useRouter();
  /* ═══ THE TAB LIVES IN THE URL, AND THAT IS WHAT KEEPS YOUR PLACE ═══
     `?show=` rather than `useState` for three reasons that all bite: a shopper
     who opens an order from the cancelled half and presses Back returns to the
     cancelled half; the view is linkable, which is what a support conversation
     needs; and — the one that is easy to miss — switching tabs is a navigation
     within the SAME route, so this component is not remounted and the pages of
     orders already fetched are still here. A `useState` tab would have been
     identical to use and would have thrown the first two away.
     ANY OTHER VALUE IS "ongoing". `?show=nonsense` is a typo or a stale link,
     and the ordinary half of the list is the right answer to both. */
  const show = readTab(useSearchParams().get(TAB_PARAM));
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
    readShopSession().then((result) => {
      if (cancelled) return;
      /* ═══ ONLY A CONFIRMED GUEST IS SENT TO SIGN IN ═══
         This read `getShopCustomer`, which collapses a transport failure into
         `null` — so one timed-out request bounced a signed-in customer to a
         login screen and told them, in effect, that they were not signed in.
         An unreachable API is an error to report on the page they asked for.
         `?next=` so signing in returns them here rather than stranding them on
         a generic sign-in page. */
      if (result.kind === "unknown") {
        setStatus("ready");
        setInitialFailed(true);
        setFirstPage("done");
        return;
      }
      if (result.kind === "guest") {
        setStatus("guest");
        router.replace(`/sign-in?next=${encodeURIComponent("/account/orders")}`);
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
      <AccountShell width="wide">
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
      </AccountShell>
    );
  }

  return (
    <OrdersList
      items={items}
      cursor={cursor}
      loading={loading}
      failed={failed}
      onLoadMore={loadMore}
      show={show}
      lineImages={lineImages}
    />
  );
}

/**
 * The list itself, given its rows.
 *
 * Exported and prop-driven for the same reason `OrderDetail` is next door: the
 * states that matter here — an account with orders at all — are unreachable in
 * a dev environment, because `GET /orders` is credentialed and localhost is not
 * in the API's `APP_ORIGINS`. A fixture renders this directly.
 */
export function OrdersList({
  items,
  cursor,
  loading,
  failed,
  onLoadMore,
  show = "ongoing",
  lineImages,
}: {
  items: OrderListItem[];
  cursor: string | null;
  loading: boolean;
  failed: boolean;
  onLoadMore: () => void;
  /** Which half of the list is on screen. A prop rather than internal state so
   *  the URL owns it (`?show=`) and the bench can render both at once. */
  show?: OrdersTab;
  /**
   * `variantId` → the picture that line may honestly show, from one cached
   * catalogue read the route already made.
   *
   * THE CONTRACT, NOT A DESCRIPTION OF THE ROWS: draw an entry with
   * `LineThumb`, and with nothing else. A variant absent from this index — or
   * present carrying neither a photograph nor a colour — has no appearance that
   * can be sourced, and `LineThumb` owns what that renders as, so no row can
   * quietly substitute a spool in a colour taken from the line's own text.
   */
  lineImages: LineImageIndex;
}) {
  /* ═══ THE SPLIT IS ONE FUNCTION'S ANSWER, READ TWICE ═══
     `outcomeOf` is what the detail page and the status history both use to
     decide whether an order is over. The list asks the same question of the
     same order columns, so a row cannot land under "Cancelled & refunded"
     while the page it opens says the parcel is on its way. */
  const { ongoing, stopped } = splitOrders(items);
  const shown = show === "stopped" ? stopped : ongoing;
  const otherCount = show === "stopped" ? ongoing.length : stopped.length;

  return (
    <AccountShell width="wide">
      <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        Your orders
      </h1>

      {/* ═══ THE BALANCE USED TO BE HERE, AND IT MOVED TO `/account` ═══
          A balance summary sat above these rows because it was the only place a
          shopper could see their balance at all. It answered a question nobody
          on this page had asked: somebody opening their order list wants to
          know where a parcel is. The account hub and `/account/rewards` are
          both about the balance and both link to each other, so the orders list
          is about orders again. */}

      {items.length === 0 && !loading ? (
        /* NO TABS OVER AN ACCOUNT WITH NO ORDERS. Two headings offering to
           filter nothing is a control that can only disappoint; the empty state
           is the whole page here. */
        <div className="mt-8">
          <EmptyState
            icon={<ShoppingBag aria-hidden="true" />}
            title="No orders yet"
            body="Once you check out, your orders will show up here."
            action={
              /* ═══ THE ONE NEOBRUTALIST CONTROL ON THIS SCREEN ═══
                 The treatment — 2px stroke, hard offset shadow, a press that
                 travels into it — marks the single thing a screen wants you to
                 do, and it is spent here rather than anywhere else in the
                 account area for a specific reason: this is the ONLY state in
                 which this page has a call to action at all. An account with
                 orders in it offers rows to read, a tab to switch and a page to
                 load; none of those is a call to action and raising one would
                 be the page guessing which order you came for. An account with
                 NO orders has exactly one useful next move, and nothing to
                 compete with it. */
              <Button asChild className={cn(NEO_SURFACE, "h-11 px-5")}>
                <Link href="/store">Go to the store</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <OrdersTabs show={show} className="mt-8" />

          {shown.length === 0 && !loading ? (
            <TabEmpty show={show} otherCount={otherCount} more={cursor !== null} />
          ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {shown.map(({ order, lines }) => (
            <li key={order.orderNumber}>
              <Link
                href={`/account/orders/${encodeURIComponent(order.orderNumber)}`}
                className={cn(
                  ROW_BOX,
                  "transition-colors hover:border-foreground hover:bg-brand-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                )}
              >
                {/* `truncate` ON BOTH LINES, AND IT IS LOAD-BEARING RATHER THAN
                    TIDY. A wrapped line makes the row 16px taller, and the
                    skeleton cannot know which rows will wrap — so a wrapping
                    row is a row that reflows the instant its data lands, which
                    is the one thing `CLAUDE.md` says is worse than no skeleton
                    at all. Nailed to one line each, the text block is
                    20 + 4 + 16 = 40px for every order at every width, which is
                    what `ROW_BOX` and `OrderRowSkeleton` are both built on.
                    Measured at 320px the number needs 158px of the 176px this
                    column gets and the metadata 175px, so nothing clips today;
                    a longer status than "Partly refunded" would ellipsis rather
                    than reflow, and losing the tail of the SECOND line is the
                    cheapest thing on the row to lose. */}
                <div className="min-w-0 sm:col-start-2 sm:row-start-1">
                  {/* ═══ THE STATUS LEADS THE ROW, AND THE ORDER NUMBER USED TO
                      ═══
                      The number was the headline — `text-sm`, weight 600,
                      near-black — and the state of the parcel was the THIRD
                      dot-separated fragment of the grey 12px line under it,
                      behind a date. A shopper scanning this page is answering
                      "where is my order", and the answer was the smallest,
                      faintest thing on the row while the one string nobody has
                      ever memorised was the loudest.
                      THE TWO LINES SWAPPED TYPE RATHER THAN MOVING. The text
                      block is 20 + 4 + 16 = 40px whichever way round it is, so
                      the row, `ROW_BOX` and `OrderRowSkeleton` are all
                      unaffected — measured identical at every width. What
                      changed is which line is `text-sm` and which is `text-xs`.
                      THE DATE STAYS WITH THE STATUS. "Sent · 18 Aug 2026" is
                      the pair a shopper reads together; the order number and
                      the item count are what they read when looking for a
                      specific order, and they belong on the quiet line. */}
                  <p className="truncate font-sans text-sm font-semibold text-foreground">
                    {shortStatusFor(order)}{" "}
                    <span className="font-normal text-muted-foreground">
                      · {formatStamp(order.placedAt, { dateOnly: true })}
                    </span>
                  </p>
                  {/* UNITS, NOT LINES — `itemCount` carries the whole story,
                      and the "+N" on the rail is anchored to this number. */}
                  <p className="mt-1 truncate font-sans text-xs text-muted-foreground">
                    Order {order.orderNumber} · {itemCount(lines)} item
                    {itemCount(lines) === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-foreground sm:col-start-3 sm:row-start-1">
                  {formatNaira(majorUnits({ amount: order.grandTotal, currency: order.currency }))}
                </span>
                {/* LAST IN THE DOM, FIRST IN THE ROW FROM `sm` UP. The grid
                    places it; the source order is what a screen reader and the
                    keyboard walk, and the row's own answer — its status, then
                    its number — has to be the first thing either of them
                    meets, not a rail of decorative squares. */}
                <OrderRowPictures lines={lines} lineImages={lineImages} />
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
                <OrderRowSkeleton />
              </li>
            ))}
        </ul>
          )}
        </>
      )}

      {cursor && (
        <div className="mt-6 flex flex-col items-center gap-2">
          {/* `aria-busy` rather than a changed label: the rows above are
              already announcing the wait, and a button that renames itself
              mid-press is read out as a different control. */}
          <Button
            type="button"
            variant="outline"
            onClick={onLoadMore}
            disabled={loading}
            aria-busy={loading}
          >
            Load more orders
          </Button>
          {failed && (
            /* `destructive-strong` — the base token is a fill and fails AA as
               text. See `globals.css`. */
            <p role="alert" className="font-sans text-sm text-destructive-strong">
              Could not load more orders. Try again.
            </p>
          )}
        </div>
      )}
    </AccountShell>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 * THE TWO HALVES OF AN ORDER LIST
 *
 * An order is either still a live arrangement between the shop and the shopper
 * — on its way, or delivered and settled — or it STOPPED: cancelled, or the
 * money came back. Those two are read for completely different reasons. The
 * first is "where is my parcel"; the second is "what happened to my money", and
 * it is usually months later. Mixed into one stream, the second buries the
 * first, which is the state a shopper actually opens this page in.
 *
 * ═══ THE SPLIT IS `outcomeOf`, WHICH IS NOT A NEW RULE ═══
 * It is the same function `OrderProgress` uses for its note and the status
 * history uses for its terminal row: a cancellation outranks a refund, and both
 * end the order. Reimplementing "is it over" here — `status === "cancelled" ||
 * status === "refunded"` looks obviously equivalent — is how a row ends up
 * under "Ongoing" while the page it opens says "Refunded", because that spelling
 * misses `refundedTotal > 0` on a `partially_refunded` order and misses
 * `cancelledAt` set on an order whose status never moved.
 *
 * ═══ IT ANSWERS FROM ORDER COLUMNS ALONE, WHICH IS WHY A LIST MAY ASK ═══
 * `outcomeOf(order, [])` reads `cancelledAt`, `status` and `refundedTotal` —
 * every one of them on the order itself. The events are only ever consulted for
 * a DATE, and a row does not print one. So the list gets the same verdict the
 * detail page gets, with no extra request. `shortStatusFor` next door has the
 * same property and the same reason.
 * ════════════════════════════════════════════════════════════════════════════ */

/** Which half of the list is being read. */
export type OrdersTab = "ongoing" | "stopped";

/** The query parameter that carries it. Named once so the tab links, the page
 *  and any test cannot disagree about the spelling. */
export const TAB_PARAM = "show";

/** `?show=` → a tab. Anything unrecognised is the ordinary half. */
export function readTab(value: string | null | undefined): OrdersTab {
  return value === "stopped" ? "stopped" : "ongoing";
}

/** Where a tab lives. `ongoing` is the bare path rather than `?show=ongoing`,
 *  so the default view has ONE url and a shopper cannot end up with two
 *  history entries for the same screen. */
export function tabHref(tab: OrdersTab): string {
  return tab === "ongoing" ? "/account/orders" : `/account/orders?${TAB_PARAM}=${tab}`;
}

/**
 * The two halves, each keeping the API's own newest-first order.
 *
 * A SINGLE PASS THAT PRESERVES ORDER, not two `filter` calls — not for speed,
 * which is irrelevant at twenty rows, but because two filters are two places
 * for the predicate to be written, and the second one is where the negation
 * eventually goes wrong.
 */
export function splitOrders(items: OrderListItem[]): {
  ongoing: OrderListItem[];
  stopped: OrderListItem[];
} {
  const ongoing: OrderListItem[] = [];
  const stopped: OrderListItem[] = [];
  for (const item of items) {
    /* `.over`, NOT `.kind === null`. A PART refund has a kind and is not over —
       the admin lets a `partially_refunded` order be packed and shipped
       (`createFulfillment` guards on `status IN ('paid','partially_refunded')`),
       so filing it here by "any money came back" hid a parcel a courier was
       carrying from the tab a shopper opens to find it. */
    (outcomeOf(item.order, []).over ? stopped : ongoing).push(item);
  }
  return { ongoing, stopped };
}

const TAB_LABEL: Record<OrdersTab, string> = {
  /* NAMED FOR WHAT IS IN THEM, NOT FOR A STATE MACHINE. "Ongoing" alone would
     be a lie about the tab that also holds every delivered order — and a
     shopper looking for something they received last month would reasonably
     open the other one and find it empty. Both nouns are in both labels for
     that reason, and the pair is what makes the split self-explaining without a
     line of help text under it. */
  ongoing: "Ongoing & delivered",
  stopped: "Cancelled & refunded",
};

/** The two tabs, over the shared row. Everything about how a tab row LOOKS —
 *  the underline, the padding, the type step at 320px, why it is links rather
 *  than `role="tablist"` — lives in `tab-row.tsx`, because the rewards page
 *  draws the same row and the two copies had already drifted into the same two
 *  bugs before they were merged. */
function OrdersTabs({ show, className }: { show: OrdersTab; className?: string }) {
  return (
    <TabRow
      label="Which orders"
      current={show}
      className={className}
      items={(Object.keys(TAB_LABEL) as OrdersTab[]).map((tab) => ({
        key: tab,
        label: TAB_LABEL[tab],
        href: tabHref(tab),
      }))}
    />
  );
}

/**
 * A tab with nothing in it — which is a different thing from an account with
 * nothing in it, and says so.
 *
 * ═══ IT NEVER CLAIMS THE HALF IS EMPTY WHEN IT ONLY KNOWS THIS PAGE IS ═══
 * The list is cursor-paged and the split happens over what has been FETCHED, so
 * "no cancelled orders" is only true once there is no cursor left. While one
 * remains, the honest sentence is that none have turned up yet — and the way
 * forward is the "Load more orders" button already under this, so nothing new
 * is offered here that would compete with it.
 *
 * NO ICON AND NO `EmptyState`. That component draws a bordered panel with a
 * glyph, which is right for a whole page that has nothing on it and much too
 * loud for one half of a list the shopper can switch away from in one tap.
 */
function TabEmpty({
  show,
  otherCount,
  more,
}: {
  show: OrdersTab;
  otherCount: number;
  more: boolean;
}) {
  const other: OrdersTab = show === "ongoing" ? "stopped" : "ongoing";
  return (
    <div className="mt-6 border border-dashed border-brand-line px-4 py-8 text-center">
      <p className="font-sans text-sm text-foreground">
        {more
          ? `Nothing ${show === "ongoing" ? "ongoing" : "cancelled or refunded"} in what’s loaded so far.`
          : show === "ongoing"
            ? "Nothing on its way right now."
            : "Nothing cancelled or refunded — which is the good outcome."}
      </p>
      {otherCount > 0 && (
        <p className="mt-2 font-sans text-sm text-muted-foreground">
          <Link
            href={tabHref(other)}
            className="rounded-sm font-medium text-brand underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {TAB_LABEL[other]}
          </Link>{" "}
          {/* THE NUMBER IS OF WHAT IS LOADED, and it is only spoken where that
              distinction cannot mislead: this is an invitation to look
              somewhere else, not a count of the account. */}
          has {otherCount} {otherCount === 1 ? "order" : "orders"}.
        </p>
      )}
    </div>
  );
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PICTURES ON THE ROW — WHAT THEY COST, AND WHAT EACH DECISION GAVE UP.
 *
 * The row read "Order 2026-000007-F · 18 Aug 2026 · 5 items · Shipped ·
 * ₦118,000", and the only thing on it that identifies WHICH order it is, is the
 * one string the customer has never memorised. The bar is Amazon's "Your
 * Orders": the right order is picked out by looking, the pictures stay
 * subordinate to the information, and nothing about the row moves when it
 * loads.
 *
 * ═══ 40px, WHICH IS THE HEIGHT THE ROW ALREADY HAD ═══
 * The text block is `text-sm` (20px) + `mt-1` (4px) + `text-xs` (16px) = 40px,
 * so a 40px square rides inside the box the row already occupied: from `sm` up
 * the row is the same 40 + 32 + 2 = 74px it already was. `LineThumb`'s own
 * `DEFAULT_SIZE` of 48 was the other candidate and is rejected HERE and only
 * here: it adds 8px to every row in a twenty-row list, and it makes the picture
 * taller than the information it is supposed to be subordinate to. The detail
 * page has one order on it and can afford the bigger square; a list cannot.
 *
 * ═══ AT 320px THE ROW HAD ONE PIXEL OF SLACK, SO THE RAIL GETS ITS OWN LINE ═══
 * Measured, not estimated: at 320px the row's content box is 254px, and the
 * widest metadata line (175px) plus `gap-4` plus the widest total (62px) is
 * 253px of it. There is no 40px square that fits beside that, and every way of
 * making one fit costs something worse — a 124px column ellipsises
 * "Order 2026-000001-F" down to "Order 2026-000…", which is the row's identity
 * gone; hiding the rail below `sm` withholds the pictures from the width where
 * recognition matters most; shrinking the square to 28px stops it being a
 * picture of anything.
 *
 * So below `sm` the rail wraps to a second grid row spanning the full width
 * (126px a row), and from `sm` up it sits in a leading column (74px a row,
 * unchanged). Both heights are fixed by construction — see `ROW_BOX` — so
 * whichever one applies, the skeleton is already holding it.
 *
 * ═══ THE SLOT IS A FIXED WIDTH, AND THAT IS THE WHOLE ALIGNMENT ═══
 * The rail was sized by its contents once. Both defects that came out of that
 * are worth naming, because neither is visible in a screenshot of one row and
 * both survived a check that only measured row HEIGHT.
 *
 *   THE SKELETON REFLOWED SIDEWAYS. The wait draws one square; a resolved row
 *     draws one, two or three plus a count. Content-sized, that is a 40px, 86px
 *     or 158px first column — so the order number and the whole metadata line
 *     slid right by up to 113px at the moment the data landed, on the initial
 *     skeleton every visit and on the pending rows of every `loadMore`.
 *
 *   THE RESOLVED LIST HAD A RAGGED LEFT EDGE. Every row's text started at a
 *     different x depending on that order's line count — measured across the
 *     eight bench orders at 768px, a 113px spread down the one column a shopper
 *     scans vertically, with a five-line order's rail visually owning the left
 *     third of its row. That is the pictures pushing the information around,
 *     which is the opposite of subordinate.
 *
 * So the rail is `RAIL_PX` wide WHATEVER IS IN IT. One order's pictures cannot
 * move another order's text, and the wait cannot disagree with the row about
 * width however many squares either of them draws. The cost, stated plainly: a
 * one-line order carries 126px of empty rail. That emptiness is a COLUMN — the
 * same one on every row, which is how a fixed image slot reads in every list
 * that has one — and it is cheaper than the number a shopper is scanning for
 * moving under their eye.
 *
 * `MAX_THUMBS` is one number at every width too, because the "+N" is computed
 * in JS and a rail that showed a different count per breakpoint would print a
 * lie at three widths out of four.
 *
 * ═══ AND THE NUMBER COUNTS ITEMS, ANCHORED TO THE ONE THE ROW PRINTS ═══
 * `+2` sits beside a rail of pictures and is one keystroke from meaning "two
 * more PICTURES", which — for lines the catalogue cannot describe — would be a
 * claim about goods this shop cannot source a picture of. It counts ITEMS, in
 * the same units as the "N items" printed two lines up, and the invariant is
 * `itemCount(shown) + hidden === itemCount(lines)`. It says nothing about
 * whether those items have pictures; the squares do that one by one, and
 * `LineThumb` draws a dashed "no picture" box for a line the catalogue cannot
 * describe rather than letting the rail quietly skip it.
 *
 * ═══ ONE SQUARE PER LINE. YES, IT REPEATS. ═══
 * Today every variant in the catalogue resolves to the same product cover, so a
 * black spool and a red spool make two identical squares. Collapsing them —
 * deduplicating by the picture that resolved — was tried and rejected: it makes
 * a two-item order LOOK like a one-item order, and it does so because of a gap
 * in OUR photography rather than anything about the goods. That is our missing
 * data editing the customer's order. Two items, two squares; the day a
 * per-colour photograph is uploaded the rail becomes useful without this file
 * changing. Deduplicating by `variantId` is the same trade at a smaller scale
 * and additionally breaks the invariant above, which is what makes the count
 * checkable.
 *
 * ═══ SO WHAT A SQUARE MEANS, NOW THAT THE COUNT IS IN UNITS ═══
 * A square is a LINE — one product in one colour — and a line can be several
 * items. 2025-000042-F is one line of qty 2, so it draws ONE square beside
 * "2 items". `squares + N` therefore equals the item count only when every
 * shown line is qty 1; what is always true is the sentence the rail actually
 * makes, which is "pictures of some of what you bought, and N items with
 * none". A per-square quantity badge is the obvious next thing and is
 * deliberately absent: it is a second number on a 40px square in a row that
 * already carries three, and the line's quantity is printed in full on the
 * page this row opens.
 *
 * ═══ AND IT IS THE FIRST THREE LINES, NOT THE FIRST THREE THAT HAVE PHOTOS ═══
 * Promoting resolvable lines up the rail would show more pictures per row. It
 * would also mean the squares are no longer this order's first three items, on
 * a page whose recurring defect is claiming what it does not know. The rail
 * shows the order as the order is.
 *
 * ═══ THE SQUARES ARE DECORATIVE, FOR A DIFFERENT REASON THAN THE CART'S ═══
 * `cart-drawer.tsx` passes `alt=""` because the product, the colour and the
 * size are printed inches away. That reasoning does NOT hold here — this row
 * names no product at all — so it is worth stating the one that does.
 *
 * The whole row is ONE link, and a link's accessible name is its entire
 * subtree. Naming three thumbnails turns "Order 2026-000007-F, 18 Aug 2026 ·
 * 5 items · Shipped, ₦118,000" into that same sentence with "PLA Filament, PLA
 * Filament, PLA Filament" wedged through the middle of it — three times over on
 * an order of one product, twenty times down the page. WCAG 2.4.4 asks what
 * this link is FOR, and it is for opening one order, not for inventorying it;
 * the item count is already in the name and the detail page names every line.
 * So: decorative, which is `LineThumb`'s default, and — deliberately — there is
 * no prop through which this file could supply a name instead.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** The square's edge in px. Drives the rail, the row's height and the
 *  skeleton's thumbnail, so those three cannot drift apart. */
const THUMB_PX = 40;

/** How many squares a row draws before the rest of the order becomes a count. */
const MAX_THUMBS = 3;

/** The rail's own gap. `gap-1.5`, written as a number because `RAIL_PX` is
 *  arithmetic over it and Tailwind cannot be asked what it compiled to. */
const RAIL_GAP_PX = 6;

/** Room for the "+N". Measured in the row's own type: "+999" is 26.4px at
 *  `font-mono text-xs`, so 28 holds every count an order can plausibly reach.
 *  A wider one would spill into the 16px column gap rather than widen the
 *  rail — the rail's width is set, not grown, which is the entire point. */
const COUNT_PX = 28;

/**
 * THE NUMBER THAT MAKES THE LIST LINE UP: 3 x 40 + 3 x 6 + 28 = 166px.
 *
 * Three squares, the two gaps between them, one more gap, and the count's
 * room. Derived rather than typed so `MAX_THUMBS` cannot be changed without
 * the slot following it.
 */
const RAIL_PX = MAX_THUMBS * THUMB_PX + MAX_THUMBS * RAIL_GAP_PX + COUNT_PX;

/**
 * The row's box, in one string, because three things have to agree about it:
 * the row, the initial skeleton and the pending rows during `loadMore`.
 *
 * A GRID RATHER THAN THE FLEX ROW IT WAS, because the rail has to sit in a
 * different place at each of two widths and this is the only way to do that
 * without a second copy of the rail in the markup. Placement is explicit from
 * `sm` up (`col-start-1/2/3`, all on `row-start-1`); below `sm` auto-placement
 * does it, which is why the rail is LAST in the source — text, total, then a
 * `col-span-2` rail that finds no room on the first row and drops to its own.
 *
 * ═══ THE FIRST TRACK IS `auto`, AND IT IS STILL A FIXED COLUMN ═══
 * `auto` here is sized by ONE item whose width is set in px (`RAIL_STYLE`), so
 * the track is `RAIL_PX` on every row of every state — a track written as
 * `[166px_…]` would be the same column with the number typed twice, and this
 * file's whole defence against reflow is that there is one source for each
 * number. An `auto` track cannot shrink below its item's min-content either, so
 * the column does not collapse when the text column is squeezed; `minmax(0,1fr)`
 * on the text is what gives way instead. Do not put the rail's width back into
 * the class string, and do not remove it from `RAIL_STYLE`.
 */
const ROW_BOX =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 border border-brand-line px-4 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto]";

/** The rail's own box, shared by the row and the skeleton for the same reason
 *  `ROW_BOX` is. `gap-1.5` is `RAIL_GAP_PX`; the two have to agree. */
const RAIL_BOX =
  "col-span-2 flex items-center gap-1.5 sm:col-span-1 sm:col-start-1 sm:row-start-1";

/**
 * The rail's box, stated rather than inherited from its contents — BOTH edges.
 *
 * WIDTH is what makes the list line up and what stops the wait sliding the row
 * sideways when it resolves; see the block above for the two defects a
 * content-sized rail produced. HEIGHT is for the order with no lines at all:
 * the API cannot produce one, but if it ever did, a rail sized by its children
 * would collapse and that row alone would be 52px shorter than the skeleton
 * that was just holding its place. Two numbers are cheaper than trusting that.
 */
const RAIL_STYLE = { width: RAIL_PX, height: THUMB_PX } as const;

/**
 * How many ITEMS an order is — units, not lines.
 *
 * ═══ THE ROW SAID "1 ITEM" AND THE PAGE IT OPENED SAID "2 ITEMS" ═══
 * This row printed `lines.length`. Order 2025-000042-F is ONE line of qty 2, so
 * the list read "1 item" while the order it linked to read "2 items" with the
 * line under it reading "2 × ₦23,000". `order-detail.tsx` carried this exact
 * bug once and fixed it to units — "like the cart badge and like the reorder
 * message" — which left the list as the surface still counting rows.
 *
 * THE FORMULA IS `order-detail.tsx`'s, deliberately identical, and the two are
 * separate only because nothing exports a shared one yet. A third surface
 * needing it is the moment to lift it into `orders-api.ts` beside the type it
 * reads, not to write it a third time.
 */
export function itemCount(lines: OrderLine[]): number {
  return lines.reduce((sum, l) => sum + l.qty, 0);
}

/**
 * Which lines get a square, and how many items are left over.
 *
 * The invariant, and the reason the "+N" beside the rail can be trusted:
 * `itemCount(shown) + hidden === itemCount(lines)`, always — the right-hand
 * side being the number the row prints as "N items". `hidden` is a count of
 * ITEMS with no square on the rail; it says nothing about whether a picture
 * exists for any of them, and it never reads the image index at all.
 *
 * A LINE CAN BE SEVERAL ITEMS, so `shown.length` is not `itemCount(shown)` —
 * the header's "what a square means" section is the honest reading of that.
 * Because a line is only dropped when there are more than `MAX_THUMBS` of
 * them, `hidden > 0` if and only if the rail is full, which is why the count's
 * room is reserved unconditionally.
 */
export function orderRowPictures(
  lines: OrderLine[],
  max: number = MAX_THUMBS,
): { shown: OrderLine[]; hidden: number } {
  const shown = lines.slice(0, Math.max(0, max));
  return { shown, hidden: itemCount(lines) - itemCount(shown) };
}

/** The rail itself. See the block above for every decision in it. */
function OrderRowPictures({
  lines,
  lineImages,
}: {
  lines: OrderLine[];
  lineImages: LineImageIndex;
}) {
  const { shown, hidden } = orderRowPictures(lines);
  return (
    <div className={RAIL_BOX} style={RAIL_STYLE}>
      {shown.map((line) => (
        /* `decorative` LEFT AT ITS DEFAULT, WHICH IS TRUE — and no `alt` of
           this file's own, which `LineThumb` does not offer and must not. */
        <LineThumb key={line.id} line={line} images={lineImages} size={THUMB_PX} />
      ))}
      {hidden > 0 && (
        /* `aria-hidden`, so the link's name stays the order rather than gaining
           a bare "+2" whose noun a screen reader would have to guess. The count
           it stands for is already in that name, as "N items".

           NO PADDING OF ITS OWN: the flex `gap-1.5` is the spacing, and it is
           the same `RAIL_GAP_PX` that `RAIL_PX` is computed from. A stray
           `pl-0.5` here would put the count 2px past the room reserved for it. */
        <span
          aria-hidden="true"
          className="font-mono text-xs tabular-nums text-muted-foreground"
        >
          +{hidden}
        </span>
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
 *
 * Exported for the same reason `OrdersList` is: `/account/orders` cannot be
 * opened in a dev browser at all, so this state is unreachable without a
 * fixture rendering it. `/dev/orders` does, directly above the resolved list,
 * because the defect this component can grow is a SIDEWAYS one and the only
 * way to see it is to hold the two lists against each other.
 */
export function OrdersListSkeleton() {
  return (
    <AccountShell width="wide">
      {/* THE HEADING IS DRAWN, NOT PLACEHELD. "Your orders" is a constant this
          component is already holding; a grey bar that resolves into identical
          text is a flicker with no purpose. */}
      <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        Your orders
      </h1>
      <SkeletonRegion label="Loading your orders">
        {/* ═══ THE TAB ROW IS RESERVED, AND IT WAS NOT ═══
            The resolved list draws tabs between the heading and the rows, so
            omitting them here dropped every order 66px the moment the first
            page landed — the largest shift in the account area, on the screen a
            signed-in shopper opens most. Measured: first row at 132px from the
            shell's top against 198px resolved.
            IT IS RESERVED EVEN THOUGH AN EMPTY ACCOUNT DRAWS NO TABS. The
            placeholder cannot know which it is about to be, and the two
            outcomes are not symmetrical: an account WITH orders is the common
            case and settles perfectly, while an empty one resolves into a
            bordered empty-state panel that shares no geometry with this list
            anyway. Reserving for the common case is the only choice that is
            ever exactly right. */}
        <TabRowSkeleton className="mt-8" />
        <ul className="mt-6 flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <li key={i}>
              <OrderRowSkeleton />
            </li>
          ))}
        </ul>
      </SkeletonRegion>
    </AccountShell>
  );
}

/**
 * One row of the wait — and the ONLY row of the wait, drawn by both the initial
 * skeleton above and the two pending rows the list appends during `loadMore`.
 *
 * They were separate copies of the same markup, which is how a skeleton drifts:
 * a row gains a thumbnail rail, one of the two copies is updated, and the
 * SECOND page of a customer's history is the only place the reflow shows up —
 * on a screen nobody re-checks after the first page looks right. One component,
 * one `ROW_BOX`, one `RAIL_STYLE`, one `THUMB_PX`, so the three boxes cannot
 * disagree on either axis.
 *
 * `h-10` IS NOT A GUESS AT THE TEXT'S HEIGHT — it IS the text's height: the
 * row's two lines are `text-sm`/`leading-5` (20px) + `mt-1` (4px) +
 * `text-xs`/`leading-4` (16px). The bars inside are centred in it rather than
 * summing to it, so their own heights stay free to look right without the row's
 * box depending on them.
 *
 * ONE THUMBNAIL, NOT THREE, AND THAT IS ONLY SAFE BECAUSE THE RAIL IS
 * RESERVED. The wait cannot know how many lines are coming, so its square
 * count and a row's are free to differ — what must not differ is the BOX. The
 * first cut of this component leaned on the rail's fixed HEIGHT alone and let
 * its width follow its contents, so the row was 74px in both states while the
 * first column went 40px → 158px on resolve and slid the order number 118px
 * sideways. `RAIL_STYLE` now sets both edges, so one square here and three
 * there land in exactly the same 166 x 40 slot, in a row that is the same 74px
 * (≥sm) / 126px (<sm) box it was holding.
 */
function OrderRowSkeleton() {
  return (
    <div className={ROW_BOX}>
      <div className="flex h-10 min-w-0 flex-col justify-center gap-2 sm:col-start-2 sm:row-start-1">
        {/* `max-w-full`: at 320px the text column is 176px, and a bar with a
            fixed `w-48` (192px) would otherwise hang over the row's border. */}
        <Skeleton className="h-4 w-36 max-w-full" />
        <Skeleton className="h-3 w-48 max-w-full" />
      </div>
      <Skeleton className="h-4 w-20 shrink-0 sm:col-start-3 sm:row-start-1" />
      <div className={RAIL_BOX} style={RAIL_STYLE}>
        <LineThumbSkeleton size={THUMB_PX} />
      </div>
    </div>
  );
}

