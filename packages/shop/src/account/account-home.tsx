"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Gift, LifeBuoy, LogOut, Package, Recycle, UserCog } from "lucide-react";
import { Button, Skeleton, SkeletonRegion, TextSkeleton, cn } from "@plaspool/ui";

import { Avatar } from "./avatar";
import { readShopSession, signOutEverywhere, type ShopCustomer } from "../data/auth-api";
import { getPointsBalance, pointsLabel } from "../data/points-api";
import type { PointsBalance } from "../data/points-api";
import { AccountShell } from "./account-shell";

/**
 * `/account` — who you are, what you have, and where the rest of it is.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE ACCOUNT AREA HAD NO FRONT DOOR. `/account/orders` and `/account/settings`
 * both existed and neither was a landing: the header's menu had to name every
 * destination itself, the balance was parked on the orders list where it had
 * nothing to do with orders, and there was nowhere for a fifth surface to go.
 * This is that door.
 *
 * ═══ AND IT IS NOT A SECOND COPY OF THE MENU IT WAS OPENED FROM ═══
 * That is the failure `settings-page.tsx` records against its own first cut —
 * a page listing Orders, Help and Sign out, every one of which was in the
 * dropdown you clicked to get there. A hub earns its place by holding what a
 * menu cannot: WHO you are signed in as, WHAT your balance is, and a line under
 * each destination saying what is actually behind it. A row here is a
 * destination plus the reason to go, which is a different thing from a link.
 *
 * ═══ THE BALANCE MOVED HERE FROM THE ORDERS LIST ═══
 * A `PointsSummary` component used to sit above the order rows — it is deleted
 * now, and `BalanceLine` below replaces it. It was the only place the
 * balance appeared, so it had to go somewhere — but a shopper on the orders
 * list is answering "where is my parcel", and the balance answered a question
 * nobody on that page had asked. It belongs on the account's front page and on
 * its own history page; both now exist.
 *
 * ═══ NO NEOBRUTALIST CONTROL ON THIS SCREEN, DELIBERATELY ═══
 * The stroke-and-shadow treatment marks the ONE thing a screen wants you to do
 * — add to basket, pay, order it again. A hub wants you to do whichever of five
 * things you came for, so raising one of them would be the page guessing, and
 * raising all of them would be five buttons shouting equally. Hairlines and
 * spacing carry the whole thing, which is this shop's default register.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function AccountHomePage({ programName }: { programName: string | null }) {
  const router = useRouter();
  const [state, setState] = React.useState<
    | { kind: "loading" }
    | { kind: "failed" }
    | { kind: "ready"; customer: ShopCustomer }
  >({ kind: "loading" });
  const [balance, setBalance] = React.useState<PointsBalance | null>(null);
  const [signingOut, setSigningOut] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void readShopSession().then((result) => {
      if (cancelled) return;
      /* AN UNREACHABLE API IS NOT A SIGNED-OUT SHOPPER — the rule every screen
         in this folder follows. Reported here rather than redirected: being
         bounced to a login screen by a timeout is the same lie the header was
         fixed to stop telling. */
      if (result.kind === "unknown") {
        setState({ kind: "failed" });
        return;
      }
      if (result.kind !== "customer") {
        router.replace(`/sign-in?next=${encodeURIComponent("/account")}`);
        return;
      }
      setState({ kind: "ready", customer: result.customer });
      void getPointsBalance().then((b) => {
        if (!cancelled) setBalance(b);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (state.kind === "failed") {
    return (
      <Shell>
        <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Your account
        </h1>
        <p
          role="alert"
          /* `destructive-strong`, NOT `destructive`. The base token is tuned as
             a BUTTON FILL and measures 3.76:1 as text — under AA, on the one
             line a shopper has to be able to read when something has gone
             wrong. See the note on the token in `globals.css`. */
          className="mt-6 border border-destructive-strong px-4 py-3 font-sans text-sm text-destructive-strong"
        >
          We couldn&apos;t reach your account just now. This doesn&apos;t mean you&apos;re signed
          out — try again in a moment.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => window.location.reload()}
          className="mt-4"
        >
          Try again
        </Button>
      </Shell>
    );
  }

  if (state.kind !== "ready") return <AccountHomeSkeleton programName={programName} />;

  return (
    <AccountHomeView
      programName={programName}
      customer={state.customer}
      balance={balance}
      signingOut={signingOut}
      onSignOut={async () => {
        setSigningOut(true);
        await signOutEverywhere();
        router.refresh();
        router.push("/");
      }}
    />
  );
}

/**
 * The hub itself, given who is signed in.
 *
 * EXPORTED AND PROP-DRIVEN, same reason as `OrdersList` and `RewardsView`: the
 * states worth looking at — a customer with a balance, one without, one with
 * no display name — all need a credentialed session that a dev environment
 * cannot produce, because localhost is not in the commerce API's
 * `APP_ORIGINS`. `/dev/account` renders this directly.
 */
export function AccountHomeView({
  programName,
  customer,
  balance,
  signingOut,
  onSignOut,
}: {
  programName: string | null;
  customer: ShopCustomer;
  balance: PointsBalance | null;
  signingOut: boolean;
  onSignOut: () => void;
}) {
  const name = customer.name?.trim();
  const first = name ? name.split(/\s+/)[0] : null;

  return (
    <Shell>
      <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {/* ═══ THE GREETING IS THE HEADING, NOT A BANNER ABOVE ONE ═══
            A coloured welcome strip with the page title under it says the same
            thing twice and spends the top 90px of a phone screen doing it. The
            greeting IS the title here, so the first thing on the page is the
            one line only this shopper's page can say.
            FIRST NAME ONLY, and the email is never greeted. "Hello,
            nathaniel.uriri@example.com" is what a mail-merge does; falling back
            to a plain "Your account" is what a person does. */}
        {first ? `Hello, ${first}` : "Your account"}
      </h1>

      <div className="mt-6 flex items-center gap-3 border border-brand-line px-4 py-3">
        <Avatar
          name={customer.name}
          email={customer.email}
          colourKey={customer.id}
          className="h-11 w-11 text-base"
        />
        <div className="min-w-0">
          {name && (
            <p className="truncate font-sans text-sm font-semibold text-foreground">{name}</p>
          )}
          <p className="truncate font-sans text-sm text-muted-foreground">{customer.email}</p>
        </div>
      </div>

      <BalanceLine balance={balance} programName={programName} />

      <nav aria-label="Your account" className="mt-8">
        <ul className="divide-y divide-brand-line border-y border-brand-line">
          <HubRow
            href="/account/orders"
            icon={<Package aria-hidden="true" className="h-5 w-5" />}
            title="Your orders"
            note="Where each one has got to, every step it took, and one tap to buy it again."
          />
          {/* ONLY WHEN THE SHOP ACTUALLY RUNS A PROGRAMME. `programName` is the
              public marketing read; absent means there is nothing behind
              either row, and a link to an empty page is worse than no link.
              BOTH ROWS SHARE THE SAME TITLE, DELIBERATELY: they are two faces
              of one programme — what it is worth (rewards) and how you feed
              it (returns) — so the operator's own name for it is correct on
              both, and the icon plus the note are what tell them apart. */}
          {programName && (
            <>
              <HubRow
                href="/account/rewards"
                icon={<Gift aria-hidden="true" className="h-5 w-5" />}
                title={programName}
                note="Your balance, everything you've earned, and every discount you've spent."
              />
              <HubRow
                href="/account/returns"
                icon={<Recycle aria-hidden="true" className="h-5 w-5" />}
                title={programName}
                note="Every return you've sent, and where each one has got to."
              />
            </>
          )}
          <HubRow
            href="/account/settings"
            icon={<UserCog aria-hidden="true" className="h-5 w-5" />}
            title="Account and addresses"
            note="The email you're signed in with, and the addresses your orders have gone to."
          />
          <HubRow
            href="/contact"
            icon={<LifeBuoy aria-hidden="true" className="h-5 w-5" />}
            title="Help and support"
            note="Something wrong with an order, or a question about one."
          />
        </ul>
      </nav>

      <Button
        type="button"
        variant="outline"
        disabled={signingOut}
        onClick={onSignOut}
        className="mt-8 gap-2"
      >
        <LogOut aria-hidden="true" className="h-4 w-4" />
        {signingOut ? "Signing out…" : "Sign out"}
      </Button>
    </Shell>
  );
}

/**
 * The balance, as one line with a way in.
 *
 * ═══ ABSENT RATHER THAN ZERO — WHICH IS THIS COMPONENT'S RULE AND NOT THE
 * REWARDS PAGE'S ═══
 * The two are deliberately different and it is worth saying why. `/account/
 * rewards` IS the programme, so a shopper who opened it deliberately is told
 * "you have none yet" — that is the answer to their question. This is a hub: a
 * "0" beside a programme name reads as a broken feature to somebody who has
 * never heard of the programme and came here to find their orders. So a
 * customer with a balance sees it, and a customer without sees one less row.
 *
 * NO NOUN IS SPELLED HERE. Every word arrives with the balance.
 */
function BalanceLine({
  balance,
  programName,
}: {
  balance: PointsBalance | null;
  programName: string | null;
}) {
  if (!balance || balance.points <= 0) return null;
  const label = pointsLabel(balance, balance.points);
  if (!label) return null;

  return (
    <Link
      href="/account/rewards"
      className="mt-4 flex items-center justify-between gap-3 border border-brand-line bg-brand-soft/50 px-4 py-3 transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="min-w-0">
        <p className="font-sans text-xs uppercase tracking-wider text-muted-foreground">
          {programName ?? "Balance"}
        </p>
        <p className="mt-0.5 font-mono text-xl font-semibold tabular-nums text-foreground">
          {balance.points.toLocaleString()}{" "}
          <span className="font-sans text-sm font-medium">{label}</span>
        </p>
      </div>
      <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-muted-foreground" />
    </Link>
  );
}

/**
 * One destination.
 *
 * THE WHOLE ROW IS THE TARGET, which is what makes this usable with a thumb:
 * a 64px row against a 44px title. The chevron is `aria-hidden` — the link's
 * accessible name is its title and note, and "chevron right" is noise.
 */
function HubRow({
  href,
  icon,
  title,
  note,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  note: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className={cn(
          "flex items-start gap-3 py-4 transition-colors",
          "hover:bg-brand-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          /* The tint runs to the page's edge rather than stopping at the text,
             because a hover state that is narrower than the row it belongs to
             reads as a second element. `-mx-4 px-4` on a `px-4` shell does that
             without the row leaving the flow. */
          "-mx-4 px-4 sm:-mx-6 sm:px-6",
        )}
      >
        <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-sans text-sm font-semibold text-foreground">{title}</span>
          <span className="mt-0.5 block font-sans text-xs text-muted-foreground">{note}</span>
        </span>
        <ChevronRight
          aria-hidden="true"
          className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
        />
      </Link>
    </li>
  );
}

/**
 * The wait.
 *
 * FIVE ROWS WHEN A PROGRAMME EXISTS, THREE WHEN IT DOES NOT — NEVER FOUR. The
 * rewards AND returns rows are both conditional on the same programme
 * existing, which this cannot know before the route's own read resolves —
 * but the route DOES know, and hands `programName` in, so the count is exact
 * rather than assumed. This used to reserve four; it silently undercounted by
 * one the moment a second programme-gated row landed beside the first, which
 * is exactly the kind of drift a hardcoded number invites and an expression
 * derived from the same condition the rows themselves use does not. The
 * balance line is not reserved at all: it is absent from most accounts, and
 * reserving 62px of it would make every customer without a balance watch a
 * placeholder resolve into nothing. Same judgement, and the same reasoning,
 * as `BalanceLine`'s own absence from most accounts.
 */
export function AccountHomeSkeleton({ programName }: { programName: string | null }) {
  return (
    <Shell>
      <SkeletonRegion label="Loading your account">
        {/* The greeting cannot be drawn — it is the customer's name, which is
            the thing being fetched — so this is the one bar on the page that
            stands in for real text. `text-2xl`/`sm:text-3xl` line boxes. */}
        <Skeleton className="h-8 w-52 max-w-full sm:h-9" />

        <div className="mt-6 flex items-center gap-3 border border-brand-line px-4 py-3">
          <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <TextSkeleton className="w-36 max-w-full font-sans text-sm" />
            <TextSkeleton className="mt-0.5 w-52 max-w-full font-sans text-sm" />
          </div>
        </div>

        <div className="mt-8 divide-y divide-brand-line border-y border-brand-line">
          {Array.from({ length: programName ? 5 : 3 }, (_, i) => (
            <div key={i} className="flex items-start gap-3 py-4">
              <Skeleton className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <TextSkeleton className="w-32 max-w-full font-sans text-sm" />
                <TextSkeleton className="mt-0.5 w-64 max-w-full font-sans text-xs" />
              </div>
            </div>
          ))}
        </div>

        {/* The sign-out button's own box: `h-10` is the `Button` default. */}
        <Skeleton className="mt-8 h-10 w-28" />
      </SkeletonRegion>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <AccountShell>{children}</AccountShell>;
}
