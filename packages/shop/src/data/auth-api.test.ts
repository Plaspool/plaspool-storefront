import { afterEach, expect, it, vi } from "vitest";
import { completeSignIn, readShopSession, signOutEverywhere } from "./auth-api";

/**
 * The storefront's half of the Clerk → admin handshake.
 *
 * ═══ WHY THIS FILE HAS TO EXIST ═══
 * None of this can be exercised in a browser on `localhost`: the commerce API
 * sends no `Access-Control-Allow-Origin` for `http://localhost:3000`, so every
 * credentialed call here is refused before it leaves the page (CLAUDE.md, "The
 * cart and the account CANNOT be exercised on localhost"). Vitest is therefore
 * not the cheap check — it is the ONLY check these branches get before they are
 * in front of customers.
 */

/** Answer the bridge (same-origin) and the exchange (cross-origin) separately. */
function routes(bridge: Response | Error, exchange?: Response | Error) {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const pick = url.startsWith("/api/auth/bridge") ? bridge : exchange;
    if (pick instanceof Error) throw pick;
    return pick ?? new Response("{}", { status: 200 });
  }) as unknown as typeof fetch;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

afterEach(() => vi.restoreAllMocks());

it("mints and exchanges in that order, and reports success", async () => {
  routes(json(200, { assertion: "payload.mac" }), json(200, { ok: true }));
  expect(await completeSignIn()).toEqual({ ok: true });

  const calls = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
  expect(String(calls[0][0])).toBe("/api/auth/bridge");
  expect(String(calls[1][0])).toContain("/api/shop/customer/session/exchange");
  /* Without `credentials: "include"` the browser drops the admin's
     `Set-Cookie` silently and the shopper stays a guest with nothing anywhere
     saying why. This is the assertion that keeps that from regressing. */
  expect(calls[1][1]).toMatchObject({ credentials: "include" });
});

it("a 401 from the bridge is `no_session`, not a network error", async () => {
  routes(json(401, { error: "unauthorized" }));
  expect(await completeSignIn()).toEqual({ ok: false, reason: "no_session" });
});

it("a 501 is `not_configured`, so an unconfigured deploy explains itself", async () => {
  routes(json(501, { error: "not_implemented" }));
  expect(await completeSignIn()).toEqual({ ok: false, reason: "not_configured" });
});

it("an unverified email is refused before an assertion is ever minted", async () => {
  routes(json(403, { error: "forbidden", detail: "email_unverified" }));
  expect(await completeSignIn()).toEqual({ ok: false, reason: "email_unverified" });
});

/**
 * ═══ THE REGRESSION THIS PINS ═══
 * The admin deliberately separates `assertion_expired` (the 60-second window
 * closed — actionable, just go again) from `assertion` (replayed or forged —
 * nothing to be done). Both arrive as a 400. Collapsing them told a shopper on
 * a slow connection they had reused a link they had never used.
 */
it("distinguishes an expired assertion from a replayed one", async () => {
  routes(json(200, { assertion: "a.b" }), json(400, { detail: "assertion_expired" }));
  expect(await completeSignIn()).toEqual({ ok: false, reason: "assertion_expired" });

  routes(json(200, { assertion: "a.b" }), json(400, { detail: "assertion" }));
  expect(await completeSignIn()).toEqual({ ok: false, reason: "assertion" });

  /* A 400 with no body at all must still be a named refusal, not a crash. */
  routes(json(200, { assertion: "a.b" }), new Response("", { status: 400 }));
  expect(await completeSignIn()).toEqual({ ok: false, reason: "assertion" });
});

it("a transport failure on either leg is `network`, never a throw", async () => {
  routes(new TypeError("offline"));
  expect(await completeSignIn()).toEqual({ ok: false, reason: "network" });

  routes(json(200, { assertion: "a.b" }), new TypeError("offline"));
  expect(await completeSignIn()).toEqual({ ok: false, reason: "network" });
});

/**
 * `unknown` is the state a header needs in order to say NOTHING rather than to
 * say something false. Collapsing it to `guest` told signed-in shoppers they
 * were signed out whenever the connection wobbled.
 */
it("keeps `we could not ask` distinct from `nobody is signed in`", async () => {
  globalThis.fetch = vi.fn().mockResolvedValue(json(200, { customer: null })) as never;
  expect(await readShopSession()).toEqual({ kind: "guest" });

  globalThis.fetch = vi.fn().mockResolvedValue(json(500, {})) as never;
  expect(await readShopSession()).toEqual({ kind: "unknown" });

  globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("offline")) as never;
  expect(await readShopSession()).toEqual({ kind: "unknown" });
});

/**
 * ═══ THE ORDER IS THE WHOLE POINT ═══
 * Clearing `__Host-shop_session` first leaves a live Clerk session behind, and
 * the next page load re-bridges from it — a logout that does not log out, and
 * one that reads as a caching bug rather than an auth bug.
 */
it("signs out of the identity provider BEFORE the shop", async () => {
  const seen: string[] = [];
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    seen.push(String(input));
    return json(200, { ok: true });
  }) as unknown as typeof fetch;

  await signOutEverywhere();

  expect(seen[0]).toBe("/api/auth/sign-out");
  expect(seen[1]).toContain("/api/shop/customer/logout");
});

it("still clears the shop session when the provider sign-out fails", async () => {
  const seen: string[] = [];
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    seen.push(url);
    if (url === "/api/auth/sign-out") throw new TypeError("offline");
    return json(200, { ok: true });
  }) as unknown as typeof fetch;

  await expect(signOutEverywhere()).resolves.toBeUndefined();
  /* Substring, not membership: the shop leg is an absolute URL onto
     `COMMERCE_API_BASE`, whereas the provider leg is same-origin. */
  expect(seen.some((url) => url.includes("/api/shop/customer/logout"))).toBe(true);
});
