"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Gift } from "lucide-react";
import { Button, NEO_SURFACE, Skeleton, SkeletonRegion, TextSkeleton, cn } from "@plaspool/ui";

import { EmptyState } from "../components/empty-state";
import { TabRow, TabRowSkeleton } from "./tab-row";
import { readShopSession } from "../data/auth-api";
import { getPointsBalance, getPointsLedger, pointsLabel } from "../data/points-api";
import type { LedgerEntry, PointsBalance } from "../data/points-api";
import { formatStamp } from "./stamp";
import { AccountShell } from "./account-shell";

/**
 * `/account/rewards` — the balance, and everything that has ever moved it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THIS IS THE "VOUCHERS AND DISCOUNTS" PAGE, AND THE NAME CHANGE IS THE WHOLE
 * DESIGN DECISION. IT IS RECORDED HERE SO NOBODY RE-OPENS IT BY ACCIDENT.
 *
 * The request was a page listing a shopper's vouchers and the history of them
 * being used. **There is no per-customer voucher in this system.**
 * `server/marketing/discounts/repo.ts` in the admin holds operator-created
 * GLOBAL codes — `code`, `percentBps`/`amountMinor`, `maxRedemptions`,
 * `redeemedCount` — with no customer column and no customer-facing route, and
 * an `OrderLine` carries no discount field either. A screen listing "your
 * vouchers" could only have invented every row on it, which is the exact
 * failure this package's ledger has recorded four times running.
 *
 * WHAT IS REAL, AND PER CUSTOMER, IS THE LEDGER. `GET /me/points/ledger`
 * answers this shopper's own credits and spends, and a `redemption` row IS a
 * discount that was used: the admin writes it as "Order <id>: <n> <points>
 * spent" at the moment the money comes off. So the history the request asked
 * for exists — it is just called something else, and it is honest.
 *
 * If a per-customer voucher endpoint ever lands, this is the page it goes on.
 *
 * ═══ NO POINTS OR UNIT NOUN IS SPELLED IN THIS FILE ═══
 * The rule `data/marketing.ts` sets out at length: an operator can rename the
 * programme, the admin enforces on its own side that no screen spells the words
 * itself, and a storefront that hardcoded them would be the one surface still
 * using the old name after a rename. Every noun on this page arrives with the
 * data — the balance's labels from `/me/points`, and each row's wording frozen
 * into `LedgerEntry.reason` when it was written. The page's own title comes
 * from `program.name` on the public rewards endpoint, handed in by the route.
 *
 * ═══ THE FILTER IS OVER WHAT IS LOADED, AND IT SAYS SO ═══
 * The API does offer `?kind=`, and it is deliberately not used. Its buckets are
 * the LEDGER's (`return_award`, `manual`, `redemption`, `redemption_release`),
 * not a shopper's: a manual credit falls outside both "awards" and
 * "redemptions", and `redemption_release` — points handed BACK when an order is
 * cancelled — is filed under redemptions while being a credit. Filtering by the
 * sign of `delta` is what somebody means by "earned" and "spent", covers every
 * kind including ones this file has never heard of, and — the part that decided
 * it — makes switching views free, because it is the same fetched stream. The
 * cost is that a filter can only speak for the pages actually loaded, and
 * `FilterEmpty` below never claims otherwise. Same trade, same wording, as the
 * orders list's two tabs.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const FILTER_PARAM = "show";

type Filter = "all" | "earned" | "spent";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Everything" },
  { key: "earned", label: "Earned" },
  { key: "spent", label: "Spent" },
];

function readFilter(value: string | null): Filter {
  return value === "earned" || value === "spent" ? value : "all";
}

function filterHref(filter: Filter): string {
  return filter === "all" ? "/account/rewards" : `/account/rewards?${FILTER_PARAM}=${filter}`;
}

/** A credit is anything that did not take points away.
 *
 *  `>= 0` RATHER THAN `> 0` AS A BELT-AND-BRACES, not because zero is expected:
 *  the schema forbids it outright (`marketing_ledger_delta_ck CHECK (delta <>
 *  0)`), and an earlier version of this comment claimed the opposite without
 *  checking. The boundary is written this way so that a row which somehow
 *  carried zero lands in a bucket instead of vanishing from both. */
function isCredit(entry: LedgerEntry): boolean {
  return entry.delta >= 0;
}

export function RewardsPage({ programName }: { programName: string | null }) {
  const router = useRouter();
  const filter = readFilter(useSearchParams().get(FILTER_PARAM));

  const [state, setState] = React.useState<"checking" | "guest" | "ready">("checking");
  const [balance, setBalance] = React.useState<PointsBalance | null>(null);
  const [entries, setEntries] = React.useState<LedgerEntry[]>([]);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [firstPage, setFirstPage] = React.useState<"loading" | "done">("loading");
  const [loading, setLoading] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void readShopSession().then((session) => {
      if (cancelled) return;
      /* AN UNREACHABLE API IS NOT A SIGNED-OUT SHOPPER — the rule `orders-list`
         and `settings-page` both follow. Being bounced to a login screen by a
         timeout is the lie the header was fixed to stop telling. Here the
         degraded state is simply an empty page rather than an error panel,
         because every read below already answers null for every failure and
         this screen is entirely optional to the shop. */
      if (session.kind === "guest") {
        setState("guest");
        router.replace(`/sign-in?next=${encodeURIComponent("/account/rewards")}`);
        return;
      }
      setState("ready");
      void Promise.all([getPointsBalance(), getPointsLedger()]).then(([b, page]) => {
        if (cancelled) return;
        setBalance(b);
        setEntries(page?.items ?? []);
        setCursor(page?.nextCursor ?? null);
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
    const page = await getPointsLedger(cursor);
    if (!page) {
      setFailed(true);
      setLoading(false);
      return;
    }
    setEntries((prev) => [...prev, ...page.items]);
    setCursor(page.nextCursor);
    setLoading(false);
  }

  if (state !== "ready" || firstPage === "loading") {
    return <RewardsSkeleton title={programName} />;
  }

  return (
    <RewardsView
      programName={programName}
      balance={balance}
      entries={entries}
      cursor={cursor}
      loading={loading}
      failed={failed}
      onLoadMore={loadMore}
      filter={filter}
    />
  );
}

/**
 * The page itself, given its data.
 *
 * EXPORTED AND PROP-DRIVEN for the same reason `OrdersList` and `OrderDetail`
 * are: every state worth looking at here — a balance with history, an empty
 * filter, a spend with a long reason — is unreachable in a dev environment,
 * because `/me/points` is credentialed and localhost is not in the commerce
 * API's `APP_ORIGINS`. `/dev/account` renders this directly.
 */
export function RewardsView({
  programName,
  balance,
  entries,
  cursor,
  loading,
  failed,
  onLoadMore,
  filter = "all",
}: {
  programName: string | null;
  balance: PointsBalance | null;
  entries: LedgerEntry[];
  cursor: string | null;
  loading: boolean;
  failed: boolean;
  onLoadMore: () => void;
  /** Which movements are on screen. A prop rather than internal state so the
   *  URL owns it, and so the bench can render all three at once. */
  filter?: Filter;
}) {
  const shown =
    filter === "all" ? entries : entries.filter((e) => (filter === "earned" ? isCredit(e) : !isCredit(e)));
  const otherCount = entries.length - shown.length;

  return (
    <Shell>
      <RewardsHeading title={programName} />

      <RewardsBalance balance={balance} />

      {entries.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<Gift aria-hidden="true" />}
            title="Nothing here yet"
            /* NO NOUN, NO NUMBER, NO PROMISE OF A RATE. What earns a credit is
               the programme's configuration and the shop already explains it in
               one place — the returns page, driven by the same settings. A
               second explanation here would be the one that goes stale. */
            body="When you earn something, and when you spend it at checkout, both show up here."
            action={
              /* The one raised control on this screen, and only in this state —
                 same reasoning as the orders list's empty state. A page with
                 history on it has filters and a pager, and neither is a call to
                 action. */
              <Button asChild className={cn(NEO_SURFACE, "h-11 px-5")}>
                <Link href="/store">Go to the store</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <RewardsFilters filter={filter} className="mt-8" />

          {shown.length === 0 ? (
            <FilterEmpty filter={filter} otherCount={otherCount} more={cursor !== null} />
          ) : (
            <ul className="mt-2 divide-y divide-brand-line border-b border-brand-line">
              {shown.map((entry) => (
                <LedgerRow
                  key={entry.id}
                  entry={entry}
                  balance={balance}
                  runningBalance={filter === "all"}
                />
              ))}
              {loading &&
                Array.from({ length: 2 }, (_, i) => (
                  <li key={`pending-${i}`} aria-hidden="true">
                    <LedgerRowSkeleton />
                  </li>
                ))}
            </ul>
          )}

          {cursor && (
            <div className="mt-6 flex flex-col items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onLoadMore}
                disabled={loading}
                aria-busy={loading}
              >
                Load more
              </Button>
              {failed && (
                /* `destructive-strong` — see `globals.css`; the base token is
                   a fill and measures 3.76:1 as text. */
                <p role="alert" className="font-sans text-sm text-destructive-strong">
                  Could not load more. Try again.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </Shell>
  );
}

/**
 * The title.
 *
 * `program.name` WHEN THE SHOP HAS ONE, because that is the operator's word for
 * this and the whole page is about it. "Rewards" is the fallback and it is the
 * API's own vocabulary — the endpoint is `/api/public/marketing/rewards` — not
 * a programme noun invented here. A page still needs a name when the marketing
 * service is having a bad day.
 */
function RewardsHeading({ title }: { title: string | null }) {
  return (
    <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
      {title ?? "Rewards"}
    </h1>
  );
}

/**
 * The balance, and what it is worth knowing about it.
 *
 * ═══ IT RENDERS A ZERO HERE, WHICH IS THE OPPOSITE OF THE HUB'S
 * `BalanceLine` ═══
 * That component sits on the orders list and hides itself at zero, because a
 * "0" beside a programme name reads as a broken feature to somebody who came
 * for their orders and has never heard of the programme. This page IS the
 * programme: a shopper arrived here deliberately, and "you have none yet" is
 * the answer to the question they asked. Hiding it would leave the page
 * looking broken instead.
 *
 * A BALANCE THAT COULD NOT BE READ AT ALL still renders nothing, because null
 * means the request failed and zero would be a claim about their account.
 */
function RewardsBalance({ balance }: { balance: PointsBalance | null }) {
  if (!balance) return null;
  const label = pointsLabel(balance, balance.points);
  /* A bare number with no noun is unreadable rather than partially useful —
     `pointsLabel` answers null when the programme's configuration is absent,
     and null is rendered as nothing at all. */
  if (!label) return null;

  const lifetimeLabel = pointsLabel(balance, balance.lifetimeEarned);

  return (
    <div className="mt-6 border border-brand-line bg-brand-soft/50 px-4 py-4 sm:px-6 sm:py-5">
      <p className="font-sans text-xs uppercase tracking-wider text-muted-foreground">
        Balance
      </p>
      {/* ═══ THE NOUN GOES UNDER THE NUMBER, NOT BESIDE IT ═══
          They were one line — "1,240 Spool Points" at `text-3xl` — and at 320px
          that wrapped, making this panel 151px against the 131px its
          placeholder reserved. The label is the OPERATOR'S word and can be any
          length, so no bound on it is enforceable here.
          Stacked, the panel is two known line boxes at every width and for
          every programme name, and the placeholder is exact by construction.
          It also reads better: the figure is the thing, and the noun is what
          the figure is in. */}
      <p className="mt-1 font-mono text-3xl font-semibold leading-none tabular-nums text-foreground">
        {balance.points.toLocaleString()}
      </p>
      <p className="mt-1 truncate font-sans text-sm font-medium text-foreground">{label}</p>

      {/* ═══ STACKED, NOT WRAPPED ═══
          `flex-wrap` put these two facts side by side on a wide screen and on
          their own lines on a phone, so the panel was two heights and no
          placeholder could match both — measured 169px at 320px against 149px
          at 1280px. One fact per line at every width makes the panel's height a
          function of HOW MANY FACTS there are rather than of the viewport, and
          that is a thing the skeleton can be right about. They are two
          unrelated sentences; side by side they read as one run-on anyway. */}
      <div className="mt-3 flex flex-col gap-1 border-t border-brand-line pt-3 font-sans text-xs text-muted-foreground">
        {balance.lifetimeEarned > 0 && lifetimeLabel && (
          <span>
            {balance.lifetimeEarned.toLocaleString()} {lifetimeLabel} earned in total
          </span>
        )}
        {/* ONLY WHEN SPENDING IS ACTUALLY OFFERED. `redemptionEnabled` is not
            the whole answer — the API also requires the programme's currency to
            match the cart's, and only the freeze can check that — but promising
            a discount checkout would then decline is worse than promising
            nothing, so the weaker half of the test still gates the copy. */}
        {balance.redemptionEnabled && <span>Spend these at checkout for a discount.</span>}
      </div>
    </div>
  );
}

/**
 * One movement: what it was, when, and — on the complete feed only — what it
 * left behind.
 *
 * ═══ THE RUNNING BALANCE IS DROPPED THE MOMENT A FILTER IS ON ═══
 * `balanceAfter` is the wallet's balance after THAT row, which is a running
 * total only while every row between them is on screen. Under "Spent" it read
 * 1,240 → 1,140 → 1,290 beside three negative deltas: consecutive rows that do
 * not explain the change between them, and a top row asserting "1,740 left"
 * forty pixels under a headline saying the balance is 1,240.
 * A number that is individually true and collectively nonsense is worse than no
 * number, so the filtered views show the movement and nothing else. This is
 * what a bank statement does for the same reason.
 */
function LedgerRow({
  entry,
  balance,
  runningBalance,
}: {
  entry: LedgerEntry;
  balance: PointsBalance | null;
  /** True only on the unfiltered feed — see above. */
  runningBalance: boolean;
}) {
  const credit = isCredit(entry);
  const magnitude = Math.abs(entry.delta);
  const afterLabel = runningBalance ? pointsLabel(balance, entry.balanceAfter) : null;

  return (
    <li className="flex items-start justify-between gap-3 py-3.5">
      <div className="min-w-0">
        {/* THE SHOP'S OWN WORDING, VERBATIM. `reason` is frozen at write time —
            "Order ord_x: 500 <points> spent" — so it already carries the
            programme's nouns as they stood, and re-phrasing it here would be
            this file spelling them. It is also the only place an order is
            named, which is what makes a spend traceable. */}
        <p className="font-sans text-sm text-foreground">{entry.reason}</p>
        <p className="mt-0.5 font-sans text-xs text-muted-foreground">
          {formatStamp(entry.createdAt)}
          {afterLabel && (
            <>
              {" · "}
              {entry.balanceAfter.toLocaleString()} {afterLabel} left
            </>
          )}
        </p>
      </div>

      {/* ═══ THE SIGN IS A CHARACTER, NOT A COLOUR ═══
          A green "+120" against a red "−500" is the obvious treatment and it
          fails twice over: the pair is indistinguishable in greyscale and to
          the commonest form of colour blindness, and this shop has no green in
          its ramp to spend on it. The explicit ± reads everywhere, and the
          weight difference does the rest. `aria-label` because "−" is read as
          "minus" by some screen readers and skipped entirely by others. */}
      <span
        className={cn(
          "shrink-0 font-mono text-sm tabular-nums",
          credit ? "font-semibold text-foreground" : "text-muted-foreground",
        )}
      >
        {/* ═══ A VISUALLY HIDDEN TWIN, NOT AN `aria-label` ═══
            This was `aria-label` on the `<span>` itself. ARIA 1.2 PROHIBITS
            `aria-label` on an element with the `generic` role, so its only
            defence was that Chrome happens to honour it anyway — a reader that
            follows the spec would announce the amount with no sign, or drop it
            entirely. An `sr-only` sibling is not a naming exception; it is
            text, and every reader has always agreed about text.
            The sign needs spelling out because "−" is U+2212 MINUS, which some
            readers say as "minus", some as "dash", and some skip. */}
        <span aria-hidden="true">
          {credit ? "+" : "−"}
          {magnitude.toLocaleString()}
        </span>
        <span className="sr-only">
          {credit ? "plus" : "minus"} {magnitude.toLocaleString()}
        </span>
      </span>
    </li>
  );
}

function RewardsFilters({ filter, className }: { filter: Filter; className?: string }) {
  return (
    <TabRow
      label="Which movements"
      current={filter}
      className={className}
      items={FILTERS.map(({ key, label }) => ({ key, label, href: filterHref(key) }))}
    />
  );
}

/** A filter with nothing under it — never claiming more than "in what's
 *  loaded", for the reason the file header gives. */
function FilterEmpty({
  filter,
  otherCount,
  more,
}: {
  filter: Filter;
  otherCount: number;
  more: boolean;
}) {
  const word = filter === "earned" ? "earned" : "spent";
  return (
    <div className="mt-6 border border-dashed border-brand-line px-4 py-8 text-center">
      <p className="font-sans text-sm text-foreground">
        {more
          ? `Nothing ${word} in what’s loaded so far.`
          : filter === "earned"
            ? "Nothing earned yet."
            : "Nothing spent yet."}
      </p>
      {otherCount > 0 && (
        <p className="mt-2 font-sans text-sm text-muted-foreground">
          <Link
            href={filterHref("all")}
            className="rounded-sm font-medium text-brand underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Everything
          </Link>{" "}
          {/* NOT "has N more". There are zero rows on screen, so "more" is more
              than nothing — the sentence counted against a total the shopper
              cannot see. */}
          has {otherCount}.
        </p>
      )}
    </div>
  );
}

/**
 * The wait.
 *
 * The title is DRAWN, not placeheld — the route already handed it in, and a bar
 * standing in for text the page is holding is a flicker with no purpose. The
 * balance panel and six rows are the real geometry, so nothing shifts when the
 * two reads land.
 */
export function RewardsSkeleton({ title }: { title: string | null }) {
  return (
    <Shell>
      <RewardsHeading title={title} />
      <SkeletonRegion label="Loading your balance and history">
        <div className="mt-6 border border-brand-line bg-brand-soft/50 px-4 py-4 sm:px-6 sm:py-5">
          <Skeleton className="h-4 w-20" />
          {/* The two line boxes the resolved panel now has — the figure and
              the noun under it. Each carries its own type rather than a height
              somebody measured. */}
          <TextSkeleton className="mt-1 w-24 max-w-full font-mono text-3xl leading-none" />
          <TextSkeleton className="mt-1 w-32 max-w-full font-sans text-sm" />
          <div className="mt-3 border-t border-brand-line pt-3">
            {/* TWO LINES, because the resolved footer holds two facts in a
                `flex-wrap` and they sit on their own lines at every phone
                width — measured 36px against the 16px a single bar reserved.
                `text-xs`'s own line box, not an `h-3` bar (12px).
                A customer with `lifetimeEarned: 0`, or a programme with
                redemption switched off, has fewer facts and settles upward by
                one line; that is the rarer account, and the shift is 16px on
                the panel a shopper came to this page specifically to read. */}
            <TextSkeleton className="w-56 max-w-full font-sans text-xs" />
            <TextSkeleton className="mt-1 w-44 max-w-full font-sans text-xs" />
          </div>
        </div>

        {/* THE ROW'S OWN BOX, not a hand-rolled `pb-2.5 pt-2.5` plus a fixed
            `h-4` bar — that guess measured 37px against the live row's 42px,
            which is a third copy of the geometry `tab-row.tsx` exists to stop
            there being two of. */}
        <TabRowSkeleton count={3} className="mt-8" />

        <ul className="mt-2 divide-y divide-brand-line border-b border-brand-line">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i}>
              <LedgerRowSkeleton />
            </li>
          ))}
        </ul>
      </SkeletonRegion>
    </Shell>
  );
}

/** One row's placeholder, at the row's own type — used by the first wait AND
 *  by "load more", so the two cannot drift. */
function LedgerRowSkeleton() {
  return (
    <div className="flex items-start justify-between gap-3 py-3.5">
      <div className="min-w-0 flex-1">
        {/* ═══ TWO LINES FOR THE REASON, AND THAT IS A JUDGEMENT ═══
            `LedgerEntry.reason` is admin free text — "Order ord_2026000007F:
            500 Spool Points spent" — so its length is not this file's to bound
            the way the timeline's explanations are. At the widths this shop is
            actually used at it wraps: measured at 320px the row is 86px against
            the 66px a one-line placeholder reserved, and at 375px the reason
            needs ~277px of a ~271px column.
            So the wrap is reserved. The cost is named rather than hidden: on a
            wide desktop a short reason fits on one line and this runs 20px
            generous, which settles content UPWARD — the worse direction — but
            on a pointer rather than a thumb, and on the width where a 20px
            settle is least of anything. Reserving ONE line instead is exact on
            desktop and 20px short on every phone, which is where the shop is. */}
        <TextSkeleton className="w-full font-sans text-sm" />
        <TextSkeleton className="w-3/5 font-sans text-sm" />
        <TextSkeleton className="mt-0.5 w-40 max-w-full font-sans text-xs" />
      </div>
      <TextSkeleton className="w-12 shrink-0 font-mono text-sm" />
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <AccountShell>{children}</AccountShell>;
}
