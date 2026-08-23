import { COMMERCE_API_BASE, MARKETING_REVALIDATE } from "./config";

/**
 * Asking for a return, and reading your own back.
 *
 *   GET  /api/public/marketing/areas
 *   POST /api/marketing/me/returns
 *   GET  /api/marketing/me/returns
 *
 * THE TWO READS NEVER THROW; THE WRITE ALWAYS DOES. The same split `reviews.ts`
 * makes, for the same reason: a section that cannot load is an absent section,
 * but a submission that failed is something the shopper must be told, and the
 * REASON decides which field the message lands beside.
 *
 * NO POINTS OR UNIT NOUN IS SPELLED IN THIS FILE, and none can be — the words
 * arrive with the confirmation. `data/marketing.ts` sets out why that is a rule.
 *
 * CROSS-SITE with `credentials: "include"` on the two `/me/` calls, which is what
 * makes `access-control-allow-credentials` on the API side load-bearing.
 */

export interface ServiceArea {
  id: string;
  region: string;
  name: string;
}

export interface MyReturn {
  id: string;
  status: string;
  qtyDeclared: number;
  qtyAccepted: number | null;
  pointsAwarded: number | null;
  pickupScheduledAt: number | null;
  driverName: string | null;
  createdAt: number;
  /**
   * `customerName`, `customerPhone`, `pickupAddress` AND `serviceAreaId` —
   * added by `plaspool-admin@a811cc9` so `return-form.tsx` can prefill a
   * shopper's own fields from their most recent request instead of asking
   * them to retype what they already told the returns desk. This is the
   * shopper's OWN data, on a route that already derives identity from their
   * session and can only ever answer that identity's rows.
   *
   * STILL NOT `driverPhone` AND NOT `revision` — that exclusion has not
   * moved. A shopper is told who is coming, not how to ring them directly,
   * and a revision is a concurrency token for a screen that can write, which
   * this one cannot.
   */
  customerName: string | null;
  customerPhone: string | null;
  pickupAddress: string | null;
  serviceAreaId: string | null;
}

export interface ReturnConfirmation {
  requestId: string;
  qtyDeclared: number;
  program: {
    name: string;
    pointsLabelSingular: string;
    pointsLabelPlural: string;
    unitLabelSingular: string;
    unitLabelPlural: string;
    pointsPerUnit: number;
    minUnitsPerReturn: number;
  };
}

export type ReturnFailure =
  | "unauthenticated"
  | "below-minimum"
  | "outside-area"
  | "already-open"
  | "programme-paused"
  | "rate-limited"
  | "invalid"
  | "failed";

/** A refusal the form can act on, rather than a string it can only print. */
export class ReturnRequestError extends Error {
  constructor(
    readonly reason: ReturnFailure,
    readonly detail: { min?: number; served?: string[]; existingId?: string } = {},
  ) {
    super(reason);
    this.name = "ReturnRequestError";
  }
  get min() { return this.detail.min; }
  get served() { return this.detail.served; }
  get existingId() { return this.detail.existingId; }
}

export async function listServiceAreas(): Promise<ServiceArea[] | null> {
  try {
    const res = await fetch(`${COMMERCE_API_BASE}/api/public/marketing/areas`, {
      next: { revalidate: MARKETING_REVALIDATE },
    });
    if (!res.ok) return null;
    return ((await res.json()) as { areas: ServiceArea[] }).areas;
  } catch {
    return null;
  }
}

export async function listMyReturns(): Promise<MyReturn[] | null> {
  try {
    const res = await fetch(`${COMMERCE_API_BASE}/api/marketing/me/returns`, {
      credentials: "include",
    });
    // A 401 is the ordinary answer for a guest, not an exception.
    if (!res.ok) return null;
    return ((await res.json()) as { items: MyReturn[] }).items;
  } catch {
    return null;
  }
}

export interface RequestReturnInput {
  qtyDeclared: number;
  phone: string;
  pickupAddress: string;
  serviceAreaId: string;
  name?: string;
}

/** The admin's own codes for this endpoint's refusals
 *  (`server/marketing/returns/customer.ts` in the admin repo). A closed union
 *  rather than `string` — see `REASONS`'s own comment for exactly what that
 *  buys and what it does not. */
type ReturnErrorCode =
  | "below_minimum"
  | "outside_service_area"
  | "return_already_open"
  | "program_paused"
  | "program_type_mismatch";

/**
 * The API's error vocabulary, mapped to this form's.
 *
 * ═══ WHAT "ONE PLACE" ACTUALLY BUYS — CORRECTED ═══
 * This used to claim a renamed code becomes "a compile error here". It does
 * not, and cannot: the two repos share no types package, so nothing on this
 * side can see an admin-side rename at compile time. That gap is exactly how
 * `program_type_mismatch` shipped on the admin, was never added below, and
 * degraded silently to `placeError`'s generic "failed" — the wrong cause,
 * naming a connection problem the shopper does not have.
 *
 * What the closed-union key type above DOES buy: within THIS file, forgetting,
 * duplicating, or misspelling a key below is a compile error, because
 * `Record<ReturnErrorCode, ReturnFailure>` requires every member of the union
 * and rejects any other. That catches a mistake made here. It does not, and
 * cannot, catch a code the admin ships that this union has not been told
 * about — that is still a silent "failed" on screen until a human updates
 * `ReturnErrorCode` to match, exactly as before this file's key type was
 * narrowed.
 */
const REASONS: Record<ReturnErrorCode, ReturnFailure> = {
  below_minimum: "below-minimum",
  outside_service_area: "outside-area",
  return_already_open: "already-open",
  program_paused: "programme-paused",
  /* The API tells the storefront nothing about WHY a programme is closed —
     `programme-paused`'s copy is already the honest sentence for that, and
     the only one this form can send either way. */
  program_type_mismatch: "programme-paused",
};

/** So `REASONS` can be indexed by a runtime string safely. The union above
 *  has no index signature, on purpose — that omission is what makes the
 *  object literal itself exhaustively checked. */
function isReturnErrorCode(code: string): code is ReturnErrorCode {
  return Object.prototype.hasOwnProperty.call(REASONS, code);
}

export async function requestReturn(input: RequestReturnInput): Promise<ReturnConfirmation> {
  let res: Response;
  try {
    res = await fetch(`${COMMERCE_API_BASE}/api/marketing/me/returns`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    /* A network error and a CORS refusal are the same TypeError here — the
       browser will not tell a page why a cross-origin request failed. */
    throw new ReturnRequestError("failed");
  }

  if (res.ok) return (await res.json()) as ReturnConfirmation;
  if (res.status === 401) throw new ReturnRequestError("unauthenticated");
  if (res.status === 429) throw new ReturnRequestError("rate-limited");

  const body = (await res.json().catch(() => ({}))) as {
    error?: string; min?: number; served?: string[]; existingId?: string;
  };
  let reason: ReturnFailure | undefined;
  if (body.error && isReturnErrorCode(body.error)) {
    reason = REASONS[body.error];
  }
  if (reason) {
    throw new ReturnRequestError(reason, {
      min: body.min, served: body.served, existingId: body.existingId,
    });
  }
  throw new ReturnRequestError(res.status === 400 ? "invalid" : "failed");
}
