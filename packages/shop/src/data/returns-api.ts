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

/** The API's error vocabulary, mapped to this form's. One place, so a renamed
 *  code is a compile error here rather than a silent "failed" on screen. */
const REASONS: Record<string, ReturnFailure> = {
  below_minimum: "below-minimum",
  outside_service_area: "outside-area",
  return_already_open: "already-open",
  program_paused: "programme-paused",
};

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
  const reason = body.error ? REASONS[body.error] : undefined;
  if (reason) {
    throw new ReturnRequestError(reason, {
      min: body.min, served: body.served, existingId: body.existingId,
    });
  }
  throw new ReturnRequestError(res.status === 400 ? "invalid" : "failed");
}
