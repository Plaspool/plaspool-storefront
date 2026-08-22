import { afterEach, describe, expect, it, vi } from "vitest";
import { ReturnRequestError, listMyReturns, requestReturn } from "./returns-api";

const INPUT = {
  qtyDeclared: 4,
  phone: "08030000000",
  pickupAddress: "1 Test Road",
  serviceAreaId: "msa_1",
};

function reply(status: number, body: unknown) {
  globalThis.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status }),
  ) as unknown as typeof fetch;
}

afterEach(() => vi.restoreAllMocks());

it("reads never throw — a marketing outage costs a section, not a page", async () => {
  globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("boom")) as unknown as typeof fetch;
  expect(await listMyReturns()).toBeNull();
});

it("carries `min` off a below_minimum refusal so the copy can interpolate it", async () => {
  reply(400, { error: "below_minimum", min: 4 });
  await expect(requestReturn(INPUT)).rejects.toMatchObject({
    reason: "below-minimum",
    min: 4,
  });
});

it("carries the served list off an outside_service_area refusal", async () => {
  reply(409, { error: "outside_service_area", served: ["Utako", "Wuse 2"] });
  await expect(requestReturn(INPUT)).rejects.toMatchObject({
    reason: "outside-area",
    served: ["Utako", "Wuse 2"],
  });
});

it("carries the existing id off already_open, so the form can link to it", async () => {
  reply(409, { error: "return_already_open", existingId: "mrr_1", status: "scheduled" });
  await expect(requestReturn(INPUT)).rejects.toMatchObject({
    reason: "already-open",
    existingId: "mrr_1",
  });
});

it("maps program_type_mismatch to the same paused copy — the API says nothing about why", async () => {
  // The admin can answer this on a 409; it was reachable and unmapped, which
  // degraded to `placeError`'s generic "failed" — naming a connection problem
  // the shopper does not have. `programme-paused` is the honest sentence
  // either way, since this file learns nothing more about WHY from the API.
  reply(409, { error: "program_type_mismatch" });
  await expect(requestReturn(INPUT)).rejects.toMatchObject({ reason: "programme-paused" });
});

it("maps a 401 to `unauthenticated`, which is a sign-in prompt and not an error", async () => {
  reply(401, { error: "unauthenticated" });
  await expect(requestReturn(INPUT)).rejects.toMatchObject({ reason: "unauthenticated" });
});

it("maps a network failure and a CORS refusal alike to `failed`", async () => {
  globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("boom")) as unknown as typeof fetch;
  await expect(requestReturn(INPUT)).rejects.toMatchObject({ reason: "failed" });
});
