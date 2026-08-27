"use client";

import { Link } from "../components/link";
import { ReviewForm } from "./review-form";
import type { ReviewGate } from "./review-permissions";

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
 * ═══ AND SIGNED IN IS NOT THE WHOLE QUESTION: REVIEWING IS ONCE ═══
 * This gate asked exactly one thing — "are you signed in?" — and a review is
 * one per customer per product. So a shopper who had already written one was
 * shown the entire form again, stars and all, sitting directly above the
 * review they had already written.
 *
 * `hasReviewed` replaces the form with a NOTICE rather than disabling it: a
 * disabled form still shows somebody a control for something they cannot do,
 * and this one would be refused by the API anyway. `canReview` does the same
 * for a shopper who never bought the spool.
 *
 * ═══ THIS COMPONENT NO LONGER ASKS EITHER QUESTION ═══
 * The answer arrives as `gate`, decided by `reviewGateFor` in
 * `review-permissions.ts` — read that file for the fail-open rule, and for why
 * an unreadable answer must render the form rather than withhold it.
 *
 * It reads the session and the eligibility itself, in a `useEffect`. Two
 * things were wrong with that. `ReviewsTab` renders this component and already
 * needs both answers for its vote and reply rows, so the product page ran two
 * session reads and would have run two eligibility reads. And a decision inside
 * an effect cannot be tested at all in a suite with no jsdom, which is exactly
 * where the bug had been sitting.
 *
 * So there are no hooks here now. The tab resolves both answers in ONE
 * `setState`, so no surface is painted and then taken away a moment later.
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
  gate,
  productSlug,
  productName,
  signInHref,
  className,
}: {
  /** Decided by `reviewGateFor`, above. See this file's header. */
  gate: ReviewGate;
  productSlug: string;
  productName: string;
  /** Where a guest is sent, already carrying the way back to this page. */
  signInHref: string;
  className?: string;
}) {
  if (gate === "guest") {
    /* GUEST AND UNRESOLVED GET THE SAME PANEL. Only the copy had to be chosen
       carefully — see the header — because one of the two readers may already
       be signed in and must not be told otherwise. */
    return <ReviewGuestPrompt next={signInHref} />;
  }

  if (gate === "reviewed") return <AlreadyReviewedNotice className={className} />;
  if (gate === "unbought") return <PurchaseRequiredNotice className={className} />;

  /* NO NAME CHECK. This used to send an account with no name to settings,
     because the storefront supplied `authorName` and a published review needed
     one. The API derives the author itself now, so whether a nameless account
     may review is ITS rule — and a second copy of it here would eventually
     refuse somebody the server would have accepted. */
  return (
    <ReviewForm productSlug={productSlug} productName={productName} className={className} />
  );
}

const PANEL = "border-2 border-foreground bg-brand-soft px-4 py-3";
const PANEL_LINK =
  "mt-1.5 inline-block text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * A shopper who has already used their one review on this product.
 *
 * ═══ THEIR REVIEW MAY NOT BE ON THIS PAGE TO POINT AT ═══
 * A review is `pending` until a human approves it and is invisible until then,
 * INCLUDING TO ITS AUTHOR; a rejected one never appears at all. The server
 * counts both as "already reviewed", deliberately — it spares a rejected
 * reviewer the loop of rewriting something they cannot see and were never told
 * the fate of.
 *
 * That is what the second sentence is for. "You have already reviewed this",
 * on a page showing no review of theirs, reads as a bug — and the reader's next
 * move is to hunt for the form this notice replaced. So it says the review is
 * still being read, which is true whether it is pending, rejected, or approved
 * and further down the page, and it promises nothing about where or whether it
 * will appear.
 */
export function AlreadyReviewedNotice({ className }: { className?: string }) {
  return (
    <div className={className ? `${PANEL} ${className}` : PANEL}>
      <p className="text-sm font-semibold text-foreground">
        You have already reviewed this
      </p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Every shopper gets one review per product. If yours is not on this page yet, it
        is still being read — a person reads each one before it goes up.
      </p>
    </div>
  );
}

/**
 * A signed-in shopper the shop has no record of having bought this.
 *
 * ═══ IT STATES THE RULE; IT DOES NOT ACCUSE ═══
 * The server proves a purchase by the account on the order OR by a case-folded
 * email match, and GUEST CHECKOUT IS THE DEFAULT PATH THROUGH THIS SHOP — so a
 * real buyer who checked out under another address is invisible to that query.
 * "You have not bought this" would be flatly wrong for them and unarguable from
 * their side.
 *
 * So the panel says what reviewing REQUIRES, which is true for every reader,
 * and then names the one thing that would change the answer. That is the same
 * rule `ReviewGuestPrompt` above follows for the same reason.
 *
 * ═══ IT SPEAKS FOR THE WHOLE TAB, WHICH IS WHY IT NAMES ALL THREE ═══
 * The same purchase rule hides the reply control and the vote buttons on every
 * review below. Those rows say nothing about it deliberately — an explanation
 * repeated under twenty reviews is noise — so this panel is the one place a
 * non-buyer is told why the tab is read-only for them, and it has to cover
 * replying and voting as well as reviewing.
 */
export function PurchaseRequiredNotice({ className }: { className?: string }) {
  return (
    <div className={className ? `${PANEL} ${className}` : PANEL}>
      <p className="text-sm font-semibold text-foreground">
        Reviews come from buyers
      </p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Reviewing, replying and voting are for shoppers who bought the spool, so other
        printers know it comes from real printing. Bought this with a different email?
        Sign in with that one.
      </p>
    </div>
  );
}

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
      <p className="text-sm font-semibold text-foreground">Write a review</p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Reviews are published under your account name, so other printers know they came
        from a real shopper.
      </p>
      <Link href={next} className={PANEL_LINK}>
        Continue
      </Link>
    </div>
  );
}
