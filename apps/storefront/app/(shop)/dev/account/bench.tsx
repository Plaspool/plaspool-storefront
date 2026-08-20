"use client";

import * as React from "react";
import {
  AccountHomeSkeleton,
  AccountHomeView,
  OrdersList,
  OrdersListSkeleton,
  RewardsView,
  RewardsSkeleton,
  StatusTimeline,
  StatusTimelineSkeleton,
  headlineFor,
  outcomeOf,
} from "@plaspool/shop";
import type { LineImageIndex } from "@plaspool/shop";

import { BENCH, BENCH_LIST } from "../orders/fixtures";
import {
  BALANCE,
  BALANCE_NO_REDEMPTION,
  BALANCE_UNLABELLED,
  BALANCE_ZERO,
  CUSTOMER,
  CUSTOMER_NO_NAME,
  LEDGER,
  LEDGER_CREDITS_ONLY,
} from "./fixtures";

/**
 * The account area, every state at once, with no session behind it.
 *
 * EACH CASE IS LABELLED WITH WHY IT IS HERE, not just what it is — a bench
 * whose cases are unexplained gets pruned by the next person who reads it. The
 * order fixtures come from `/dev/orders`, which already curates them; only the
 * account-shaped data is new.
 */
export function AccountBench({ lineImages }: { lineImages: LineImageIndex }) {
  const noop = React.useCallback(() => {}, []);

  return (
    <div className="bg-background">
      <div className="mx-auto max-w-3xl px-4 pt-10 sm:px-6">
        <p className="border border-dashed border-brand-line px-4 py-3 font-mono text-xs text-muted-foreground">
          <strong className="font-semibold text-foreground">/dev/account</strong> — development
          bench. Synthetic customer, synthetic ledger, real catalogue variant ids. Not reachable in
          a production build. Order fixtures are shared with{" "}
          <strong className="font-semibold text-foreground">/dev/orders</strong>.
        </p>
      </div>

      {/* ═══════════════════════════════════════════════ THE STATUS HISTORY ═══
          The animation runs ON MOUNT, so it is seen once per page load. Reload
          to watch it again; toggle the OS "reduce motion" setting and reload to
          check that nothing moves and the timeline is COMPLETE rather than
          half-drawn — the failure mode a fill-mode mistake produces. */}
      <Case
        label="Status history — the wait"
        note="`StatusTimelineSkeleton`. Hold a rule down the marker centres here and in every case below: the marker column is `w-8` and the row is `h-8` in both."
      >
        <Panel>
          <StatusTimelineSkeleton />
        </Panel>
      </Case>

      {BENCH.map(({ label, note, order, events }) => (
        <Case
          key={`status-${order.orderNumber}`}
          label={`Status history — ${label}`}
          note={note}
        >
          <Panel>
            <p className="mb-6 font-sans text-lg font-semibold tracking-tight text-foreground">
              {headlineFor(order, events)}
            </p>
            <StatusTimeline
              order={order}
              events={events}
              refundAmount={order.refundedTotal > 0 ? "₦26,000" : undefined}
            />
          </Panel>
        </Case>
      ))}

      <Case
        label="Status history — no events at all"
        note="The `/events` call failed, which `order-detail.tsx` degrades to `[]` by design. The stops must still draw from the order's own `placedAt`/`paidAt`/`fulfilledAt`, with no messages under them and no empty section where they would have been."
      >
        <Panel>
          <StatusTimeline order={BENCH[2]!.order} events={[]} />
        </Panel>
      </Case>

      {/* ═══════════════════════════════════════════════════ THE ORDER LIST ═══ */}
      <Case
        label="Orders — the wait"
        note="`OrdersListSkeleton`, the state `/account/orders` opens in. Hold a rule down the left edge of the order numbers, and down the rail, between this case and the next — AND check the vertical: the first row must not move when the data lands."
      >
        <OrdersListSkeleton />
      </Case>

      <Case
        label="Orders — ongoing & delivered"
        note="The default tab. Every row here must be an order `outcomeOf` calls live; a cancelled or refunded one appearing in this list is the split disagreeing with the detail page."
      >
        <OrdersList
          items={BENCH_LIST}
          cursor={null}
          loading={false}
          failed={false}
          onLoadMore={noop}
          show="ongoing"
          lineImages={lineImages}
        />
      </Case>

      <Case
        label="Orders — cancelled & refunded"
        note="The other half of the SAME list. Switching tabs must not change the row's own height, its rail, or the left edge of the order numbers."
      >
        <OrdersList
          items={BENCH_LIST}
          cursor={null}
          loading={false}
          failed={false}
          onLoadMore={noop}
          show="stopped"
          lineImages={lineImages}
        />
      </Case>

      <Case
        label="Orders — a tab with nothing in it, and more still to load"
        note="The honesty case. A cursor remains, so the copy may not claim the half is empty — only that nothing has turned up so far. The other tab's count is of what is LOADED and is offered as a place to look, never as a total."
      >
        <OrdersList
          /* EVERY STOPPED ORDER REMOVED, not just the cancelled one. Filtering
             on `status !== "cancelled"` left the refunded order behind, so the
             stopped half was never actually empty and `TabEmpty` — the whole
             point of this case — never rendered. `outcomeOf` is what the list
             splits on, so it is what the fixture has to filter by. */
          items={BENCH_LIST.filter((i) => !outcomeOf(i.order, []).over)}
          cursor="cur_more"
          loading={false}
          failed={false}
          onLoadMore={noop}
          show="stopped"
          lineImages={lineImages}
        />
      </Case>

      <Case
        label="Orders — no orders at all"
        note="No tabs over an empty account: two headings offering to filter nothing can only disappoint. This is also the ONE screen in the account area carrying the neobrutalist control, because it is the one state with a single useful next move."
      >
        <OrdersList
          items={[]}
          cursor={null}
          loading={false}
          failed={false}
          onLoadMore={noop}
          show="ongoing"
          lineImages={lineImages}
        />
      </Case>

      {/* ═══════════════════════════════════════════════════════ THE ACCOUNT ═══ */}
      <Case
        label="Account hub — the wait"
        note="`AccountHomeSkeleton`. Four rows because a programme exists; three when it does not, which the route knows before the customer resolves. Compare row heights with the case below."
      >
        <AccountHomeSkeleton programName="Spool Points" />
      </Case>

      <Case
        label="Account hub"
        note="The front door. A row is a destination plus the reason to go — if any row reads as a bare link, it has stopped earning its place over the header menu."
      >
        <AccountHomeView
          programName="Spool Points"
          customer={CUSTOMER}
          balance={BALANCE}
          signingOut={false}
          onSignOut={noop}
        />
      </Case>

      <Case
        label="Account hub — no name, no balance, no programme"
        note="Three independent absences at once. The greeting falls back to a plain title, the balance line is ABSENT rather than zero, and the rewards row is gone because there is nothing behind it. The rows must not reflow into an awkward stack."
      >
        <AccountHomeView
          programName={null}
          customer={CUSTOMER_NO_NAME}
          balance={BALANCE_ZERO}
          signingOut={false}
          onSignOut={noop}
        />
      </Case>

      {/* ══════════════════════════════════════════════════════ THE REWARDS ═══ */}
      <Case
        label="Rewards — the wait"
        note="`RewardsSkeleton`. The title is DRAWN, not placeheld: the route already handed it in. Hold a rule down the left edge of the rows here and in the next case."
      >
        <RewardsSkeleton title="Spool Points" />
      </Case>

      <Case
        label="Rewards — everything"
        note="A spend, a release, two manual adjustments and three awards. The sign is a CHARACTER, not a colour — check this case in greyscale; if you cannot tell a credit from a debit, the treatment has regressed."
      >
        <RewardsView
          programName="Spool Points"
          balance={BALANCE}
          entries={LEDGER}
          cursor={null}
          loading={false}
          failed={false}
          onLoadMore={noop}
          filter="all"
        />
      </Case>

      <Case
        label="Rewards — spent only"
        note="The rows the request actually asked for: every discount this shopper has used, with the order it went against. `redemption_release` must NOT be here — it is filed under the API's `redemptions` bucket and is a credit."
      >
        <RewardsView
          programName="Spool Points"
          balance={BALANCE}
          entries={LEDGER}
          cursor={null}
          loading={false}
          failed={false}
          onLoadMore={noop}
          filter="spent"
        />
      </Case>

      <Case
        label="Rewards — a filter with nothing under it"
        note="Credits only, filtered to spent, with a cursor still open. Same honesty rule as the orders tabs: it may not claim there are none, only that none are loaded."
      >
        <RewardsView
          programName="Spool Points"
          balance={BALANCE}
          entries={LEDGER_CREDITS_ONLY}
          cursor="cur_more"
          loading={false}
          failed={false}
          onLoadMore={noop}
          filter="spent"
        />
      </Case>

      <Case
        label="Rewards — a wallet with no history"
        note="Zero is SHOWN here, unlike on the hub: a shopper who opened this page deliberately asked the question, and hiding the answer would leave the page looking broken."
      >
        <RewardsView
          programName="Spool Points"
          balance={BALANCE_ZERO}
          entries={[]}
          cursor={null}
          loading={false}
          failed={false}
          onLoadMore={noop}
          filter="all"
        />
      </Case>

      <Case
        label="Rewards — the programme has no labels"
        note="THE NO-NOUN RULE, ON A BENCH. `pointsLabel` answers null, so the balance panel must render NOTHING — a bare number with no noun is unreadable. A number appearing in this case means a surface has started spelling its own."
      >
        <RewardsView
          programName="Spool Points"
          balance={BALANCE_UNLABELLED}
          entries={LEDGER}
          cursor={null}
          loading={false}
          failed={false}
          onLoadMore={noop}
          filter="all"
        />
      </Case>

      <Case
        label="Rewards — spending switched off"
        note="The balance is real; the invitation to spend it is not. `redemptionEnabled: false` must drop the line about checkout and nothing else."
      >
        <RewardsView
          programName="Spool Points"
          balance={BALANCE_NO_REDEMPTION}
          entries={LEDGER.slice(0, 3)}
          cursor={null}
          loading={false}
          failed={false}
          onLoadMore={noop}
          filter="all"
        />
      </Case>

      {/* ═════════════════════════════════════════════════ THE INSTALL BANNER ═══ */}
      <Case
        label="Install banner"
        note="NOT RENDERED HERE, and that is the point. It waits for `beforeinstallprompt`, which is the browser saying an install is possible; there is no prop or flag that forces it, because a forced one is how a UA-sniffing version gets written later. To see it: Chrome DevTools → Application → Manifest, or clear `localStorage['plaspool:install-dismissed']` and reload on a page that qualifies. It renders above the announcement bar, at the top of every shop route."
      >
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          <p className="font-sans text-sm text-muted-foreground">
            Scroll to the top of this page. If your browser considers this app installable, the bar
            is there — this bench sits inside the same shell every shop route does.
          </p>
        </div>
      </Case>
    </div>
  );
}

/** A surface that is normally inside a page, given the page's own gutters. */
function Panel({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">{children}</div>;
}

function Case({
  label,
  note,
  children,
}: {
  label: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t-4 border-dashed border-brand-line">
      <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-6">
        <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-brand">
          {label}
        </h2>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{note}</p>
      </div>
      {children}
    </section>
  );
}
