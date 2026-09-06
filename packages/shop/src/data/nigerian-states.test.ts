import { describe, expect, it } from "vitest";
import {
  NIGERIAN_STATES,
  foldRegion,
  matchNigerianState,
  nigerianStateName,
} from "./nigerian-states";

/**
 * The list is a fact of geography; the matcher is where the decisions are.
 * Every case here is a value that has actually been seen in a State box —
 * a saved snapshot, a geocoder, a shopper — and what the select must do
 * with it.
 */

describe("the list", () => {
  it("has the 36 states and the FCT", () => {
    expect(NIGERIAN_STATES).toHaveLength(37);
  });

  it("has no duplicate codes or names", () => {
    const codes = new Set(NIGERIAN_STATES.map((s) => s.code));
    const names = new Set(NIGERIAN_STATES.map((s) => s.name));
    expect(codes.size).toBe(37);
    expect(names.size).toBe(37);
  });

  it("is what the live areas file their districts under", () => {
    // `GET /api/public/marketing/areas` on 2026-09-06: every row's `region`
    // is one of these two strings, exactly. The select's value has to be the
    // same string or the district picker under it finds nothing.
    expect(nigerianStateName("Federal Capital Territory")).toBe("Federal Capital Territory");
    expect(nigerianStateName("Lagos")).toBe("Lagos");
  });
});

describe("folding", () => {
  it("drops case, punctuation and a trailing 'state'", () => {
    expect(foldRegion("Akwa-Ibom State")).toBe("akwa ibom");
    expect(foldRegion("  LAGOS  ")).toBe("lagos");
    expect(foldRegion("Cross River")).toBe("cross river");
  });
});

describe("matching what a shopper, a snapshot or a geocoder wrote", () => {
  it("matches a name however it is cased or spaced", () => {
    expect(matchNigerianState("lagos")?.code).toBe("LA");
    expect(matchNigerianState("Lagos State")?.code).toBe("LA");
    expect(matchNigerianState("akwa-ibom")?.code).toBe("AK");
  });

  it("matches an ISO 3166-2 code, with or without the prefix", () => {
    // Cloudflare's `cf.regionCode` is "LA"; Nominatim's `ISO3166-2-lvl4` is
    // "NG-LA". Both are more reliable than any spelling of the name.
    expect(matchNigerianState("NG-LA")?.name).toBe("Lagos");
    expect(matchNigerianState("FC")?.name).toBe("Federal Capital Territory");
    expect(matchNigerianState("ng-kn")?.name).toBe("Kano");
  });

  it("knows the capital by every name it goes by", () => {
    for (const spelling of [
      "FCT",
      "Abuja",
      "Abuja FCT",
      "abuja federal capital territory",
      "Federal Capital Territory",
    ]) {
      expect(matchNigerianState(spelling)?.code, spelling).toBe("FC");
    }
  });

  it("reads a local government area as its state", () => {
    expect(matchNigerianState("Lagos Island")?.code).toBe("LA");
    expect(matchNigerianState("Abuja Municipal Area Council")?.code).toBe("FC");
    expect(matchNigerianState("Kano Municipal")?.code).toBe("KN");
  });

  it("does not let a prefix cross a word boundary", () => {
    expect(matchNigerianState("Ogunpa")).toBeNull();
    expect(matchNigerianState("Edoland")).toBeNull();
  });

  it("answers null rather than guess", () => {
    expect(matchNigerianState("Port Harcourt")).toBeNull();
    expect(matchNigerianState("")).toBeNull();
    expect(matchNigerianState(null)).toBeNull();
    expect(matchNigerianState(undefined)).toBeNull();
    expect(nigerianStateName("London")).toBeNull();
  });
});
