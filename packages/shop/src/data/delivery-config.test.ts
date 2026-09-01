import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DISTRICT_FALLBACK,
  parseDeliveryConfig,
  readDeliveryConfig,
  type DeliveryConfig,
} from "./delivery-config";

/**
 * The delivery config — the server's description of the address form.
 *
 * WHAT THESE ARE ABOUT. This response decides what the checkout ASKS FOR, so
 * every failure mode here is a form that asks the shopper for the wrong thing:
 * a field the server will refuse, a field the server needs and never got, or a
 * required picker with nothing in it.
 *
 * The response is also SHARED-CACHED for 60s, which means a storefront can be
 * holding a config the server has already moved on from. Nothing here may
 * depend on the config being current — only on it being well-formed.
 */

/** A `simple` payload as the spec documents it, used where the mode matters
 *  more than the individual fields. */
const SIMPLE_PAYLOAD = {
  config: {
    mode: "simple",
    revision: 8,
    country: { default: "NG", allowed: ["NG"], locked: true },
    fields: [
      { key: "name", show: true, required: true, label: "Full name", maxLength: 200 },
      { key: "region", show: true, required: true, label: "State", maxLength: 120 },
      { key: "city", show: true, required: true, label: "Town or city", maxLength: 120 },
      {
        key: "line1",
        show: true,
        required: true,
        label: "Address",
        maxLength: 200,
        help: "House number, street, and the nearest landmark.",
      },
      { key: "district", show: false, required: false },
      { key: "postalCode", show: false, required: false },
    ],
    districts: null,
    location: {
      offer: true,
      required: false,
      label: "Use my current location",
      maxAccuracyMeters: 500,
      pricing: false,
    },
    servedRegions: null,
  },
};

const stubFetch = (impl: () => Promise<unknown>) => {
  vi.stubGlobal("fetch", vi.fn(impl));
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the district fallback", () => {
  /* ═══ THIS IS THE FORM THAT IS ON SCREEN TODAY ═══
     Not the spec document's example payload, which differs from this
     storefront in every label and in the field order. The whole point of the
     switch being off is that a shopper cannot tell the config exists, so the
     fallback has to be what `checkout-flow.tsx` renders right now. */
  it("lists today's fields in today's order", () => {
    expect(DISTRICT_FALLBACK.fields.map((f) => f.key)).toEqual([
      "name",
      "phone",
      "line1",
      "line2",
      "city",
      "region",
      "district",
      "postalCode",
    ]);
  });

  it("uses today's labels", () => {
    const labels = Object.fromEntries(DISTRICT_FALLBACK.fields.map((f) => [f.key, f.label]));
    expect(labels).toMatchObject({
      name: "Full name",
      phone: "Phone",
      line1: "Address",
      line2: "Apartment, suite, etc.",
      city: "City",
      region: "State",
      district: "District",
      postalCode: "Postal code",
    });
  });

  it("requires exactly what today's form requires", () => {
    const required = DISTRICT_FALLBACK.fields.filter((f) => f.required).map((f) => f.key);
    // Phone, district and postcode are all optional on screen today. The
    // district especially: a required picker that can have no options is the
    // dead control `checkout-flow.tsx` says it must never become.
    expect(required).toEqual(["name", "line1", "city", "region"]);
  });

  it("shows every field, including the postcode", () => {
    expect(DISTRICT_FALLBACK.fields.every((f) => f.show)).toBe(true);
  });

  it("offers no location button", () => {
    expect(DISTRICT_FALLBACK.location.offer).toBe(false);
  });
});

describe("parsing a well-formed config", () => {
  it("reads the simple mode payload", () => {
    const config = parseDeliveryConfig(SIMPLE_PAYLOAD);
    expect(config.mode).toBe("simple");
    expect(config.revision).toBe(8);
    expect(config.location.offer).toBe(true);
    expect(config.location.maxAccuracyMeters).toBe(500);
  });

  it("keeps the server's field order rather than sorting it", () => {
    expect(parseDeliveryConfig(SIMPLE_PAYLOAD).fields.map((f) => f.key)).toEqual([
      "name",
      "region",
      "city",
      "line1",
      "district",
      "postalCode",
    ]);
  });

  it("carries a field's help text through", () => {
    const line1 = parseDeliveryConfig(SIMPLE_PAYLOAD).fields.find((f) => f.key === "line1");
    expect(line1?.help).toBe("House number, street, and the nearest landmark.");
  });
});

describe("a config from a newer server", () => {
  it("skips a field key it does not know", () => {
    const config = parseDeliveryConfig({
      config: {
        ...SIMPLE_PAYLOAD.config,
        fields: [
          ...SIMPLE_PAYLOAD.config.fields,
          { key: "whatThreeWords", show: true, required: true, label: "What3Words" },
        ],
      },
    });
    expect(config.fields.map((f) => f.key)).not.toContain("whatThreeWords");
    // and the fields it DOES know still arrived
    expect(config.fields.map((f) => f.key)).toContain("line1");
  });

  it("ignores an unknown top-level key", () => {
    const config = parseDeliveryConfig({
      config: { ...SIMPLE_PAYLOAD.config, deliveryWindows: { enabled: true } },
    });
    expect(config.mode).toBe("simple");
  });
});

describe("a config that would break the shipping zone", () => {
  /* The zone — and therefore the tax rate and the delivery price — is derived
     from countryCode + region. A hidden region field is a config that cannot
     be honoured, so it is refused rather than obeyed. */
  it("shows the region anyway when a config hides it, and says so", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const config = parseDeliveryConfig({
      config: {
        ...SIMPLE_PAYLOAD.config,
        fields: SIMPLE_PAYLOAD.config.fields.map((f) =>
          f.key === "region" ? { ...f, show: false, required: false } : f,
        ),
      },
    });
    const region = config.fields.find((f) => f.key === "region");
    expect(region?.show).toBe(true);
    expect(region?.required).toBe(true);
    expect(warn).toHaveBeenCalled();
  });

  it("falls back rather than render a config with no region field at all", () => {
    const config = parseDeliveryConfig({
      config: {
        ...SIMPLE_PAYLOAD.config,
        fields: SIMPLE_PAYLOAD.config.fields.filter((f) => f.key !== "region"),
      },
    });
    expect(config).toEqual(DISTRICT_FALLBACK);
  });
});

describe("a config that is not one", () => {
  it.each([
    ["null", null],
    ["a string", "district"],
    ["an empty object", {}],
    ["a config with no fields array", { config: { mode: "simple", revision: 1 } }],
    ["a config with an unknown mode", { config: { ...SIMPLE_PAYLOAD.config, mode: "postcode" } }],
    ["a config with an empty fields array", { config: { ...SIMPLE_PAYLOAD.config, fields: [] } }],
  ])("falls back to today's form for %s", (_label, raw) => {
    expect(parseDeliveryConfig(raw)).toEqual(DISTRICT_FALLBACK);
  });
});

describe("reading the config over the wire", () => {
  it("returns the server's config when the call succeeds", async () => {
    stubFetch(async () => ({ ok: true, json: async () => SIMPLE_PAYLOAD }));
    await expect(readDeliveryConfig()).resolves.toMatchObject({ mode: "simple" });
  });

  it("asks the public endpoint without credentials", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => SIMPLE_PAYLOAD }));
    vi.stubGlobal("fetch", fetchMock);
    await readDeliveryConfig();

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/api/public/shop/delivery-config");
    // Cookieless by design: it is a shared-cached response and must never
    // carry anything per-viewer. `credentials: "include"` on this call would
    // be the bug that puts a session cookie into a cache key.
    expect(init?.credentials).toBeUndefined();
  });

  it("falls back to today's form when the network refuses", async () => {
    // What actually happens on localhost, where CORS blocks the call. It is
    // also what happens when the API is down mid-checkout.
    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(readDeliveryConfig()).resolves.toEqual(DISTRICT_FALLBACK);
  });

  it("falls back to today's form on a non-2xx", async () => {
    stubFetch(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    await expect(readDeliveryConfig()).resolves.toEqual(DISTRICT_FALLBACK);
  });

  it("falls back to today's form when the body is not JSON", async () => {
    stubFetch(async () => ({
      ok: true,
      json: async () => {
        throw new SyntaxError("Unexpected token <");
      },
    }));
    await expect(readDeliveryConfig()).resolves.toEqual(DISTRICT_FALLBACK);
  });

  /* FAILING TOWARD THE RICHER FORM IS THE SAFE DIRECTION (§5.8): the district
     form asks for a superset of what simple mode asks for, so a shopper who
     gets it under a server that wanted `simple` has still given the server
     everything it needs. The reverse drops a field the server may want. */
  it("never falls back to simple", async () => {
    stubFetch(async () => {
      throw new Error("boom");
    });
    const config: DeliveryConfig = await readDeliveryConfig();
    expect(config.mode).toBe("district");
  });
});
