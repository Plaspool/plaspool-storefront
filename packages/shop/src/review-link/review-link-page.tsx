import type { Metadata } from "next";

import { Link } from "../components/link";
import { getReviewLink } from "../data/reviews";
import { ReviewLinkProducts } from "./review-link-products";

/**
 * `/review?token=…` — reviewing an order from a link the shop sent by hand.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE LINK IS THE CREDENTIAL, AND THERE IS NO SIGN-IN WALL. The owner copies it
 * from an order in the admin and sends it, nearly always over WhatsApp, so the
 * reader is on a phone, probably not signed in, and should not be asked to be.
 * A visitor who DOES have a session is not redirected either — the token names
 * the order, and it takes priority.
 *
 * DYNAMIC AND UNCACHED, END TO END. The API answers `no-store`, the fetch is
 * `no-store`, and the route is `force-dynamic`: the response is one customer's
 * order, and each product's `reviewed` flips the moment they submit.
 *
 * THE TOKEN STAYS OUT OF ANALYTICS. The route sets `referrer: no-referrer` so
 * it cannot leak through a `Referer` header, and both analytics scripts scrub
 * the `token` parameter before a page view is recorded — see `scrubTokenParam`.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export async function ReviewLinkPage({ token }: { token: string | undefined }) {
  const result = await getReviewLink(token ?? "");

  if (result.kind === "invalid") return <LinkInvalid />;
  if (result.kind === "failed") return <LinkUnavailable />;

  const { link } = result;
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-16">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {reviewLinkGreeting(link.firstName)}
      </h1>
      <p className="mt-2 font-mono text-xs text-muted-foreground">
        Order {link.orderNumber}
      </p>

      <ReviewLinkProducts
        token={token ?? ""}
        firstName={link.firstName}
        products={link.products}
        className="mt-8"
      />
    </div>
  );
}

export function reviewLinkGreeting(firstName: string | null): string {
  const name = firstName?.trim();
  return name ? `Hi ${name}, how did your order go?` : "How did your order go?";
}

export const reviewLinkMetadata: Metadata = {
  title: "Review your order",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export function LinkInvalid() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        This link has expired
      </h1>
      <p className="mt-3 max-w-prose text-base leading-7 text-muted-foreground">
        This link has expired or isn&apos;t valid.{" "}
        <Link href="/contact" className="text-foreground underline underline-offset-4">
          Message us
        </Link>{" "}
        and we&apos;ll send you a new one.
      </p>
    </div>
  );
}

/**
 * The API could not be reached. The link may be perfectly good, so this must
 * not say it has expired — that would send a customer to ask for a new link
 * that would fail the same way.
 */
function LinkUnavailable() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        We couldn&apos;t load your order
      </h1>
      <p className="mt-3 max-w-prose text-base leading-7 text-muted-foreground">
        Something went wrong on our side. Your link is still good — try opening it again
        in a minute.
      </p>
    </div>
  );
}
