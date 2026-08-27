import { Link } from "../components/link";

/**
 * A shopper met before any form is mounted, because they have not signed in
 * at all.
 *
 * ═══ SHARED BETWEEN `ReturnModal` AND `/returns` ITSELF ═══
 * Extracted out of `return-modal.tsx` so the dialog and the standalone page
 * show the same copy rather than a dialog-shaped original and a page-shaped
 * fork that quietly drifts from it — see `return-form-gate.tsx`'s own header
 * for why the page needs this too. Styled the same way `ReturnForm` styles
 * its own `already-open` and `sign-in` placements, for the one form all
 * three share the look of.
 *
 * `next=/returns` ALWAYS, even when this is already rendering ON `/returns` —
 * signing in lands back on the standalone page, which is the one destination
 * both callers can promise honestly. Not "bring you back here": that would be
 * true from the dialog's own page but not from every page a `ReturnsCta`
 * might be sitting on.
 */
export function GuestPrompt() {
  return (
    <div className="border-2 border-foreground bg-brand-soft px-4 py-3">
      <p className="text-sm font-semibold text-foreground">
        Sign in to send a return request.
      </p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Signing in will take you to the returns page to send this.
      </p>
      <Link
        href={`/sign-in?next=${encodeURIComponent("/returns")}`}
        className="mt-1.5 inline-block text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Sign in
      </Link>
    </div>
  );
}
