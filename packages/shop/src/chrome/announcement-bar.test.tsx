import { expect, it } from "vitest";
import { RETURNS_PATH, isReturnsCta } from "./announcement-bar";

it("treats exactly /returns as the dialog CTA", () => {
  expect(isReturnsCta(RETURNS_PATH)).toBe(true);
  expect(isReturnsCta("/store")).toBe(false);
  expect(isReturnsCta(null)).toBe(false);
});

it("does not match a near miss, which must stay an ordinary link", () => {
  // An operator who types a trailing slash or a query gets a plain navigation
  // to a real page, which works. Guessing at intent here would open a dialog
  // over a URL that is not the one they set.
  expect(isReturnsCta("/returns/")).toBe(false);
  expect(isReturnsCta("/returns?utm_source=x")).toBe(false);
});
