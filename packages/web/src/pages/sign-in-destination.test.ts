import { describe, expect, it } from "vitest";

import {
  DEFAULT_DESTINATION,
  bridgeCallbackUrl,
  isBridgeReturn,
  safeDestination,
} from "./sign-in-destination";

/**
 * The two rules that decide where a sign-in ends up, kept pure so they are
 * provable without a DOM — the same reason `isOwnEntry` is exported out of
 * `returns-cta.tsx`.
 *
 * THE BUG THESE PIN. `callbackURL` used to be the destination itself, so
 * Google returned the shopper straight to `/returns` — a page that does not
 * run the Neon → shop bridge. They arrived with a Neon session, no
 * `__Host-shop_session`, and every session probe on the site called them a
 * guest. `bridgeCallbackUrl` is what puts the one bridging page back in the
 * middle of that round trip without losing where they were going.
 */

describe("safeDestination", () => {
  it("keeps a same-site path", () => {
    expect(safeDestination("/returns")).toBe("/returns");
    expect(safeDestination("/store/products/pla-filament")).toBe(
      "/store/products/pla-filament",
    );
  });

  it("keeps a path's query and fragment", () => {
    expect(safeDestination("/store?colour=black#grid")).toBe("/store?colour=black#grid");
  });

  it("falls back to the store when there is no destination", () => {
    expect(safeDestination(null)).toBe(DEFAULT_DESTINATION);
    expect(safeDestination(undefined)).toBe(DEFAULT_DESTINATION);
    expect(safeDestination("")).toBe(DEFAULT_DESTINATION);
    expect(DEFAULT_DESTINATION).toBe("/store");
  });

  /* An open redirect off the back of a real sign-in: `next` arrives in a URL
     anybody can hand somebody else. */
  it("refuses anything that leaves this origin", () => {
    expect(safeDestination("https://evil.example")).toBe(DEFAULT_DESTINATION);
    expect(safeDestination("//evil.example")).toBe(DEFAULT_DESTINATION);
    expect(safeDestination("/\\evil.example")).toBe(DEFAULT_DESTINATION);
    expect(safeDestination("javascript:alert(1)")).toBe(DEFAULT_DESTINATION);
    expect(safeDestination("store")).toBe(DEFAULT_DESTINATION);
  });

  /* Whitespace and control characters are how `//` gets smuggled past a
     naive prefix test — browsers strip them before resolving. */
  it("refuses a path dressed up with leading or embedded control characters", () => {
    expect(safeDestination("  //evil.example")).toBe(DEFAULT_DESTINATION);
    expect(safeDestination("/\nhttps://evil.example")).toBe(DEFAULT_DESTINATION);
    expect(safeDestination("/\tstore")).toBe(DEFAULT_DESTINATION);
  });

  /* THE LOOP GUARD. `/sign-in` forwarding to `/sign-in` is the dead end this
     whole change exists to remove, and a bookmarked `?next=/sign-in` would
     rebuild it. */
  it("refuses to send a signed-in shopper back to the sign-in page", () => {
    expect(safeDestination("/sign-in")).toBe(DEFAULT_DESTINATION);
    expect(safeDestination("/sign-in?next=%2Fstore")).toBe(DEFAULT_DESTINATION);
    expect(safeDestination("/sign-in/anything")).toBe(DEFAULT_DESTINATION);
  });

  it("does not mistake a path that merely starts with the same letters", () => {
    expect(safeDestination("/sign-in-help")).toBe("/sign-in-help");
  });
});

describe("bridgeCallbackUrl", () => {
  /* The fix, in one assertion: Neon Auth is sent back to the ONE page that
     runs the bridge, carrying where the shopper was actually going. */
  it("routes the round trip through the bridging page, destination intact", () => {
    expect(bridgeCallbackUrl("/returns")).toBe("/sign-in?next=%2Freturns&bridge=1");
  });

  it("encodes a destination that carries its own query", () => {
    expect(bridgeCallbackUrl("/store?colour=black")).toBe(
      "/sign-in?next=%2Fstore%3Fcolour%3Dblack&bridge=1",
    );
  });

  it("sanitises before it encodes, so a hostile `next` cannot survive the trip", () => {
    expect(bridgeCallbackUrl("https://evil.example")).toBe(
      "/sign-in?next=%2Fstore&bridge=1",
    );
  });

  /* The round trip has to survive its own output — the returning page reads
     back what this wrote. */
  it("produces a URL the returning page recognises as the tail of a sign-in", () => {
    const callback = bridgeCallbackUrl("/returns");
    const search = callback.slice(callback.indexOf("?"));
    expect(isBridgeReturn(search)).toBe(true);
    expect(safeDestination(new URLSearchParams(search).get("next"))).toBe("/returns");
  });
});

describe("isBridgeReturn", () => {
  it("is false on the outbound leg, where the same `next` is present", () => {
    expect(isBridgeReturn("?next=%2Freturns")).toBe(false);
    expect(isBridgeReturn("")).toBe(false);
    expect(isBridgeReturn("?bridge=0")).toBe(false);
  });

  it("is true only for the flag this module writes", () => {
    expect(isBridgeReturn("?bridge=1")).toBe(true);
    expect(isBridgeReturn("?next=%2Fstore&bridge=1")).toBe(true);
  });
});
