import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NO_PLACES,
  citiesFor,
  offeredStates,
  parseDeliveryPlaces,
  readDeliveryPlaces,
  type DeliveryPlaces,
} from "./delivery-places";
import { NIGERIAN_STATES } from "./nigerian-states";

/**
 * The courier's place list.
 *
 * WHAT THESE ARE ABOUT. This response decides which states the checkout
 * OFFERS, and the one thing it must never decide is what a chosen state is
 * CALLED — the courier spells the capital `FCT`, the shop's areas and delivery
 * zones spell it `Federal Capital Territory`, and storing the courier's
 * spelling silently drops the district picker that sets the delivery price.
 * The reconciliation tests below are the ones that are about money.
 *
 * The second theme is that EMPTY MEANS "NO CONSTRAINT". Every documented
 * failure of this route — no cache, unknown country, manual shipping — answers
 * `regions: []`, and a checkout that read that as an error could not take an
 * order at all.
 */

/** The live body, read from production on 2026-09-09, trimmed to the states
 *  that matter here. Note the last one. */
const LIVE = {
  country: "NG",
  provider: "fez",
  updatedAt: 1788914144406,
  regions: [
    { code: "2", name: "Lagos" },
    { code: "1", name: "Kano" },
    { code: "37", name: "FCT" },
  ],
  cities: null,
};

describe("parseDeliveryPlaces", () => {
  it("reads the live body", () => {
    const places = parseDeliveryPlaces(LIVE);
    expect(places.provider).toBe("fez");
    expect(places.country).toBe("NG");
    expect(places.regions).toHaveLength(3);
    expect(places.cities).toBeNull();
  });

  it("is NO_PLACES for a body that is not a body", () => {
    expect(parseDeliveryPlaces(null)).toEqual(NO_PLACES);
    expect(parseDeliveryPlaces("nope")).toEqual(NO_PLACES);
    expect(parseDeliveryPlaces([])).toEqual(NO_PLACES);
  });

  it("keeps an empty region list rather than inventing one", () => {
    // The documented answer for "no cache yet" / "shipping by hand".
    const places = parseDeliveryPlaces({ country: "NG", provider: "manual", regions: [] });
    expect(places.regions).toEqual([]);
    expect(places.provider).toBe("manual");
  });

  it("drops a region with no name and survives a malformed one", () => {
    const places = parseDeliveryPlaces({
      regions: [{ code: "1", name: "Lagos" }, { code: "2" }, null, "Kano"],
    });
    expect(places.regions).toEqual([{ code: "1", name: "Lagos" }]);
  });

  it("tolerates a region with no code — only the name is read", () => {
    expect(parseDeliveryPlaces({ regions: [{ name: "Lagos" }] }).regions).toEqual([
      { code: "", name: "Lagos" },
    ]);
  });

  it("uppercases the country", () => {
    expect(parseDeliveryPlaces({ country: "ng", regions: [] }).country).toBe("NG");
  });

  /* ═══ `null` IS NOT `{}` ═══ */
  it("distinguishes cities null from cities empty", () => {
    expect(parseDeliveryPlaces({ regions: [], cities: null }).cities).toBeNull();
    expect(parseDeliveryPlaces({ regions: [], cities: {} }).cities).toEqual({});
  });

  it("treats a malformed cities map as null, the permissive answer", () => {
    // A bad body must not be able to lock a shopper out of their own city.
    expect(parseDeliveryPlaces({ regions: [], cities: "Lagos" }).cities).toBeNull();
    expect(parseDeliveryPlaces({ regions: [], cities: 7 }).cities).toBeNull();
  });

  it("reads a populated cities map, as a Terminal shop would send", () => {
    const places = parseDeliveryPlaces({
      regions: [{ code: "1", name: "Lagos" }],
      cities: { Lagos: ["Ikeja", "Lekki", 4], Kano: [] },
    });
    expect(places.cities).toEqual({ Lagos: ["Ikeja", "Lekki"], Kano: [] });
  });
});

describe("offeredStates — the reconciliation", () => {
  /* ═══ THE MONEY TEST ═══
     Fez says "FCT". The areas list and the delivery zones say "Federal
     Capital Territory". What the select stores has to be the latter, or the
     capital's district picker disappears and the order prices at the
     catch-all state rate. */
  it("stores the shop's canonical name, not the courier's", () => {
    const offered = offeredStates(parseDeliveryPlaces(LIVE));
    const names = offered.map((state) => state.name);
    expect(names).toContain("Federal Capital Territory");
    expect(names).not.toContain("FCT");
  });

  it("offers exactly the states the courier named", () => {
    const offered = offeredStates(parseDeliveryPlaces(LIVE));
    expect(offered.map((state) => state.name)).toEqual([
      "Federal Capital Territory",
      "Kano",
      "Lagos",
    ]);
  });

  it("orders them as this repo does, not as the courier sent them", () => {
    // The courier sends its own internal id order — Kano, Lagos, Kaduna — which
    // is not an order anybody scans a select in.
    const offered = offeredStates(parseDeliveryPlaces(LIVE));
    const names = offered.map((state) => state.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("would follow a courier switch without a deploy", () => {
    // Terminal spells the same place "Abuja". Same stored value.
    const terminal = parseDeliveryPlaces({
      provider: "terminal",
      regions: [{ code: "x", name: "Abuja" }, { code: "y", name: "Lagos" }],
    });
    expect(offeredStates(terminal).map((s) => s.name)).toEqual([
      "Federal Capital Territory",
      "Lagos",
    ]);
  });

  /* ═══ EMPTY IS "NO CONSTRAINT" ═══ */
  it("offers every state when the server named none", () => {
    expect(offeredStates(NO_PLACES)).toEqual(NIGERIAN_STATES);
    expect(offeredStates(parseDeliveryPlaces({ regions: [] }))).toEqual(NIGERIAN_STATES);
  });

  it("offers every state when nothing the server named could be reconciled", () => {
    // A list this storefront cannot read is a reason to constrain nothing —
    // never a reason to render a select nobody can complete.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const places = parseDeliveryPlaces({ regions: [{ code: "1", name: "Atlantis" }] });
    expect(offeredStates(places)).toEqual(NIGERIAN_STATES);
    warn.mockRestore();
  });

  it("drops a single unrecognised name rather than offering it verbatim", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const places = parseDeliveryPlaces({
      regions: [{ code: "1", name: "Lagos" }, { code: "2", name: "Atlantis" }],
    });
    expect(offeredStates(places).map((s) => s.name)).toEqual(["Lagos"]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("does not offer the same state twice when the courier lists it twice", () => {
    const places = parseDeliveryPlaces({
      regions: [
        { code: "1", name: "FCT" },
        { code: "2", name: "Abuja" },
        { code: "3", name: "Lagos" },
      ],
    });
    expect(offeredStates(places).map((s) => s.name)).toEqual([
      "Federal Capital Territory",
      "Lagos",
    ]);
  });
});

describe("citiesFor", () => {
  const withCities = (cities: Record<string, string[]> | null): DeliveryPlaces =>
    parseDeliveryPlaces({ regions: [{ code: "1", name: "Lagos" }], cities });

  it("is null for every region while the courier enforces no city list", () => {
    expect(citiesFor(withCities(null), "Lagos")).toBeNull();
    expect(citiesFor(withCities(null), "anywhere at all")).toBeNull();
  });

  it("returns the region's list when the courier does enforce one", () => {
    expect(citiesFor(withCities({ Lagos: ["Ikeja", "Lekki"] }), "Lagos")).toEqual([
      "Ikeja",
      "Lekki",
    ]);
  });

  it("matches the region by folded name, so canonical spelling still finds it", () => {
    const places = withCities({ "federal capital territory": ["Wuse"] });
    expect(citiesFor(places, "Federal Capital Territory")).toEqual(["Wuse"]);
  });

  it("is an empty list, not null, for a region the map does not mention", () => {
    // The distinction the whole `cities === null` rule turns on: a courier
    // that enforces cities and lists none here accepts none here.
    expect(citiesFor(withCities({ Lagos: ["Ikeja"] }), "Kano")).toEqual([]);
  });
});

describe("readDeliveryPlaces", () => {
  afterEach(() => vi.restoreAllMocks());

  it("sends a simple request — no headers, no credentials", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => LIVE });
    await readDeliveryPlaces("ng", fetchImpl as unknown as typeof fetch);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toContain("/api/public/shop/delivery-places?country=NG");
    expect(init).not.toHaveProperty("headers");
    expect(init).not.toHaveProperty("credentials");
  });

  it("falls back to NO_PLACES on a non-2xx", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    await expect(readDeliveryPlaces("NG", fetchImpl as unknown as typeof fetch)).resolves.toEqual(
      NO_PLACES,
    );
  });

  it("falls back to NO_PLACES when the fetch rejects — the localhost CORS case", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(readDeliveryPlaces("NG", fetchImpl as unknown as typeof fetch)).resolves.toEqual(
      NO_PLACES,
    );
  });

  it("falls back to NO_PLACES on a body that is not JSON", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError("Unexpected token <");
      },
    });
    await expect(readDeliveryPlaces("NG", fetchImpl as unknown as typeof fetch)).resolves.toEqual(
      NO_PLACES,
    );
  });
});
