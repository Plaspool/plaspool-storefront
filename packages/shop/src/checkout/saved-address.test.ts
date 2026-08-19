import { describe, expect, it } from "vitest";
import { BLANK_ADDRESS, readSavedAddress } from "./saved-address";
import type { SavedAddress } from "../data/orders-api";

/**
 * Reading an address the shop has already shipped to.
 *
 * WHAT THESE ARE ABOUT. The input is an ORDER'S SNAPSHOT — untyped `jsonb`,
 * written by a checkout that may predate any field this form now edits — and it
 * is offered to a shopper as a one-click choice. So every case here is a way the
 * snapshot can fail to be an address, and the question is always the same: does
 * the shopper end up submitting something the API will refuse?
 *
 * A selectable address that fails validation on submit is worse than one fewer
 * choice. The shopper picked what the shop showed them, and the error that
 * follows reads as their mistake.
 */

const saved = (address: Record<string, unknown>): SavedAddress => ({
  address,
  lastUsedAt: 1_755_600_000_000,
});

const COMPLETE = {
  name: "Adaeze Okonkwo",
  line1: "14 Bourdillon Road",
  line2: "Flat 3",
  city: "Ikoyi",
  region: "Lagos",
  postalCode: "101233",
  countryCode: "NG",
  phone: "+2348012345678",
};

describe("a complete address", () => {
  it("comes through whole", () => {
    expect(readSavedAddress(saved(COMPLETE))).toEqual(COMPLETE);
  });

  it("fills the genuinely optional fields with empty strings, not undefined", () => {
    // The form binds these to controlled inputs; `undefined` would make React
    // switch the field to uncontrolled and warn.
    const out = readSavedAddress(saved({ name: "A", line1: "B", city: "C", region: "Lagos" }));
    expect(out).toEqual({
      name: "A",
      line1: "B",
      city: "C",
      region: "Lagos",
      line2: "",
      postalCode: "",
      countryCode: "NG",
      phone: "",
    });
  });
});

describe("an address the API would refuse", () => {
  it.each([
    ["no name", { line1: "B", city: "C", region: "Lagos" }],
    ["no line1", { name: "A", city: "C", region: "Lagos" }],
    ["no city", { name: "A", line1: "B", region: "Lagos" }],
    /* ═══ REGION, WHICH THE API DOES NOT REQUIRE BUT THIS FORM DOES ═══
       `assertAddress` wants name/line1/city/countryCode and `shop_addresses.region`
       is nullable, but the checkout marks State required — so a snapshot from a
       checkout that predates that field used to be offered, preselected, filled
       into the form, and then refused to submit with a native "Please fill out
       this field" on a field the shopper never touched. What may be offered is
       decided by the STRICTER of the two rules. */
    ["no region, which the form requires even though the API does not", { name: "A", line1: "B", city: "C" }],
    ["a region that is only whitespace", { name: "A", line1: "B", city: "C", region: "" }],
    ["an empty string where a value is required", { name: "", line1: "B", city: "C", region: "Lagos" }],
    ["a non-string in a required field", { name: 42, line1: "B", city: "C", region: "Lagos" }],
    ["nothing at all", {}],
  ])("is dropped rather than offered: %s", (_label, address) => {
    expect(readSavedAddress(saved(address))).toBeNull();
  });

  it("survives a null address without throwing", () => {
    // `shippingAddress` is nullable on the wire, and a checkout list that throws
    // is a checkout nobody can complete.
    expect(readSavedAddress({ address: null as never, lastUsedAt: 0 })).toBeNull();
  });
});

describe("the country code", () => {
  it("is uppercased, because the API derives the tax zone from it", () => {
    /*
     * A lowercase code does not merely look wrong: the API refuses anything that
     * is not `^[A-Z]{2}$`, and the shipping zone — and therefore the tax rate —
     * is matched on it. A snapshot written before that check existed must not
     * put the shopper in the fallback zone.
     */
    const out = readSavedAddress(saved({ ...COMPLETE, countryCode: "ng" }));
    expect(out?.countryCode).toBe("NG");
  });

  it("defaults to this shop's country when the snapshot has none", () => {
    const { countryCode: _dropped, ...withoutCountry } = COMPLETE;
    expect(readSavedAddress(saved(withoutCountry))?.countryCode).toBe("NG");
  });

  it("does not inherit a non-string", () => {
    expect(readSavedAddress(saved({ ...COMPLETE, countryCode: 234 }))?.countryCode).toBe("NG");
  });
});

describe("BLANK_ADDRESS", () => {
  it("is what 'somewhere else' resets to, and holds no previous entry", () => {
    // Picking "somewhere else" and finding the last address still in the fields
    // is how a parcel goes to the wrong place.
    expect(BLANK_ADDRESS).toEqual({
      name: "",
      line1: "",
      line2: "",
      city: "",
      region: "",
      postalCode: "",
      countryCode: "NG",
      phone: "",
    });
  });
});
