import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Sheet } from "@plaspool/ui";

import { SignedInAccountLinks } from "./mobile-account-links";
import type { ShopCustomer } from "../data/auth-api";

/**
 * THE MOBILE MENU MUST RENDER FOR A SIGNED-IN SHOPPER.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT THIS EXISTS TO PREVENT COMING BACK.
 *
 * Two `<Link>`s were nested inside ONE `<SheetClose asChild>`. Radix's `Slot`
 * refuses more than one child — `React.Children.count(children) > 1 ?
 * React.Children.only(null) : null` — so it threw during render, the app's
 * error boundary caught it, and the whole page became "Something went wrong".
 *
 * IT ONLY FIRED FOR SIGNED-IN SHOPPERS, and only after a delay: this markup is
 * behind a `readShopSession()` probe, so opening the hamburger showed a working
 * menu for a second and then replaced the entire page with an error. A guest
 * never reached the branch at all, which is why it survived review.
 *
 * Rendered through `react-dom/server` inside an open `Sheet` ROOT and no
 * `SheetContent`. Both halves of that are load-bearing: bare, `SheetClose`
 * throws "`DialogClose` must be used within `Dialog`" and the test would pass
 * or fail for the wrong reason; inside `SheetContent`, Radix portals the
 * subtree and `renderToStaticMarkup` returns an empty string, so every
 * assertion below would be vacuous. The root alone supplies the context
 * without the portal.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const CUSTOMER: ShopCustomer = {
  id: "cus_msztjjovc0da3b38d8734e67",
  email: "shopper@example.com",
  name: "Ada Lovelace",
};

function render(customer: ShopCustomer = CUSTOMER) {
  return renderToStaticMarkup(
    <Sheet open>
      <SignedInAccountLinks
        customer={customer}
        linkClassName="link"
        signingOut={false}
        onSignOut={() => {}}
      />
    </Sheet>,
  );
}

describe("SignedInAccountLinks", () => {
  /* THE REPORTED CRASH. Everything else here is only reachable if this holds. */
  it("renders at all for a signed-in shopper", () => {
    expect(() => render()).not.toThrow();
  });

  it("offers every account destination the dropdown does", () => {
    const html = render();
    for (const href of ["/account", "/account/orders", "/account/settings", "/contact"]) {
      expect(html).toContain(`href="${href}"`);
    }
  });

  it("names the account it is signed in to", () => {
    expect(render()).toContain("Ada Lovelace");
  });

  /* A customer with no name falls back to the email — the label is the only
     thing telling a shopper WHICH account this menu is acting on. */
  it("falls back to the email when the customer has no name", () => {
    const html = render({ ...CUSTOMER, name: null });
    expect(html).toContain("shopper@example.com");
  });
});
