"use client";

import * as React from "react";
import { Link } from "../components/link";
import { useRouter } from "next/navigation";
import { Recycle } from "lucide-react";
import { Button, NEO_SURFACE, SkeletonRegion, TextSkeleton, cn } from "@plaspool/ui";

import { EmptyState } from "../components/empty-state";
import { readShopSession } from "../data/auth-api";
import { listMyReturns } from "../data/returns-api";
import type { MyReturn } from "../data/returns-api";
import { pointsLabel } from "../data/marketing";
import type { RewardsProgram } from "../data/marketing";
import { formatStamp } from "./stamp";
import { AccountShell } from "./account-shell";

/**
 * `/account/returns` — a shopper's own return requests, and where each has
 * got to.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * `"use client"`, LIKE EVERY OTHER PER-CUSTOMER SCREEN IN THE SHOP.
 * `GET /me/returns` is cookie-identified and answers this shopper's own rows —
 * fetching it from a server component would bake one customer's history into a
 * page the Worker's cache could then serve to the next visitor. Same rule
 * `rewards-page.tsx` and `orders-list.tsx` both follow.
 *
 * ═══ THE STAGE NAMES LIVE IN `stageOf`, A RECORD PLUS A FALLBACK ═══
 * See its own comment. The short version: `status` is a bare string from the
 * API, an unrecognised one is reachable, and the honest answer is still a
 * sentence — never a blank cell on the one page whose job is telling somebody
 * where their spools are.
 *
 * ═══ THE AWARD LINE IS THE ONLY THING HERE BUILT FROM PROGRAMME LABELS ═══
 * `MyReturn` carries `pointsAwarded` as a bare number — the list endpoint does
 * not send the programme's words the way a redemption's `LedgerEntry.reason`
 * does, because a return can be read before it has ever earned anything. So
 * the route fetches the live programme the same way `/returns` already does
 * (`getRewardsProgram()`, on `MARKETING_REVALIDATE`) and hands the WHOLE
 * object in — not just `programName` the way `/account/rewards`'s route does —
 * because a name alone cannot pluralise "50 <the operator's word>". Everything
 * else on this page is either a bare figure (the declared quantity: a number
 * needs no noun to be read in a card that already says what it is) or the
 * shop's own vocabulary ("Requested", "Pickup", "declared" — not a programme's
 * word, the API's own for the feature, same as `NotRunning`'s "Returns"
 * heading on `/returns` itself).
 *
 * ═══ DECLARES NO CONTAINER OF ITS OWN ═══
 * `AccountShell` owns the page box; `house-rules.test.ts` enforces it the same
 * way it does for every other screen in this folder.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * What a status is called to the person who is waiting on it.
 *
 * A RECORD PLUS A FALLBACK, NOT A SWITCH. `status` arrives as a bare string
 * from the API, so an unrecognised one is reachable — a widened enum, an older
 * cached page — and the honest answer to "we do not know this stage" is still
 * a sentence, never an empty cell on the one page whose job is telling
 * somebody where their spools are.
 *
 * NO PROGRAMME NOUN APPEARS HERE. "Collected" and "Inspected" describe what
 * the desk did, not what was collected — the units are named by labels that
 * arrive with the data, not by this file.
 */
const STAGES: Record<string, string> = {
  requested: "Requested",
  scheduled: "Pickup scheduled",
  collected: "Collected",
  received: "With the returns desk",
  awarded: "Awarded",
  rejected: "Not accepted",
  cancelled: "Cancelled",
};

export function stageOf(status: string): string {
  return STAGES[status] ?? "In progress";
}

export function ReturnsPage({ program }: { program: RewardsProgram | null }) {
  const router = useRouter();
  const [state, setState] = React.useState<"checking" | "guest" | "ready">("checking");
  /* `null` MEANS "COULD NOT BE READ", AND IT IS HELD ONTO — NEVER COLLAPSED TO
     `[]`. `listMyReturns()` answers `null` for every failure (CORS, a 401 that
     should not have happened, a network error), and `[]` is what
     `ReturnsView` reads as "genuinely none yet" — the one state that renders
     "Nothing sent back yet" and a CTA inviting another submission. Collapsing
     the two here made that sentence a confident false statement on exactly
     the failure this feature is most likely to hit before `APP_ORIGINS`
     carries the storefront's origin: a signed-in shopper who just submitted,
     told they have nothing, pointed at "Request a pickup", and one
     `return_already_open` refusal later. */
  const [items, setItems] = React.useState<MyReturn[] | null>(null);
  const [firstLoad, setFirstLoad] = React.useState<"loading" | "done">("loading");

  React.useEffect(() => {
    let cancelled = false;
    void readShopSession().then((session) => {
      if (cancelled) return;
      /* AN UNREACHABLE API IS NOT A SIGNED-OUT SHOPPER — the rule every screen
         in this folder follows. Only a CONFIRMED guest is sent to sign in;
         `session.kind === "unknown"` falls through to "ready" the same way
         `rewards-page.tsx` does. `listMyReturns()` answers `null` rather than
         throwing on that same failure too, but unlike the session check, a
         failed READ here is not treated as equivalent to "none" — see
         `items`'s own comment above. */
      if (session.kind === "guest") {
        setState("guest");
        router.replace(`/sign-in?next=${encodeURIComponent("/account/returns")}`);
        return;
      }
      setState("ready");
      void listMyReturns().then((result) => {
        if (cancelled) return;
        setItems(result);
        setFirstLoad("done");
      });
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (state !== "ready" || firstLoad === "loading") {
    return <ReturnsSkeleton title={program?.name ?? null} />;
  }

  return <ReturnsView program={program} items={items} />;
}

/**
 * The page itself, given its data.
 *
 * EXPORTED AND PROP-DRIVEN for the same reason `RewardsView` and `OrdersList`
 * are: the states worth looking at here — a return mid-pickup, one awarded,
 * one closed — all need a credentialed session a dev environment cannot
 * produce, since `/me/returns` is credentialed and localhost is not in the
 * commerce API's `APP_ORIGINS`.
 */
export function ReturnsView({
  program,
  items,
}: {
  program: RewardsProgram | null;
  /** `null` is "could not be read" — see `ReturnsPage`'s own comment. It is a
   *  DIFFERENT fact from `[]`, and this component is the one place that
   *  distinction has to be kept, because it is the one place that would
   *  otherwise print "Nothing sent back yet" over it. */
  items: MyReturn[] | null;
}) {
  return (
    <Shell>
      <ReturnsHeading title={program?.name ?? null} />

      {items === null ? (
        /* NOT `EmptyState`. "Nothing sent back yet" is a claim about this
           shopper's account; this is a claim about the request, and the two
           must never share a sentence — see `ReturnsPage`'s own comment on
           `items` for the failure that made the two look the same before. */
        <p
          role="alert"
          className="mt-8 border border-destructive-strong px-4 py-3 font-sans text-sm text-destructive-strong"
        >
          We couldn&apos;t load your returns just now. Try again in a moment.
        </p>
      ) : items.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<Recycle aria-hidden="true" />}
            title="Nothing sent back yet"
            body="Once you request a pickup, it'll show up here with where it's got to."
            action={
              /* The one raised control on this screen, and only in this
                 state — same reasoning as the rewards page's own empty
                 state: a page with cards on it has nothing left to raise a
                 second CTA over. */
              <Button asChild className={cn(NEO_SURFACE, "h-11 px-5")}>
                <Link href="/returns">Request a pickup</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id}>
              <ReturnCard item={item} program={program} />
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}

/**
 * The title.
 *
 * `program.name` WHEN THE SHOP HAS ONE, the same fallback shape
 * `RewardsHeading` uses with "Rewards" — "Returns" is the API's own
 * vocabulary (`/api/marketing/me/returns`), not a programme noun invented
 * here. A page still needs a name when the marketing service is having a bad
 * day.
 */
function ReturnsHeading({ title }: { title: string | null }) {
  return (
    <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
      {title ?? "Returns"}
    </h1>
  );
}

/**
 * The award, in the programme's own words — or nothing at all.
 *
 * Mirrors `RewardsBalance`'s own rule: a bare number with no noun is
 * unreadable rather than partially useful, so a return that WAS awarded
 * something renders no award line at all on the rare day the public
 * programme read fails, rather than a naked "50" a shopper has to guess the
 * unit of.
 */
function awardLine(pointsAwarded: number, program: RewardsProgram | null): string | null {
  if (!program) return null;
  return `${pointsAwarded.toLocaleString()} ${pointsLabel(pointsAwarded, program)}`;
}

/**
 * One return: what it is called, what was declared, and — once there is one
 * — the pickup and the award.
 */
function ReturnCard({ item, program }: { item: MyReturn; program: RewardsProgram | null }) {
  const award = item.pointsAwarded != null ? awardLine(item.pointsAwarded, program) : null;

  return (
    <div className="border border-brand-line px-4 py-4 sm:px-6 sm:py-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-sans text-sm font-semibold text-foreground">{stageOf(item.status)}</p>
          <p className="mt-0.5 font-sans text-xs text-muted-foreground">
            Requested {formatStamp(item.createdAt, { dateOnly: true })}
          </p>
        </div>
        {/* THE DECLARED QUANTITY, AS A BARE FIGURE. Every other number on this
            card either carries the operator's own noun (the award) or needs
            none, because the card around it already says what it counts —
            the same judgement `LedgerRow`'s balance-after figure makes. */}
        <p className="shrink-0 font-mono text-sm tabular-nums text-foreground">
          {item.qtyDeclared.toLocaleString()} declared
        </p>
      </div>

      {item.pickupScheduledAt != null && (
        <p className="mt-3 border-t border-brand-line pt-3 font-sans text-sm text-muted-foreground">
          Pickup {formatStamp(item.pickupScheduledAt)}
          {item.driverName ? ` · ${item.driverName}` : ""}
        </p>
      )}

      {award && (
        <p className="mt-3 border-t border-brand-line pt-3 font-mono text-sm tabular-nums text-foreground">
          {award}
        </p>
      )}
    </div>
  );
}

/**
 * The wait.
 *
 * THE TITLE IS DRAWN, NOT PLACEHELD — the route already handed it in, the
 * same judgement `RewardsSkeleton` makes for the same reason.
 *
 * THREE CARDS, AT THE SHAPE A FRESH RETURN ACTUALLY HAS. A card can carry up
 * to four lines once it has a pickup and an award; the wait cannot know in
 * advance which of those any given row will resolve to, so — the same
 * trade-off `LedgerRowSkeleton` names for its own reason — it reserves the
 * two lines every return has from the moment it exists (the stage and the
 * declared figure) rather than guessing at the other two. The result settles
 * DOWNWARD for a return that turns out to have a pickup or an award already,
 * which is the direction the two-line ledger placeholder also chose.
 */
export function ReturnsSkeleton({ title }: { title: string | null }) {
  return (
    <Shell>
      <ReturnsHeading title={title} />
      <SkeletonRegion label="Loading your returns" className="mt-8">
        <ul className="flex flex-col gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <li key={i}>
              <ReturnCardSkeleton />
            </li>
          ))}
        </ul>
      </SkeletonRegion>
    </Shell>
  );
}

/** One card's placeholder, at the card's own type — the stage line and the
 *  meta line every resolved card carries, plus the declared figure's own box
 *  on the trailing edge. */
function ReturnCardSkeleton() {
  return (
    <div aria-hidden="true" className="border border-brand-line px-4 py-4 sm:px-6 sm:py-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <TextSkeleton className="w-32 max-w-full font-sans text-sm" />
          <TextSkeleton className="mt-0.5 w-28 max-w-full font-sans text-xs" />
        </div>
        <TextSkeleton className="w-20 shrink-0 font-mono text-sm" />
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <AccountShell>{children}</AccountShell>;
}
