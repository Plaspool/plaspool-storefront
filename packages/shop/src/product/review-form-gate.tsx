"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { Link } from "../components/link";
import { ReviewForm } from "./review-form";
import { readShopSession } from "../data/auth-api";
import { signInHref } from "../account/sign-in-href";
import type { ShopSession } from "../data/auth-api";

/**
 * Who may write a review, decided before a single field is mounted.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE FORM USED TO ASK FOR A NAME AND AN EMAIL. Its own header said why —
 * "there is no account yet — the auth bundle is sequenced after this" — and
 * that stopped being true. What was left was a public product page asking a
 * shopper to type an email the shop already held, to identify themselves as
 * somebody the session had already identified, with nothing stopping them
 * typing somebody else's name onto their words.
 *
 * So the reviewer IS the account. The fields are deleted rather than
 * pre-filled: a pre-filled field is still a field, still editable, and still
 * sends whatever it ends up holding.
 *
 * ═══ `"unknown"` GETS A NEUTRAL CONTROL, NOT A SKELETON AND NOT THE FORM ═══
 * `ReturnFormGate` renders its form for `"unknown"` as well as `"customer"`,
 * on the doctrine in `readShopSession()`'s header: "we could not ask" is not
 * "nobody". That cannot be followed here, and the difference is DATA rather
 * than authorisation — this form cannot be submitted without a name and an
 * email, and on `"unknown"` there are none to give it, so rendering it offers
 * a submit button that cannot work.
 *
 * A SKELETON IS ALSO WRONG, and `MobileAccountLinks` already paid for finding
 * out: `readShopSession()` answers `"unknown"` for a network failure AND for a
 * non-2xx, and the probe never retries — so a skeleton behind it shimmers
 * forever on any failure. "A loading state that cannot finish is worse than an
 * honest neutral control" is that file's conclusion, and this is the same
 * situation.
 *
 * So `"unknown"` renders the same panel a guest gets with COPY THAT IS TRUE
 * EITHER WAY. It states what reviewing requires rather than claiming the reader
 * is signed out, and its link goes to `/sign-in`, which resolves the session
 * itself and forwards a shopper who already has one straight back here. Correct
 * whichever the answer turns out to be — which is exactly how the account menu
 * settled the same question.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function ReviewFormGate({
  productSlug,
  productName,
  className,
}: {
  productSlug: string;
  productName: string;
  className?: string;
}) {
  const [session, setSession] = React.useState<ShopSession>({ kind: "unknown" });
  const pathname = usePathname();

  React.useEffect(() => {
    let cancelled = false;
    void readShopSession().then((next) => {
      if (!cancelled) setSession(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (session.kind !== "customer") {
    /* GUEST AND UNKNOWN GET THE SAME PANEL. Only the copy had to be chosen
       carefully — see the header — because one of the two readers may already
       be signed in and must not be told otherwise. */
    return <ReviewGuestPrompt next={signInHref(pathname)} />;
  }

  /* A NAME IS PUBLISHED BESIDE THE REVIEW, and the account may not have one —
     `ShopCustomer.name` is nullable. The email must not stand in for it: it is
     the one field the public projection cannot return, and printing it under a
     review would publish the address this change exists to stop sending. */
  const name = session.customer.name?.trim();
  if (!name) return <ReviewNeedsNamePrompt />;

  return (
    <ReviewForm
      productSlug={productSlug}
      productName={productName}
      author={{ name, email: session.customer.email }}
      className={className}
    />
  );
}

const PANEL = "border-2 border-foreground bg-brand-soft px-4 py-3";
const PANEL_LINK =
  "mt-1.5 inline-block font-sans text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * A shopper who is not signed in, met before any field is mounted.
 *
 * `next` IS THE PAGE THEY ARE ON, so signing in returns them to the product
 * they were about to review rather than to an account page they did not ask
 * for — the same promise `signInHref` makes everywhere else.
 */
export function ReviewGuestPrompt({ next }: { next: string }) {
  return (
    <div className={PANEL}>
      {/* ═══ TRUE WHETHER OR NOT THEY ARE SIGNED IN ═══
          This panel is shown for a confirmed guest AND for a session that could
          not be read, so it states what reviewing REQUIRES rather than claiming
          anything about who is reading. "Sign in to write a review" would be a
          claim, and a signed-in shopper whose probe failed would be told they
          are signed out — the exact lie `unknown` exists to prevent. */}
      <p className="font-sans text-sm font-semibold text-foreground">Write a review</p>
      <p className="mt-0.5 font-sans text-sm text-muted-foreground">
        Reviews are published under your account name, so other printers know they came
        from a real shopper.
      </p>
      <Link href={next} className={PANEL_LINK}>
        Continue
      </Link>
    </div>
  );
}

/**
 * A signed-in shopper whose account carries no name.
 *
 * SENT TO SETTINGS RATHER THAN GIVEN A FIELD. A field here would be the typed
 * name coming back through a side door, on the one page where it is least
 * checkable; setting it on the account fixes it once, for every review and
 * every order.
 */
export function ReviewNeedsNamePrompt() {
  return (
    <div className={PANEL}>
      <p className="font-sans text-sm font-semibold text-foreground">
        Add a name to your account to review.
      </p>
      <p className="mt-0.5 font-sans text-sm text-muted-foreground">
        Reviews are published under it, so we need something to show other printers.
      </p>
      <Link href="/account/settings" className={PANEL_LINK}>
        Account settings
      </Link>
    </div>
  );
}
