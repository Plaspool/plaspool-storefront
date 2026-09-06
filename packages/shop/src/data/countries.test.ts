import { describe, expect, it } from "vitest";
import { COUNTRY_CODES, allCountries, countryName, isCountryCode } from "./countries";

describe("the code list", () => {
  it("is every assigned ISO 3166-1 alpha-2 code, once each", () => {
    expect(COUNTRY_CODES).toHaveLength(249);
    expect(new Set(COUNTRY_CODES).size).toBe(249);
  });

  it("is uppercase two-letter codes and nothing else", () => {
    for (const code of COUNTRY_CODES) expect(code).toMatch(/^[A-Z]{2}$/);
  });

  it("is a list the runtime can name — a typo would render as its own code", () => {
    // `Intl.DisplayNames` hands back the code itself for a well-formed but
    // unassigned code ("AB"), so a mistyped entry would ship as a two-letter
    // option. Node carries full ICU; every code here must resolve to a name.
    const unnamed = COUNTRY_CODES.filter((code) => countryName(code) === code);
    expect(unnamed).toEqual([]);
  });

  it("includes the one the shop ships from", () => {
    expect(COUNTRY_CODES).toContain("NG");
    expect(countryName("NG")).toBe("Nigeria");
  });
});

describe("the named list", () => {
  it("is sorted by name, not by code", () => {
    const names = allCountries().map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en")));
  });

  it("is computed once", () => {
    expect(allCountries()).toBe(allCountries());
  });
});

describe("recognising a code", () => {
  it("accepts a known code in any case", () => {
    expect(isCountryCode("ng")).toBe(true);
    expect(isCountryCode("GB")).toBe(true);
  });

  it("refuses what is not a country", () => {
    // Cloudflare's own placeholders for "unknown" and "Tor", and a blank.
    expect(isCountryCode("XX")).toBe(false);
    expect(isCountryCode("T1")).toBe(false);
    expect(isCountryCode("")).toBe(false);
    expect(isCountryCode(null)).toBe(false);
  });
});
