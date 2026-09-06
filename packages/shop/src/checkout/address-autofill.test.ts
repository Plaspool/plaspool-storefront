import { describe, expect, it, vi } from "vitest";

import { DISTRICT_FALLBACK, type DeliveryConfig } from "../data/delivery-config";
import { EMPTY_HINT } from "../data/geo-hint";
import type { ServiceArea } from "../data/returns-api";
import {
  prefillFromGeoHint,
  readReverseGeocode,
  reverseGeocode,
  reverseGeocodeUrl,
  suggestDistrict,
} from "./address-autofill";

/**
 * The bodies here are shaped like what Nominatim actually returns for a fix
 * in Ikoyi and one in Maitama, trimmed to the parts that matter. The cases
 * are about not guessing: what is filled, what is left alone, and where the
 * decision is handed back to the shopper.
 */

const IKOYI = {
  place_id: 1,
  address: {
    house_number: "14",
    road: "Bourdillon Road",
    suburb: "Ikoyi",
    city: "Lagos",
    county: "Eti-Osa",
    state: "Lagos",
    "ISO3166-2-lvl4": "NG-LA",
    postcode: "101233",
    country: "Nigeria",
    country_code: "ng",
  },
};

const MAITAMA = {
  address: {
    road: "Aguiyi Ironsi Street",
    neighbourhood: "Maitama",
    city: "Abuja",
    state: "Federal Capital Territory",
    "ISO3166-2-lvl4": "NG-FC",
    country_code: "ng",
  },
};

describe("the request", () => {
  it("asks Nominatim for building-level detail, in English, as parts", () => {
    const url = new URL(reverseGeocodeUrl(6.4531, 3.4327));
    expect(url.origin + url.pathname).toBe("https://nominatim.openstreetmap.org/reverse");
    expect(url.searchParams.get("lat")).toBe("6.4531");
    expect(url.searchParams.get("lon")).toBe("3.4327");
    expect(url.searchParams.get("format")).toBe("jsonv2");
    expect(url.searchParams.get("addressdetails")).toBe("1");
    expect(url.searchParams.get("zoom")).toBe("18");
  });
});

describe("reading a fix as an address", () => {
  it("fills the street, area, city, state, postcode and country", () => {
    expect(readReverseGeocode(IKOYI)?.patch).toEqual({
      countryCode: "NG",
      region: "Lagos",
      city: "Lagos",
      line1: "14 Bourdillon Road, Ikoyi",
      postalCode: "101233",
    });
  });

  it("puts the state in the exact spelling the areas are filed under", () => {
    // The live areas file Abuja's districts under "Federal Capital Territory",
    // and the district picker matches that string. The ISO code is what
    // places it; the name is only the fallback.
    expect(readReverseGeocode(MAITAMA)?.patch.region).toBe("Federal Capital Territory");
    expect(
      readReverseGeocode({ address: { state: "FCT", country_code: "ng" } })?.patch.region,
    ).toBe("Federal Capital Territory");
  });

  it("leaves a field alone rather than blank it when the fix does not name it", () => {
    const patch = readReverseGeocode(MAITAMA)?.patch;
    expect(patch).not.toHaveProperty("postalCode");
    expect(patch?.line1).toBe("Aguiyi Ironsi Street, Maitama");
  });

  it("never touches the shopper's name, phone or apartment line", () => {
    const patch = readReverseGeocode(IKOYI)?.patch ?? {};
    expect(Object.keys(patch)).not.toContain("name");
    expect(Object.keys(patch)).not.toContain("phone");
    expect(Object.keys(patch)).not.toContain("line2");
  });

  it("keeps a foreign state as the geocoder wrote it, since that field is free text", () => {
    const patch = readReverseGeocode({
      address: { road: "Baker Street", city: "London", state: "England", country_code: "gb" },
    })?.patch;
    expect(patch).toMatchObject({ countryCode: "GB", region: "England", city: "London" });
  });

  it("drops a Nigerian state it cannot place rather than send a guess", () => {
    const patch = readReverseGeocode({
      address: { city: "Somewhere", state: "Nowhere Province", country_code: "ng" },
    })?.patch;
    expect(patch).toEqual({ countryCode: "NG", city: "Somewhere" });
  });

  it("hands back the neighbourhood names for the district picker, most specific first", () => {
    // Lagos's served areas are its LGAs, which Nominatim files under `county`.
    expect(readReverseGeocode(IKOYI)?.localities).toEqual(["Ikoyi", "Eti-Osa"]);
    expect(readReverseGeocode(MAITAMA)?.localities).toEqual(["Maitama"]);
  });

  it("is null for a fix the geocoder could not place", () => {
    expect(readReverseGeocode({ error: "Unable to geocode" })).toBeNull();
    expect(readReverseGeocode({ address: {} })).toBeNull();
    expect(readReverseGeocode(null)).toBeNull();
    expect(readReverseGeocode("nope")).toBeNull();
  });
});

describe("the call", () => {
  it("answers the patch on a good response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(IKOYI), { status: 200 }));
    await expect(reverseGeocode(6.45, 3.43, fetchImpl)).resolves.toMatchObject({
      patch: { region: "Lagos" },
    });
    expect(fetchImpl.mock.calls[0][0]).toContain("nominatim.openstreetmap.org/reverse");
  });

  it("is null, never a rejection, when the service fails", async () => {
    await expect(
      reverseGeocode(6.45, 3.43, vi.fn().mockResolvedValue(new Response("busy", { status: 503 }))),
    ).resolves.toBeNull();
    await expect(
      reverseGeocode(6.45, 3.43, vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))),
    ).resolves.toBeNull();
  });
});

describe("suggesting the served area", () => {
  const area = (key: string, name: string): ServiceArea =>
    ({ id: `area_${key}`, key, name, region: "Federal Capital Territory" }) as ServiceArea;
  const ABUJA = [
    area("fct-maitama-district", "Maitama District"),
    area("fct-wuse-district", "Wuse District"),
    area("fct-wuse-ii-district", "Wuse II District"),
    area("fct-garki", "Garki"),
    area("fct-garki-ii-district", "Garki II District"),
  ];

  it("picks the one area the neighbourhood names", () => {
    expect(suggestDistrict(ABUJA, ["Maitama"])).toBe("fct-maitama-district");
  });

  it("prefers the exact name when a longer one also starts with it", () => {
    expect(suggestDistrict(ABUJA, ["Wuse"])).toBe("fct-wuse-district");
    expect(suggestDistrict(ABUJA, ["Garki"])).toBe("fct-garki");
    expect(suggestDistrict(ABUJA, ["Wuse 2"])).toBe("fct-wuse-ii-district");
  });

  it("leaves the choice to the shopper when nothing, or more than one thing, matches", () => {
    expect(suggestDistrict(ABUJA, ["Gwarinpa"])).toBeNull();
    expect(suggestDistrict(ABUJA, [])).toBeNull();
    expect(suggestDistrict([], ["Maitama"])).toBeNull();
    // An area with no key can never be submitted, so it can never be chosen.
    expect(suggestDistrict([{ ...ABUJA[0], key: undefined }], ["Maitama"])).toBeNull();
  });

  it("tries the most specific name first", () => {
    expect(suggestDistrict(ABUJA, ["Somewhere New", "Maitama"])).toBe("fct-maitama-district");
  });

  it("reaches a Lagos LGA through the county when the suburb names no area", () => {
    // The live Lagos list on 2026-09-06: LGAs, not neighbourhoods. A fix in
    // Ikoyi carries suburb "Ikoyi" (no area) and county "Eti-Osa" (an area).
    const LAGOS = [
      { ...area("lagos-eti-osa", "Eti-Osa"), region: "Lagos" },
      { ...area("lagos-ikeja", "Ikeja"), region: "Lagos" },
      { ...area("lagos-lagos-island", "Lagos Island"), region: "Lagos" },
    ];
    expect(suggestDistrict(LAGOS, ["Ikoyi", "Eti-Osa"])).toBe("lagos-eti-osa");
    expect(suggestDistrict(LAGOS, ["Ikoyi", "Eti Osa"])).toBe("lagos-eti-osa");
  });
});

describe("what the connection may set", () => {
  const open: DeliveryConfig = {
    ...DISTRICT_FALLBACK,
    country: { default: "NG", allowed: ["NG", "GB"], locked: false },
  };

  it("sets the country when the shop delivers there", () => {
    expect(prefillFromGeoHint({ ...EMPTY_HINT, country: "GB" }, open)).toEqual({ countryCode: "GB" });
    expect(prefillFromGeoHint({ ...EMPTY_HINT, country: "NG" }, DISTRICT_FALLBACK)).toEqual({
      countryCode: "NG",
    });
  });

  it("leaves the default in place for a country the shop does not reach", () => {
    // A shopper in London is more likely sending to Lagos than expecting
    // delivery in London; preselecting GB would put a disabled Continue in
    // front of them for no reason.
    expect(prefillFromGeoHint({ ...EMPTY_HINT, country: "GB" }, DISTRICT_FALLBACK)).toBeNull();
  });

  it("does nothing with an empty hint", () => {
    expect(prefillFromGeoHint(EMPTY_HINT, open)).toBeNull();
  });

  it("only ever names the country — never the state or city", () => {
    const patch = prefillFromGeoHint(
      { country: "NG", region: "Lagos", regionCode: "LA", city: "Lagos" },
      DISTRICT_FALLBACK,
    );
    expect(patch).toEqual({ countryCode: "NG" });
  });
});
