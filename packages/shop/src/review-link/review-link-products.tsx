"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { Button, cn } from "@plaspool/ui";

import { Link } from "../components/link";
import { imageUrl } from "../data/api";
import type { ReviewLinkProduct } from "../data/reviews";
import { ReviewForm } from "../product/review-form";

/**
 * One card per product on the order, each submitted on its own.
 *
 * SEPARATE FORMS, NOT ONE. A half-finished second card must never block the
 * first — somebody who loved one spool and has not printed with the other yet
 * should be able to send the one review they have.
 */

export type CardStatus = "form" | "submitted" | "reviewed";

export function initialStatuses(products: readonly ReviewLinkProduct[]): Record<string, CardStatus> {
  return Object.fromEntries(products.map((p) => [p.slug, p.reviewed ? "reviewed" : "form"]));
}

export function allReviewed(statuses: Record<string, CardStatus>): boolean {
  const values = Object.values(statuses);
  return values.length > 0 && values.every((status) => status !== "form");
}

export function ReviewLinkProducts({
  token,
  firstName,
  products,
  className,
}: {
  token: string;
  firstName: string | null;
  products: readonly ReviewLinkProduct[];
  className?: string;
}) {
  const [statuses, setStatuses] = React.useState(() => initialStatuses(products));
  const set = (slug: string, status: CardStatus) =>
    setStatuses((prev) => ({ ...prev, [slug]: status }));

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {allReviewed(statuses) && <ReviewLinkThanks />}

      <ul className="flex flex-col gap-6">
        {products.map((product) => (
          <li key={product.slug}>
            <ReviewLinkCard product={product} status={statuses[product.slug] ?? "form"}>
              <ReviewForm
                productSlug={product.slug}
                productName={product.title}
                reviewLink={token}
                defaultAuthorName={firstName}
                requireAuthorName={!firstName?.trim()}
                onSubmitted={() => set(product.slug, "submitted")}
                onAlreadyReviewed={() => set(product.slug, "reviewed")}
                hideHeading
              />
            </ReviewLinkCard>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Presentational, so every status renders under `renderToStaticMarkup`. */
export function ReviewLinkCard({
  product,
  status,
  children,
}: {
  product: ReviewLinkProduct;
  status: CardStatus;
  /** The form, rendered only while `status` is `form`. */
  children: React.ReactNode;
}) {
  const src = imageUrl(product.imageUrl);
  return (
    <article className="rounded-lg border border-brand-line bg-background p-4 sm:p-6">
      <header className="flex items-center gap-3">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            className="h-14 w-14 shrink-0 rounded-md border border-brand-line object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="h-14 w-14 shrink-0 rounded-md border border-brand-line bg-brand-soft"
          />
        )}
        <h2 className="min-w-0 flex-1 text-base font-semibold text-foreground">
          {product.title}
        </h2>
        {status === "reviewed" && (
          <span className="inline-flex shrink-0 items-center gap-1 text-sm text-foreground">
            Reviewed <Check aria-hidden="true" className="h-4 w-4 text-brand" />
          </span>
        )}
      </header>

      {status === "form" && <div className="mt-5">{children}</div>}

      {status === "submitted" && (
        <p
          role="status"
          className="mt-4 flex items-start gap-2 rounded-md bg-brand-soft p-3 text-sm text-foreground"
        >
          <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          Thanks, your review is in! It&apos;ll appear once we&apos;ve checked it.
        </p>
      )}
    </article>
  );
}

export function ReviewLinkThanks() {
  return (
    <div role="status" className="border-2 border-foreground bg-brand-soft px-4 py-4">
      <p className="text-base font-semibold text-foreground">
        Thank you for reviewing your order
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Every review is read before it goes up, so yours will appear shortly.
      </p>
      <Button asChild className="mt-4 h-11 px-6">
        <Link href="/store">Keep shopping</Link>
      </Button>
    </div>
  );
}
