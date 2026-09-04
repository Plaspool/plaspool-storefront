import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { EmptyState } from "./empty-state";

/**
 * `body` IS OPTIONAL, AND THE CART IS WHY.
 *
 * The empty basket read "Your cart is empty" over "Browse PLA, PETG and TPU by
 * the spool or by the box." — a sentence that answers "what does this shop
 * sell?", which is not the question a shopper who just opened an empty cart is
 * asking. The title says what happened and the button says what to do; the line
 * between them was doing neither.
 *
 * Omitting it has to be different from passing `""`: an empty string still
 * renders the paragraph, and with it `mt-2` and a line box of dead space above
 * the button. That is what the second assertion is for.
 */
describe("EmptyState without a body", () => {
  const withBody = renderToStaticMarkup(
    <EmptyState icon={<span />} title="Your cart is empty" body="Some copy." />,
  );
  const without = renderToStaticMarkup(
    <EmptyState icon={<span />} title="Your cart is empty" />,
  );

  it("still says what happened", () => {
    expect(without).toContain("Your cart is empty");
  });

  it("renders no paragraph at all rather than an empty one", () => {
    expect(withBody).toContain("<p");
    expect(without).not.toContain("<p");
  });

  it("keeps the action, which is the part that does something", () => {
    const acting = renderToStaticMarkup(
      <EmptyState icon={<span />} title="Your cart is empty" action={<button>Browse the store</button>} />,
    );
    expect(acting).toContain("Browse the store");
  });
});
