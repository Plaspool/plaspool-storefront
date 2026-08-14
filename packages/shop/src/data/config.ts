/**
 * Fixture reviews are for building the UI. They are not customer reviews and
 * must never be presented as them on a live store.
 *
 * `true`  → the reviews tab renders fixtures behind a visible "sample data" notice.
 * `false` → the reviews tab renders its empty state. This is the shippable setting
 *           until real reviews exist.
 */
export const SHOW_FIXTURE_REVIEWS = true;

export const DELIVERY = {
  lagos: "Next day in Lagos on orders placed before 2pm",
  nationwide: "2–4 working days nationwide",
  freeOver: 50_000,
  returns: "Unopened spools can be returned within 7 days",
} as const;

export const PAYMENT_METHODS = [
  "Card",
  "Bank transfer",
  "USSD",
  "Pay on delivery (Lagos)",
] as const;
