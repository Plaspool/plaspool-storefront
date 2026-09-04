import { describe, expect, it } from "vitest";

import { DISTRICT_FALLBACK, type DeliveryConfig } from "../data/delivery-config";
import type { Address } from "../data/checkout-api";
import { districtsApply, fieldRows, submittedAddress } from "./address-fields";
import type { ServiceArea } from "../data/returns-api";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DISTRICTS ARE NIGERIAN, AND SENDING ONE WITH A LONDON ADDRESS MISPRICES THE
 * PARCEL.
 *
 * The served-areas list is Abuja and Lagos districts at Nigerian zone rates.
 * The failure this file exists to stop is not a crash — it is a shopper who
 * fills in a Nigerian address, picks Maitama, then changes the country to GB
 * and submits. The district key is still sitting in form state; without these
 * rules it rides the payload and the API prices an international parcel at an
 * Abuja rate. Nothing throws and the number looks perfectly ordinary.
 *
 * The API's own contract is explicit: hide the field and OMIT the key. Not an
 * empty string, which is an opinion, and the wrong one.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const AREAS: ServiceArea[] = [
  { id: "a1", key: "maitama", name: "Maitama", region: "FCT" } as ServiceArea,
];

const NG: Address = {
  name: "Emmanuel Abah",
  line1: "12 Aso Drive",
  city: "Abuja",
  region: "FCT",
  countryCode: "NG",
  district: "maitama",
};

const GB: Address = { ...NG, city: "London", region: "Greater London", countryCode: "GB" };

/** The config as it will look once international selling is switched on. */
const OPEN_COUNTRIES: DeliveryConfig = {
  ...DISTRICT_FALLBACK,
  country: { default: "NG", allowed: ["NG", "GB", "US"], locked: false },
};

describe("whether districts apply at all", () => {
  it("applies inside Nigeria", () => {
    expect(districtsApply(NG, OPEN_COUNTRIES)).toBe(true);
  });

  it("does not apply anywhere else", () => {
    expect(districtsApply(GB, OPEN_COUNTRIES)).toBe(false);
  });

  it("reads an empty country as the config's default, not as 'nowhere'", () => {
    /* A shopper mid-form has not typed a country. Treating that as "not
       Nigeria" would make the picker flicker out from under them, and
       `submittedAddress` builds `countryCode` from the same fallback — so the
       two must agree about which country an empty field means. */
    expect(districtsApply({ ...NG, countryCode: "" }, OPEN_COUNTRIES)).toBe(true);
  });

  it("is case-insensitive, because a saved address may carry a lower-case code", () => {
    expect(districtsApply({ ...NG, countryCode: "ng" }, OPEN_COUNTRIES)).toBe(true);
  });
});

describe("the district row disappears outside Nigeria", () => {
  const keys = (config: DeliveryConfig, address?: Address) =>
    fieldRows(config, AREAS, address).flat().map((f) => f.key);

  it("is offered for a Nigerian address", () => {
    expect(keys(OPEN_COUNTRIES, NG)).toContain("district");
  });

  it("is gone for an address anywhere else", () => {
    expect(keys(OPEN_COUNTRIES, GB)).not.toContain("district");
  });

  it("keeps every other field, so hiding one does not empty the form", () => {
    const rows = keys(OPEN_COUNTRIES, GB);
    for (const key of ["name", "phone", "region", "city", "line1"]) {
      expect(rows).toContain(key);
    }
  });

  it("behaves exactly as before when no address is passed", () => {
    /* The existing two-argument callers must not change behaviour — this is
       today's form, and today's shop is Nigeria-only. */
    expect(keys(DISTRICT_FALLBACK)).toEqual(keys(DISTRICT_FALLBACK, NG));
  });
});

describe("the submitted body", () => {
  it("carries the district for a Nigerian address", () => {
    const body = submittedAddress(NG, OPEN_COUNTRIES, AREAS);
    expect(body.district).toBe("maitama");
    expect(body.countryCode).toBe("NG");
  });

  it("OMITS the district key entirely for an address elsewhere", () => {
    /* Omitted, not null and not "". The API's field is
       `.nullable().optional()`, so absent is legal and means "no opinion". */
    const body = submittedAddress(GB, OPEN_COUNTRIES, AREAS);
    expect("district" in body).toBe(false);
  });

  it("does not let a leftover Nigerian district ride an international submit", () => {
    /* THE ACTUAL BUG. The address still carries `district: "maitama"` from
       before the country was changed — form state does not clear itself — and
       this is the assertion that stops it reaching the API and pricing a
       London parcel at an Abuja rate. */
    expect(submittedAddress({ ...GB, district: "maitama" }, OPEN_COUNTRIES, AREAS).district)
      .toBeUndefined();
  });

  it("still uppercases the country code, whatever was typed", () => {
    expect(submittedAddress({ ...GB, countryCode: "gb" }, OPEN_COUNTRIES, AREAS).countryCode)
      .toBe("GB");
  });

  it("is unchanged for the locked, Nigeria-only config the shop runs today", () => {
    const body = submittedAddress(NG, DISTRICT_FALLBACK, AREAS);
    expect(body.countryCode).toBe("NG");
    expect(body.district).toBe("maitama");
  });
});
