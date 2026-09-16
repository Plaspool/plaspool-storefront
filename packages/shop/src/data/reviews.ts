import {
  COMMERCE_API_BASE,
  REVIEWS_BULK_REVALIDATE,
  REVIEWS_PER_PAGE,
  REVIEWS_REVALIDATE,
} from "./config";
import type { RatingSummary } from "./types";

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

/**
 * Who wrote a reply. READ THIS, NEVER THE NAME.
 *
 * Matching on `authorName === "PlaSpool"` to decide whether a reply is
 * official breaks the day a customer is called that, and impersonation is
 * precisely what this field exists to prevent.
 */
export type ReplyAuthorKind = "owner" | "customer";

/**
 * One reply on a review.
 *
 * ═══ THEY ARRIVE FLAT, INCLUDING THE NESTED ONES ═══
 * `replies` is a single array whatever the shape of the conversation; `depth`
 * and `parentId` are the only things that say otherwise. Expecting the JSON to
 * nest loses every second-level reply without erroring — see `threadReplies`.
 *
 * `depth` is `0` or `1` and nothing else. Two levels is the ceiling, enforced
 * server-side with a `400 parentId`.
 *
 * THE STAFF MEMBER WHO TYPED AN OWNER REPLY IS NOT HERE, and never will be.
 * There is no `staffUserId` on the public wire.
 */
export interface ReviewReply {
  id: string;
  /** Null for a reply to the review itself. */
  parentId: string | null;
  depth: number;
  body: string;
  authorKind: ReplyAuthorKind;
  authorName: string;
  /** Epoch milliseconds. */
  createdAt: number;
}

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
  /**
   * How many shoppers found this helpful.
   *
   * THERE IS NO PUBLIC DISLIKE COUNT, deliberately — a tally of `unhelpful` on
   * a product page is a scoreboard for brigading. Render "N found this
   * helpful", never "N up / M down", and never compute a ratio: the
   * denominator does not exist on this side and inventing one misrepresents it.
   */
  helpfulCount: number;
  /**
   * The server matched this review to a paid order. Badge only when `true`;
   * `false` and absent (a payload cached before the field existed) show
   * nothing — the absence of a badge is not a claim the review is unverified.
   */
  verifiedPurchase?: boolean;
  /** Always an array, empty when there are none. Approved replies only —
   *  including to their own author, which is why the reply form has to say so. */
  replies: ReviewReply[];
  /**
   * Customer photos, in the order the reviewer put them. Always an array on
   * today's wire — and typed optional anyway, for the reason `threadReplies`
   * spells out: a product page frozen in the incremental cache before photos
   * shipped carries no such key. Read it through `reviewPhotos()`.
   */
  photos?: ReviewPhoto[];
}

/**
 * One photo on an approved review.
 *
 * `url` IS RELATIVE and points at the API, which answers a `302` to a signed
 * image URL. It is deliberately NOT routed through the storefront's own
 * `/images/shop/<id>` proxy the way catalogue images are: that proxy serves
 * `immutable`, and a photo must STOP being served the moment its review is
 * rejected — the API answers `404` then, and an immutable copy would outlive it.
 */
export interface ReviewPhoto {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
}

/** The photos on a review, tolerating a cached payload from before they existed. */
export function reviewPhotos(review: Pick<PublicReview, "photos">): ReviewPhoto[] {
  return Array.isArray(review.photos) ? review.photos : [];
}

/** A photo's `<img src>`: the API origin in front of the relative path. */
export function reviewPhotoSrc(url: string): string {
  if (/^https?:\/\//.test(url)) return url;
  return `${COMMERCE_API_BASE}${url.startsWith("/") ? "" : "/"}${url}`;
}

/** How many photos one review may carry. The API refuses a fifth. */
export const MAX_REVIEW_PHOTOS = 4;

/** One reply and the replies hanging off it. One level, then stop. */
export interface ReplyNode {
  reply: ReviewReply;
  children: ReviewReply[];
}

/**
 * The flat `replies` array as a one-level tree.
 *
 * ORDER IS THE API'S, PRESERVED. It arrives oldest-first and already sorted;
 * re-sorting is at best a no-op and at worst reorders a conversation around a
 * tie in `createdAt`.
 *
 * A reply naming a parent that is not in the array is kept at the TOP LEVEL
 * rather than dropped. It should not happen, and a visible reply in a slightly
 * wrong place beats a comment that silently disappears.
 *
 * ═══ AND IT TOLERATES THE FIELD BEING ABSENT ENTIRELY ═══
 * The API's contract is that `replies` is always an array, which is true of
 * what it sends today and NOT true of what is already in the incremental cache:
 * `stale-while-revalidate` on a product page is 30 days, so a render frozen
 * before replies shipped carries no such key. `for (const r of undefined)`
 * throws, and because this runs during render it took the entire product page
 * to a 500 rather than costing one empty thread.
 */
export function threadReplies(replies: ReviewReply[]): ReplyNode[] {
  const nodes = new Map<string, ReplyNode>();
  const roots: ReplyNode[] = [];
  if (!Array.isArray(replies)) return roots;

  for (const reply of replies) {
    if (reply.parentId === null) {
      const node: ReplyNode = { reply, children: [] };
      nodes.set(reply.id, node);
      roots.push(node);
    }
  }

  for (const reply of replies) {
    if (reply.parentId === null) continue;
    const parent = nodes.get(reply.parentId);
    if (parent) parent.children.push(reply);
    else roots.push({ reply, children: [] });
  }

  return roots;
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
 * How many slugs one bulk request may name. The API refuses more with a 400,
 * so this batches rather than letting a big grid be silently truncated.
 */
const BULK_LIMIT = 60;

/**
 * Star summaries for a whole listing, in ONE request per batch.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE ENDPOINT THIS EXISTS FOR. The singular aggregate answers one slug, so a
 * sixteen-card grid needed sixteen requests — on Cloudflare Workers that is a
 * subrequest per card against a 50-request cap, i.e. a grid-size ceiling rather
 * than a slow path. `Plaspool/plaspool-admin#12` added the bulk route and this
 * is its client.
 *
 * It is why `ProductCard` can show a rating again at all: with only the
 * singular route the storefront kept the card's star line and the "Best rated"
 * sort switched OFF, because the alternative was invented numbers.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * NEVER THROWS, and an unreachable API yields an EMPTY MAP rather than a
 * failure. A card renders nothing at `count: 0`, so a missing aggregate and a
 * genuine zero look identical to a reader — the reviews service having a bad
 * day costs a star line, never a product.
 */
export async function listReviewAggregates(
  productSlugs: readonly string[],
): Promise<Map<string, RatingSummary>> {
  const out = new Map<string, RatingSummary>();
  const wanted = [...new Set(productSlugs)].filter((slug) => slug.length > 0);
  if (wanted.length === 0) return out;

  /* Batched rather than truncated: the API refuses more than its bound with a
     400, and a grid showing stars on the first sixty cards and blanks after is
     the failure that bound exists to prevent. */
  for (let i = 0; i < wanted.length; i += BULK_LIMIT) {
    const batch = wanted.slice(i, i + BULK_LIMIT);
    try {
      const url = new URL(`${COMMERCE_API_BASE}/api/public/reviews/aggregates`);
      url.searchParams.set("products", batch.join(","));
      const res = await fetch(url, { next: { revalidate: REVIEWS_BULK_REVALIDATE } });
      if (!res.ok) continue;
      const body = (await res.json()) as { aggregates: Record<string, ReviewAggregate> };
      for (const [slug, aggregate] of Object.entries(body.aggregates ?? {})) {
        out.set(slug, toRatingSummary(aggregate));
      }
    } catch {
      /* Leave the batch absent. See the rule above. */
    }
  }
  return out;
}

/**
 * The API's aggregate as the storefront's `RatingSummary`.
 *
 * TWO SHAPES THAT DISAGREE, reconciled in one place. The API sends the mean as
 * an integer ×100 and the distribution as an object keyed `"1"`–`"5"`; this
 * package wants a float and an array whose INDEX 0 IS FIVE STARS — the order a
 * star breakdown is read in, top rating first.
 */
function toRatingSummary(aggregate: ReviewAggregate): RatingSummary {
  return {
    average: starsFromAggregate(aggregate),
    count: aggregate.count,
    distribution: [
      aggregate.distribution[5],
      aggregate.distribution[4],
      aggregate.distribution[3],
      aggregate.distribution[2],
      aggregate.distribution[1],
    ],
  };
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
  /**
   * The BYLINE, not the identity. The API still derives who wrote the review
   * from the session (or the review link); this is only the name printed under
   * it. It was never sent, and a customer with no display name on the account —
   * most of them — got `400 detail:"authorName"` shown as "invalid". Omitted
   * when blank, so the server can fall back to the first name on the order.
   *
   * THERE IS STILL NO `authorEmail`, and never will be: the server ignores it,
   * and it would be the shopper's email crossing the wire for nothing.
   */
  authorName?: string;
  /** Uploaded first by `uploadReviewPhoto`, sent in display order. */
  photoIds?: string[];
  /** The token from `/review?token=…`. Stands in for a session. */
  reviewLink?: string;
}

export interface SubmitReviewResult {
  reviewId: string;
  status: string;
  sentiment: SentimentLabel;
  photoCount?: number;
}

/**
 * Distinguishable failures, because the form says something different for
 * each: `rate-limited` is "you have sent a few already", `rejected` is a
 * configuration problem the customer cannot act on, and `failed` is the
 * catch-all. The API's own 400s are prevented client-side before we get here.
 */
export type SubmitError =
  | "signed-out"
  /** The review is missing, or not approved — the API answers the same `404`
   *  for both so nobody can probe which pending reviews exist. */
  | "gone"
  /** One review per customer per product, and they have used theirs. The gate
   *  normally prevents this; it survives as the answer to the race where the
   *  first review was written in another tab. */
  | "already-reviewed"
  /** Reviews are for people who bought the thing. */
  | "purchase-required"
  /** The review link is expired, tampered with, or for an unpaid order. */
  | "review-link-invalid"
  /** `400 detail:"authorName"` — no byline anywhere, typed or on the order. */
  | "author-name"
  /** `400 detail:"photoIds"` — an id that is not this reviewer's fresh upload. */
  | "photo-ids"
  | "rate-limited"
  | "rejected"
  | "invalid"
  | "failed";

export class ReviewSubmitError extends Error {
  constructor(readonly kind: SubmitError) {
    super(kind);
    this.name = "ReviewSubmitError";
  }
}

/** The API's floor and ceiling for a reply body. */
export const REPLY_MIN = 2;
export const REPLY_MAX = 2000;

export interface PostReplyResult {
  replyId: string;
  /** Always `pending` today. The customer must be told — see `ReplyForm`. */
  status: string;
}

/**
 * Reply to a review, or to a reply on one.
 *
 * IT LANDS `pending` AND IS INVISIBLE UNTIL APPROVED — including to the person
 * who wrote it. Any caller that does not say so out loud produces a customer
 * who posts, sees nothing appear, and posts again.
 *
 * `parentId` OMITTED IS A REPLY TO THE REVIEW. Naming a depth-1 reply is
 * `400 parentId`: two levels is the ceiling, which is why the UI hides the
 * control on a nested reply rather than letting somebody find the wall by
 * hitting it.
 *
 * `404 gone` COVERS TWO THINGS DELIBERATELY — the review is missing, or it is
 * not approved — so that nobody can probe which pending reviews exist. It is
 * not this client's business to tell them apart either.
 */
export async function postReply(
  reviewId: string,
  input: { body: string; parentId?: string | null },
): Promise<PostReplyResult> {
  let res: Response;
  try {
    res = await fetch(
      `${COMMERCE_API_BASE}/api/shop/reviews/${encodeURIComponent(reviewId)}/replies`,
      {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          body: input.body.trim(),
          /* Omitted rather than sent null when replying to the review itself —
             the same rule `submitReview` follows for an untouched headline. */
          ...(input.parentId ? { parentId: input.parentId } : {}),
          /* NO `authorName`. It is optional on the wire and the account already
             carries one; sending a typed byline would be the impersonation door
             the review form just closed, reopened one level down. */
        }),
      },
    );
  } catch {
    throw new ReviewSubmitError("failed");
  }
  if (res.status === 401) throw new ReviewSubmitError("signed-out");
  if (res.status === 429) throw new ReviewSubmitError("rate-limited");
  if (res.status === 404) throw new ReviewSubmitError("gone");
  /* THE PURCHASE GATE STANDS IN FRONT OF REPLIES TOO, so a 403 here is a
     refusal with a reason and not a broken connection. Without this it fell
     through to `failed`, whose copy blames the reader's network for a rule. */
  if (res.status === 403) throw new ReviewSubmitError(await forbiddenReason(res));
  if (res.status === 400 || res.status === 422) throw new ReviewSubmitError("invalid");
  if (!res.ok) throw new ReviewSubmitError("failed");
  return (await res.json()) as PostReplyResult;
}

export type ReactionKind = "helpful" | "unhelpful";

export interface ReactionResult {
  reviewId: string;
  viewerReaction: ReactionKind | null;
  helpfulCount: number;
}

/**
 * Cast, change or clear this viewer's vote on a review.
 *
 * `PUT` AND IDEMPOTENT: the body names the STATE you want, not a toggle.
 * Sending `helpful` twice leaves one vote. Clearing is `{"kind": null}`, sent
 * deliberately — the server does not flip state for us, because two tabs doing
 * that would land on arrival order.
 *
 * The answer carries the new `helpfulCount`; use it rather than refetching the
 * list, which is cached and would not show the change anyway.
 */
export async function setReaction(
  reviewId: string,
  kind: ReactionKind | null,
): Promise<ReactionResult> {
  let res: Response;
  try {
    res = await fetch(
      `${COMMERCE_API_BASE}/api/shop/reviews/${encodeURIComponent(reviewId)}/reactions`,
      {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind }),
      },
    );
  } catch {
    throw new ReviewSubmitError("failed");
  }
  if (res.status === 401) throw new ReviewSubmitError("signed-out");
  if (res.status === 429) throw new ReviewSubmitError("rate-limited");
  if (!res.ok) throw new ReviewSubmitError("failed");
  return (await res.json()) as ReactionResult;
}

/** The API refuses more than this many ids with a `400`. */
const REACTIONS_PER_REQUEST = 100;

/**
 * Which of these reviews this viewer has voted on.
 *
 * ═══ A SECOND CALL, AND IT MUST NOT BE CACHED IN A SHARED LAYER ═══
 * The public reviews response is `Cache-Control: public`, so a shared cache can
 * hand one reader's copy to another. The helpful COUNT does not vary by reader;
 * "did I vote on this" does. Putting the vote on the cacheable response would
 * show one shopper another's votes, which is why it lives here instead.
 *
 * SIGNED OUT IS A `200` WITH AN EMPTY MAP, NOT A `401` — reading a product page
 * signed out is not an error, and a client handling 401 here has the wrong
 * contract. An absent key means no vote; only voted reviews appear.
 *
 * A failure costs the filled state of a button and never the page, so this
 * answers `{}` rather than throwing.
 */
export async function myReactions(
  reviewIds: string[],
): Promise<Record<string, ReactionKind>> {
  if (reviewIds.length === 0) return {};

  const out: Record<string, ReactionKind> = {};
  for (let i = 0; i < reviewIds.length; i += REACTIONS_PER_REQUEST) {
    const batch = reviewIds.slice(i, i + REACTIONS_PER_REQUEST);
    const url = new URL(`${COMMERCE_API_BASE}/api/shop/reviews/reactions/mine`);
    url.searchParams.set("reviews", batch.join(","));
    try {
      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) continue;
      const body = (await res.json()) as { reactions?: Record<string, ReactionKind> };
      Object.assign(out, body.reactions ?? {});
    } catch {
      /* One batch failing costs those buttons their filled state, not the rest. */
    }
  }
  return out;
}

/**
 * What one shopper may do with reviews on a product.
 *
 * `canReview` is "has bought it"; `hasReviewed` is "has already used their
 * one". They are separate because they are different sentences to say to
 * somebody, and a page that collapses them tells half of its readers the wrong
 * one.
 */
export interface ProductEligibility {
  canReview: boolean;
  hasReviewed: boolean;
}

/**
 * WHAT THIS SHOPPER MAY REVIEW — the read a product page gates its form on.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * PER-VIEWER, CREDENTIALED, AND NOT ON THE PUBLIC ROUTER — for exactly the
 * reason `myReactions` is not. The public reviews response is
 * `Cache-Control: public`, so a shared cache can hand one reader's copy to
 * another; "have I bought this" is one shopper's purchase history and must
 * never ride on a response another shopper can be served.
 *
 * ═══ IT FAILS OPEN, WHICH IS THE WHOLE DESIGN ═══
 * An unreadable answer is `{}`, and an absent slug means DO NOT BLOCK. That is
 * not defensive habit, it is what lets this ship before the API does: on the
 * live API today this path falls through to the staff `/reviews/:id` route and
 * answers `401`, so every reader would otherwise lose the form. Fail-open
 * leaves the page exactly as it is until the admin side merges, at which point
 * the gate starts working with no deploy here.
 *
 * The cost of being wrong is asymmetric and points the same way: fail-open
 * shows a form the API then refuses — one wasted attempt, with copy that now
 * explains it. Fail-closed silently removes reviewing from a working shop.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Batched on `BULK_LIMIT` deliberately: the API copied the aggregates route's
 * ceiling so that a page asking both about the same grid cannot have one call
 * succeed and the other refuse it.
 */
export async function reviewEligibility(
  productSlugs: readonly string[],
): Promise<Record<string, ProductEligibility>> {
  const wanted = [...new Set(productSlugs)].filter((slug) => slug.length > 0);
  if (wanted.length === 0) return {};

  const out: Record<string, ProductEligibility> = {};
  for (let i = 0; i < wanted.length; i += BULK_LIMIT) {
    const batch = wanted.slice(i, i + BULK_LIMIT);
    const url = new URL(`${COMMERCE_API_BASE}/api/shop/reviews/eligibility`);
    url.searchParams.set("products", batch.join(","));
    try {
      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) continue;
      const body = (await res.json()) as { eligible?: Record<string, ProductEligibility> };
      Object.assign(out, body.eligible ?? {});
    } catch {
      /* One batch failing leaves those slugs absent, which reads as "do not
         block". See the header. */
    }
  }
  return out;
}

/**
 * The API's names for its two review refusals, mapped to this client's.
 *
 * `reason` IS THE KEY, NOT `error`. A refused mutation answers
 * `{"error":"forbidden","reason":"already_reviewed"}` — `error` stays
 * `forbidden` for both, so branching on it tells the two apart never.
 *
 * AN UNKNOWN REASON IS STILL A PLAIN REFUSAL. The API may grow a third rule
 * before this file hears about it, and a shopper meeting it should see the
 * generic refusal rather than a crash or, worse, the wrong explanation.
 */
const FORBIDDEN_REASONS: Record<string, SubmitError | undefined> = {
  already_reviewed: "already-reviewed",
  purchase_required: "purchase-required",
  review_link_invalid: "review-link-invalid",
};

/**
 * Which refusal a 403 is.
 *
 * THE BODY IS NOT GUARANTEED TO BE JSON — a proxy or an edge error can answer
 * 403 with HTML, and `res.json()` throws on it. That must not escape a submit
 * handler as a TypeError, so the parse is guarded and an unreadable body is
 * simply a refusal with no reason given.
 */
async function forbiddenReason(res: Response): Promise<SubmitError> {
  const body = (await res.json().catch(() => ({}))) as { reason?: string };
  const mapped = body.reason ? FORBIDDEN_REASONS[body.reason] : undefined;
  return mapped ?? "rejected";
}

/**
 * Which `400` a submission is. `detail` names the field, and two of them are
 * things the customer can fix from the form — so they get their own message
 * rather than the old blanket "invalid", which told a nameless account to
 * "check the fields" when there was no field to check.
 */
async function badRequestKind(res: Response): Promise<SubmitError> {
  const body = (await res.json().catch(() => ({}))) as { detail?: string };
  if (body.detail === "authorName") return "author-name";
  if (body.detail === "photoIds") return "photo-ids";
  return "invalid";
}

export async function submitReview(input: SubmitReviewInput): Promise<SubmitReviewResult> {
  const authorName = input.authorName?.trim();
  let res: Response;
  try {
    res = await fetch(`${COMMERCE_API_BASE}/api/shop/reviews/submit`, {
      method: "POST",
      /* THE COOKIE IS THE AUTHOR. This call sent no credentials at all, which
         was harmless while the author was typed into the body and is a 401 on
         every submission now. Cross-site, like the cart's — see the header on
         `cart-api.ts` for why the API sets `SameSite=None`. */
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        productSlug: input.productSlug,
        rating: input.rating,
        /* The API takes `title` as optional and rejects an empty string, so
           an untouched field is omitted rather than sent blank. */
        ...(input.title.trim() ? { title: input.title.trim() } : {}),
        body: input.body.trim(),
        ...(authorName ? { authorName } : {}),
        ...(input.photoIds && input.photoIds.length > 0 ? { photoIds: input.photoIds } : {}),
        ...(input.reviewLink ? { reviewLink: input.reviewLink } : {}),
      }),
    });
  } catch {
    /* A network error and a CORS refusal are the same TypeError here — the
       browser will not tell a page why a cross-origin request failed. */
    throw new ReviewSubmitError("failed");
  }

  /* SIGNED OUT IS NOT A BROKEN CONNECTION. This fell through to the catch-all,
     whose copy is "check your connection and try again" — said to a shopper
     whose connection is perfect and who has merely been signed out since the
     page loaded. */
  if (res.status === 401) throw new ReviewSubmitError("signed-out");
  if (res.status === 429) throw new ReviewSubmitError("rate-limited");
  if (res.status === 403) throw new ReviewSubmitError(await forbiddenReason(res));
  if (res.status === 400 || res.status === 422) {
    throw new ReviewSubmitError(await badRequestKind(res));
  }
  if (!res.ok) throw new ReviewSubmitError("failed");
  return (await res.json()) as SubmitReviewResult;
}

/* ─── Review photos ─────────────────────────────────────────────────────── */

export type PhotoUploadError =
  | "signed-out"
  | "review-link-invalid"
  /** `400 detail:"file_type"`, or a picture this browser could not decode. */
  | "file-type"
  | "file-too-large"
  /** Missing, empty or damaged. */
  | "file"
  /** Uploads are not configured on that environment. Nobody can fix it here. */
  | "storage"
  | "rate-limited"
  | "failed";

export class ReviewPhotoUploadError extends Error {
  constructor(
    readonly kind: PhotoUploadError,
    /** Seconds, from `retry-after`, when the API sent one. */
    readonly retryAfter: number | null = null,
  ) {
    super(kind);
    this.name = "ReviewPhotoUploadError";
  }
}

export interface UploadedReviewPhoto {
  photoId: string;
  width: number | null;
  height: number | null;
}

const UPLOAD_DETAILS: Record<string, PhotoUploadError | undefined> = {
  file_type: "file-type",
  file_too_large: "file-too-large",
  file: "file",
  storage: "storage",
};

/**
 * Upload ONE photo, before the review exists. The returned id goes into
 * `photoIds` on submit; a photo uploaded and then removed from the form is
 * simply never referenced — there is nothing to delete.
 *
 * NO `content-type` HEADER, on purpose: `FormData` needs the browser to write
 * the multipart boundary, and setting the header by hand drops it.
 *
 * The caller re-encodes first (see `prepareReviewPhoto`) — that is what keeps
 * a phone photo the right way up once the server strips its EXIF.
 */
export async function uploadReviewPhoto(
  photo: Blob,
  options: { reviewLink?: string; filename?: string } = {},
): Promise<UploadedReviewPhoto> {
  const form = new FormData();
  form.append("file", photo, options.filename ?? "photo.jpg");
  if (options.reviewLink) form.append("reviewLink", options.reviewLink);

  let res: Response;
  try {
    res = await fetch(`${COMMERCE_API_BASE}/api/shop/reviews/photos`, {
      method: "POST",
      credentials: "include",
      body: form,
    });
  } catch {
    throw new ReviewPhotoUploadError("failed");
  }

  if (res.status === 401) throw new ReviewPhotoUploadError("signed-out");
  if (res.status === 403) throw new ReviewPhotoUploadError("review-link-invalid");
  if (res.status === 429) {
    const seconds = Number(res.headers?.get("retry-after"));
    throw new ReviewPhotoUploadError(
      "rate-limited",
      Number.isFinite(seconds) && seconds > 0 ? seconds : null,
    );
  }
  if (res.status === 400 || res.status === 413) {
    const body = (await res.json().catch(() => ({}))) as { detail?: string };
    const mapped = body.detail ? UPLOAD_DETAILS[body.detail] : undefined;
    throw new ReviewPhotoUploadError(
      mapped ?? (res.status === 413 ? "file-too-large" : "file"),
    );
  }
  if (!res.ok) throw new ReviewPhotoUploadError("failed");

  const body = (await res.json()) as {
    photoId: string;
    width?: number | null;
    height?: number | null;
  };
  return { photoId: body.photoId, width: body.width ?? null, height: body.height ?? null };
}

/* ─── Review links ──────────────────────────────────────────────────────── */

export interface ReviewLinkProduct {
  slug: string;
  title: string;
  /** Relative to the API origin; read it through `imageUrl()`. */
  imageUrl: string | null;
  reviewed: boolean;
}

export interface ReviewLink {
  orderNumber: string;
  firstName: string | null;
  /** Epoch milliseconds. */
  expiresAt: number;
  products: ReviewLinkProduct[];
}

export type ReviewLinkResult =
  | { kind: "ok"; link: ReviewLink }
  /** Expired, tampered with, or for an unpaid or cancelled order. */
  | { kind: "invalid" }
  /** The API could not be reached. NOT the same sentence as "invalid". */
  | { kind: "failed" };

/**
 * What a review link from the admin covers — the order and its products.
 *
 * ═══ NEVER CACHED, ANYWHERE ═══
 * The API answers `no-store` and so does this: the answer is one customer's
 * order, keyed by a bearer token, and each product's `reviewed` changes the
 * moment they submit. A cached copy would be somebody's order on somebody
 * else's screen, or a form offered for a review already written.
 *
 * NEVER THROWS. A `403` is the link being bad; anything else that is not a
 * `200` is the service being unavailable, and those are different pages — "ask
 * us for a new link" is the wrong thing to tell somebody whose link is fine.
 */
export async function getReviewLink(token: string): Promise<ReviewLinkResult> {
  if (!token) return { kind: "invalid" };
  try {
    const url = new URL(`${COMMERCE_API_BASE}/api/shop/reviews/link`);
    url.searchParams.set("token", token);
    const res = await fetch(url, { cache: "no-store" });
    if (res.status === 400 || res.status === 403) return { kind: "invalid" };
    if (!res.ok) return { kind: "failed" };
    const link = (await res.json()) as ReviewLink;
    if (!Array.isArray(link?.products)) return { kind: "failed" };
    return { kind: "ok", link };
  } catch {
    return { kind: "failed" };
  }
}
