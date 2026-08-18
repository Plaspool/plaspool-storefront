import { COMMERCE_API_BASE, REVIEWS_PER_PAGE, REVIEWS_REVALIDATE } from "./config";

/**
 * The reviews client — the storefront's half of the contract published on
 * Plaspool/plaspool-admin#4.
 *
 * Reads are server-side and cached: the two GETs are cacheable by design
 * (`Cache-Control: public, s-maxage=60`) and the product page is ISR, so a
 * newly approved review reaches a page within the sum of the two windows.
 * That is the deal the contract describes and it is why nothing here fetches
 * reviews per request.
 *
 * The submission is the exception and runs in the BROWSER, cross-origin, on
 * purpose: the API's rate budgets key on the customer's own IP, and a
 * server-side proxy would put the Worker's address on every submission and
 * collapse a per-visitor budget into a per-site one. The endpoint answers
 * preflights for exactly this caller.
 */

export type SentimentLabel = "positive" | "neutral" | "negative";

export interface PublicReview {
  id: string;
  productSlug: string;
  rating: number;
  title: string | null;
  body: string;
  authorName: string;
  sentiment: SentimentLabel;
  /** Epoch milliseconds. */
  createdAt: number;
}

export interface ReviewPage {
  items: PublicReview[];
  nextCursor: string | null;
}

export interface ReviewAggregate {
  productSlug: string;
  count: number;
  /** Mean rating × 100 — `433` is 4.33 stars. See `starsFromAggregate`. */
  averageRating: number;
  distribution: Record<"1" | "2" | "3" | "4" | "5", number>;
  sentiment: Record<SentimentLabel, number>;
}

/** The empty answer, so a caller never has to branch on `null`. */
export function emptyAggregate(productSlug: string): ReviewAggregate {
  return {
    productSlug,
    count: 0,
    averageRating: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    sentiment: { positive: 0, neutral: 0, negative: 0 },
  };
}

/** `433` → `4.33`. The API sends an integer so no float crosses the wire. */
export function starsFromAggregate(aggregate: ReviewAggregate): number {
  return aggregate.averageRating / 100;
}

/**
 * Reviews never fail a product page. A spool that cannot be bought because a
 * review service is unreachable is a worse outcome than a page with no
 * reviews on it, so both readers below answer empty rather than throwing —
 * the same rule `BlogStrip` follows for the content API.
 */
export async function listReviews(
  productSlug: string,
  limit: number = REVIEWS_PER_PAGE,
): Promise<ReviewPage> {
  try {
    const url = new URL(`${COMMERCE_API_BASE}/api/public/reviews`);
    url.searchParams.set("product", productSlug);
    url.searchParams.set("limit", String(limit));
    const res = await fetch(url, { next: { revalidate: REVIEWS_REVALIDATE } });
    if (!res.ok) return { items: [], nextCursor: null };
    return (await res.json()) as ReviewPage;
  } catch {
    return { items: [], nextCursor: null };
  }
}

export async function getReviewAggregate(productSlug: string): Promise<ReviewAggregate> {
  try {
    const url = new URL(`${COMMERCE_API_BASE}/api/public/reviews/aggregate`);
    url.searchParams.set("product", productSlug);
    const res = await fetch(url, { next: { revalidate: REVIEWS_REVALIDATE } });
    if (!res.ok) return emptyAggregate(productSlug);
    const { aggregate } = (await res.json()) as { aggregate: ReviewAggregate };
    return aggregate ?? emptyAggregate(productSlug);
  } catch {
    return emptyAggregate(productSlug);
  }
}

/** The browser's "load more" — same endpoint, one page further in. */
export async function listReviewsFromBrowser(
  productSlug: string,
  cursor: string,
  limit: number = REVIEWS_PER_PAGE,
): Promise<ReviewPage> {
  const url = new URL(`${COMMERCE_API_BASE}/api/public/reviews`);
  url.searchParams.set("product", productSlug);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("cursor", cursor);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as ReviewPage;
}

export interface SubmitReviewInput {
  productSlug: string;
  rating: number;
  title: string;
  body: string;
  authorName: string;
  authorEmail: string;
}

export interface SubmitReviewResult {
  reviewId: string;
  status: string;
  sentiment: SentimentLabel;
}

/**
 * Distinguishable failures, because the form says something different for
 * each: `rate-limited` is "you have sent a few already", `rejected` is a
 * configuration problem the customer cannot act on, and `failed` is the
 * catch-all. The API's own 400s are prevented client-side before we get here.
 */
export type SubmitError = "rate-limited" | "rejected" | "invalid" | "failed";

export class ReviewSubmitError extends Error {
  constructor(readonly kind: SubmitError) {
    super(kind);
    this.name = "ReviewSubmitError";
  }
}

export async function submitReview(input: SubmitReviewInput): Promise<SubmitReviewResult> {
  let res: Response;
  try {
    res = await fetch(`${COMMERCE_API_BASE}/api/shop/reviews/submit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        productSlug: input.productSlug,
        rating: input.rating,
        /* The API takes `title` as optional and rejects an empty string, so
           an untouched field is omitted rather than sent blank. */
        ...(input.title.trim() ? { title: input.title.trim() } : {}),
        body: input.body.trim(),
        authorName: input.authorName.trim(),
        authorEmail: input.authorEmail.trim(),
      }),
    });
  } catch {
    /* A network error and a CORS refusal are the same TypeError here — the
       browser will not tell a page why a cross-origin request failed. */
    throw new ReviewSubmitError("failed");
  }

  if (res.status === 429) throw new ReviewSubmitError("rate-limited");
  if (res.status === 403) throw new ReviewSubmitError("rejected");
  if (res.status === 400 || res.status === 422) throw new ReviewSubmitError("invalid");
  if (!res.ok) throw new ReviewSubmitError("failed");
  return (await res.json()) as SubmitReviewResult;
}
