import { describe, expect, it } from "vitest";
import {
  districtChoicesFor,
  effectiveDistrict,
  fieldPatch,
  fieldRows,
  fieldValue,
  submittedAddress,
  wantsServiceAreas,
} from "./address-fields";
import { DISTRICT_FALLBACK, parseDeliveryConfig, type DeliveryConfig } from "../data/delivery-config";
import type { ServiceArea } from "../data/returns-api";
import type { Address } from "../data/checkout-api";

/**
 * What the address step renders, and what it submits.
 *
 * WHAT THESE ARE ABOUT. Two failure modes, both expensive:
 *
 *   1. The form on screen stops matching the form the shop had — a shopper
 *      cannot tell the config exists when the switch is off, so every rule
 *      here is checked against `DISTRICT_FALLBACK`, which IS today's form.
 *   2. The payload carries something the server refuses, or drops something
 *      the server needs. `AddressesBody` is `.strict()`: a `location` sent to
 *      a server that has not shipped the column is a 400 with no useful
 *      message, and a `district` sent under `simple` prices the order by a
 *      stale area.
 */

const SIMPLE: DeliveryConfig = parseDeliveryConfig({
  config: {
    mode: "simple",
    revision: 8,
    country: { default: "NG", allowed: ["NG"], locked: true },
    fields: [
      { key: "name", show: true, required: true, label: "Full name", maxLength: 200 },
      { key: "phone", show: true, required: true, label: "Phone number", maxLength: 40 },
      { key: "region", show: true, required: true, label: "State", maxLength: 120 },
      { key: "city", show: true, required: true, label: "Town or city", maxLength: 120 },
      { key: "line1", show: true, required: true, label: "Address", maxLength: 200 },
      { key: "line2", show: true, required: false, label: "Extra directions", maxLength: 200 },
      { key: "district", show: false, required: false },
      { key: "postalCode", show: false, required: false },
    ],
    districts: null,
    location: { offer: true, required: false, maxAccuracyMeters: 500, pricing: false },
    servedRegions: null,
  },
});

const AREAS: ServiceArea[] = [
  { id: "a1", region: "Abuja", name: "Garki", key: "abuja-garki" },
  { id: "a2", region: "Abuja", name: "Wuse", key: "abuja-wuse" },
  { id: "a3", region: "Lagos", name: "Ikoyi", key: "lagos-ikoyi" },
  // No key: renaming-proof handle absent, so it can never be submitted.
  { id: "a4", region: "Abuja", name: "Maitama" },
];

const ADDRESS: Address = {
  name: "Adaeze Okonkwo",
  line1: "14 Bourdillon Road",
  line2: "Flat 3",
  city: "Ikoyi",
  region: "Lagos",
  postalCode: "101233",
  countryCode: "NG",
  phone: "+2348012345678",
  district: null,
};

const keys = (rows: ReturnType<typeof fieldRows>) => rows.flat().map((f) => f.key);

describe("which areas the district picker offers", () => {
  it("matches the typed State ignoring case and spacing", () => {
    // The State field is free text — "  lagos " must find what is filed
    // under "Lagos", or the picker silently empties for a valid address.
    expect(districtChoicesFor(AREAS, "  lagos ").map((a) => a.key)).toEqual(["lagos-ikoyi"]);
  });

  it("drops an area with no key, which could never be submitted", () => {
    expect(districtChoicesFor(AREAS, "Abuja").map((a) => a.name)).toEqual(["Garki", "Wuse"]);
  });

  it("offers nothing for a state with no served areas", () => {
    expect(districtChoicesFor(AREAS, "Kano")).toEqual([]);
  });

  it("offers nothing before a State is typed", () => {
    expect(districtChoicesFor(AREAS, "")).toEqual([]);
  });
});

describe("whether the areas list is fetched at all", () => {
  it("is fetched under district mode", () => {
    expect(wantsServiceAreas(DISTRICT_FALLBACK)).toBe(true);
  });

  it("is not fetched under simple mode", () => {
    // §6.1 — no picker means no reason to spend the round trip.
    expect(wantsServiceAreas(SIMPLE)).toBe(false);
  });
});

describe("the rows the form renders under today's config", () => {
  const rows = () => fieldRows(DISTRICT_FALLBACK, districtChoicesFor(AREAS, "Lagos"));

  it("renders today's fields in today's order", () => {
    expect(keys(rows())).toEqual([
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

  it("keeps City and State side by side, as they are on screen now", () => {
    // A flat ordered list would stack all eight, which is a visible change
    // with the switch off — exactly what the off-config must not cause.
    expect(rows().map((row) => row.map((f) => f.key))).toEqual([
      ["name"],
      ["phone"],
      ["line1"],
      ["line2"],
      ["city", "region"],
      ["district"],
      ["postalCode"],
    ]);
  });
});

describe("the rows the form renders under simple mode", () => {
  it("renders six fields and no district", () => {
    expect(keys(fieldRows(SIMPLE, []))).toEqual([
      "name",
      "phone",
      "region",
      "city",
      "line1",
      "line2",
    ]);
  });

  it("still pairs State and Town, which are adjacent in the other order", () => {
    expect(fieldRows(SIMPLE, []).map((row) => row.map((f) => f.key))).toContainEqual([
      "region",
      "city",
    ]);
  });
});

describe("a district picker with nothing in it", () => {
  it("is not rendered when the typed State has no served areas", () => {
    // `checkout-flow.tsx`: a picker with no options reads as a broken
    // required field. Absent is the honest rendering.
    expect(keys(fieldRows(DISTRICT_FALLBACK, []))).not.toContain("district");
  });

  it("is not rendered even when the server marks it required", () => {
    const required = parseDeliveryConfig({
      config: {
        ...DISTRICT_FALLBACK,
        fields: DISTRICT_FALLBACK.fields.map((f) =>
          f.key === "district" ? { ...f, required: true } : f,
        ),
      },
    });
    expect(keys(fieldRows(required, []))).not.toContain("district");
  });

  it("is rendered, and stays required, once the State has areas", () => {
    const required = parseDeliveryConfig({
      config: {
        ...DISTRICT_FALLBACK,
        fields: DISTRICT_FALLBACK.fields.map((f) =>
          f.key === "district" ? { ...f, required: true } : f,
        ),
      },
    });
    const district = fieldRows(required, districtChoicesFor(AREAS, "Abuja"))
      .flat()
      .find((f) => f.key === "district");
    expect(district?.required).toBe(true);
  });
});

describe("which district actually goes on the address", () => {
  const choices = districtChoicesFor(AREAS, "Abuja");

  it("keeps one the picker is currently offering", () => {
    const address = { ...ADDRESS, region: "Abuja", district: "abuja-garki" };
    expect(effectiveDistrict(address, DISTRICT_FALLBACK, AREAS, choices)).toBe("abuja-garki");
  });

  it("drops one the areas list no longer offers", () => {
    // A district switched off since the last order must not be resubmitted
    // silently — it would be refused, or priced at a rate that is gone.
    const address = { ...ADDRESS, region: "Abuja", district: "abuja-retired" };
    expect(effectiveDistrict(address, DISTRICT_FALLBACK, AREAS, choices)).toBeNull();
  });

  it("keeps one while the areas have not loaded", () => {
    // An empty list is the fetch failing, not the district being wrong.
    // Stripping it here would quietly change the price.
    const address = { ...ADDRESS, region: "Abuja", district: "abuja-garki" };
    expect(effectiveDistrict(address, DISTRICT_FALLBACK, [], [])).toBe("abuja-garki");
  });

  it("is null under simple mode however the address got one", () => {
    // §7 — the mode decides, not the row. A saved address carrying a district
    // from before the flip must not price this order.
    const address = { ...ADDRESS, region: "Abuja", district: "abuja-garki" };
    expect(effectiveDistrict(address, SIMPLE, AREAS, choices)).toBeNull();
  });
});

describe("the payload the address step submits", () => {
  it("sends every shown field under today's config", () => {
    const body = submittedAddress(ADDRESS, DISTRICT_FALLBACK, AREAS);
    expect(body).toMatchObject({
      name: "Adaeze Okonkwo",
      line1: "14 Bourdillon Road",
      line2: "Flat 3",
      city: "Ikoyi",
      region: "Lagos",
      postalCode: "101233",
      countryCode: "NG",
      phone: "+2348012345678",
    });
  });

  it("omits a hidden field rather than sending an empty string", () => {
    // §5.2 — `district` and `postalCode` are `.nullable().optional()` server
    // side, so absent is legal and means "no opinion, price at the state's
    // rate". `""` is an opinion, and a wrong one.
    const body = submittedAddress(ADDRESS, SIMPLE, []);
    expect(body).not.toHaveProperty("postalCode");
    expect(body).not.toHaveProperty("district");
  });

  it("omits the district under simple mode even when the address holds one", () => {
    const address = { ...ADDRESS, region: "Abuja", district: "abuja-garki" };
    expect(submittedAddress(address, SIMPLE, AREAS)).not.toHaveProperty("district");
  });

  it("sends the district under district mode", () => {
    const address = { ...ADDRESS, region: "Abuja", district: "abuja-garki" };
    expect(submittedAddress(address, DISTRICT_FALLBACK, AREAS).district).toBe("abuja-garki");
  });

  it("sends a stale district as null rather than as itself", () => {
    const address = { ...ADDRESS, region: "Abuja", district: "abuja-retired" };
    expect(submittedAddress(address, DISTRICT_FALLBACK, AREAS).district).toBeNull();
  });

  it("always sends an uppercase country code", () => {
    // §5.4 — the server regex-refuses anything else, and a lowercase code
    // would fall into the catch-all zone and price wrong.
    const body = submittedAddress({ ...ADDRESS, countryCode: "ng" }, SIMPLE, []);
    expect(body.countryCode).toBe("NG");
  });

  it("keeps sending an empty optional field that is shown", () => {
    // Shown-but-empty is not hidden. This is what the form does today and
    // nothing about the switch should change it.
    const body = submittedAddress({ ...ADDRESS, line2: "" }, DISTRICT_FALLBACK, AREAS);
    expect(body.line2).toBe("");
  });
});

describe("the location, which is a wire shape the old server refuses", () => {
  const LOCATION = {
    lat: 9.05785,
    lng: 7.49508,
    accuracyM: 32,
    source: "device" as const,
    capturedAt: 1_756_704_000_000,
  };

  it("is sent when the config offers it", () => {
    const body = submittedAddress({ ...ADDRESS, location: LOCATION }, SIMPLE, []);
    expect(body.location).toEqual(LOCATION);
  });

  it("is never sent when the config does not offer it", () => {
    /* ═══ THE GATE (§8) ═══
       `AddressesBody` is `.strict()`. Until the server ships the column, this
       field is a 400 with no useful message — and a server old enough to
       refuse it is also old enough never to say `offer: true`. So the config
       IS the feature flag for the wire shape, and this assertion is the one
       that keeps the storefront from ever producing that request. */
    const body = submittedAddress({ ...ADDRESS, location: LOCATION }, DISTRICT_FALLBACK, AREAS);
    expect(body).not.toHaveProperty("location");
  });

  it("is absent, not null, when nothing was captured", () => {
    // `AddressSnapshot` types it optional rather than nullable so a replayed
    // `checkout.completed` payload from before the field existed stays valid.
    expect(submittedAddress(ADDRESS, SIMPLE, [])).not.toHaveProperty("location");
  });
});

describe("binding one field to the address it edits", () => {
  /* A LOOKUP, NOT A COMPUTED KEY. These two are the whole reason the renderer
     can be a loop: without them it would need `address[key]` and a cast, and a
     cast is exactly where a field silently starts editing the wrong property. */

  it.each([
    ["name", "Adaeze Okonkwo"],
    ["line1", "14 Bourdillon Road"],
    ["line2", "Flat 3"],
    ["city", "Ikoyi"],
    ["region", "Lagos"],
    ["postalCode", "101233"],
    ["phone", "+2348012345678"],
  ] as const)("reads %s off the address", (key, expected) => {
    expect(fieldValue(ADDRESS, key, null)).toBe(expected);
  });

  it("reads the district from the effective key, not the raw one", () => {
    // The raw value can be an orphaned key the picker no longer offers. What
    // is on screen must be what is submitted.
    const address = { ...ADDRESS, district: "abuja-retired" };
    expect(fieldValue(address, "district", null)).toBe("");
  });

  it("renders an absent optional field as an empty string, never as null", () => {
    // A controlled input handed `null` warns and goes uncontrolled.
    expect(fieldValue({ ...ADDRESS, phone: null }, "phone", null)).toBe("");
  });

  it.each([
    ["name", { name: "Ada" }],
    ["line1", { line1: "14 Bourdillon" }],
    ["line2", { line2: "Flat 3" }],
    ["city", { city: "Ikoyi" }],
    ["region", { region: "Lagos" }],
    ["postalCode", { postalCode: "101233" }],
    ["phone", { phone: "0801" }],
  ] as const)("patches %s and nothing else", (key, expected) => {
    expect(fieldPatch(key, Object.values(expected)[0] as string)).toEqual(expected);
  });

  it("patches a chosen district as its key", () => {
    expect(fieldPatch("district", "abuja-garki")).toEqual({ district: "abuja-garki" });
  });

  it("patches a cleared district as null rather than an empty string", () => {
    // A district is an identifier, not text: "none chosen" is the absence of
    // one, not an empty string the API would store as if it were an opinion.
    expect(fieldPatch("district", "")).toEqual({ district: null });
  });
});
