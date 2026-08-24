import { describe, expect, it } from "vitest";

import { signInHref } from "./sign-in-href";

describe("signInHref", () => {
  /* The whole point: sign in from the home page, come back to the home page. */
  it("carries the page the shopper is on", () => {
    expect(signInHref("/")).toBe("/sign-in?next=%2F");
    expect(signInHref("/store")).toBe("/sign-in?next=%2Fstore");
    expect(signInHref("/store/products/pla-filament")).toBe(
      "/sign-in?next=%2Fstore%2Fproducts%2Fpla-filament",
    );
  });

  it("falls back to a bare link when there is no path to carry", () => {
    expect(signInHref(null)).toBe("/sign-in");
    expect(signInHref(undefined)).toBe("/sign-in");
    expect(signInHref("")).toBe("/sign-in");
  });

  /* It must never WRITE a value `safeDestination` would throw away — the two
     would then disagree about a link the shop produced itself. */
  it("never writes a destination the sign-in page would refuse", () => {
    expect(signInHref("/sign-in")).toBe("/sign-in");
    expect(signInHref("/sign-in/anything")).toBe("/sign-in");
    expect(signInHref("//evil.example")).toBe("/sign-in");
    expect(signInHref("https://evil.example")).toBe("/sign-in");
    expect(signInHref("/\nstore")).toBe("/sign-in");
  });

  it("does not mistake a path that merely starts with the same letters", () => {
    expect(signInHref("/sign-in-help")).toBe("/sign-in?next=%2Fsign-in-help");
  });
});
