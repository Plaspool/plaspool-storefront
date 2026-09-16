import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ReviewsTab } from "./reviews-tab";
import { emptyAggregate } from "../data/reviews";
import type { PublicReview } from "../data/reviews";

const review = (id: string, verifiedPurchase?: boolean): PublicReview => ({
  id,
  productSlug: "pla-silk",
  rating: 5,
  title: null,
  body: `Body of ${id}`,
  authorName: "Ada",
  sentiment: "positive",
  createdAt: 1789000000000,
  helpfulCount: 0,
  replies: [],
  ...(verifiedPurchase === undefined ? {} : { verifiedPurchase }),
});

function render(reviews: PublicReview[]) {
  return renderToStaticMarkup(
    <ReviewsTab
      productSlug="pla-silk"
      productName="PLA Silk"
      hasParameters={false}
      aggregate={{ ...emptyAggregate("pla-silk"), count: reviews.length, averageRating: 500 }}
      initialReviews={reviews}
      initialCursor={null}
    />,
  );
}

describe("the Verified purchase badge", () => {
  it("shows only when verifiedPurchase is true", () => {
    expect(render([review("a", true)]).match(/Verified purchase/g)).toHaveLength(1);
    expect(render([review("b", false)])).not.toContain("Verified purchase");
    expect(render([review("c")])).not.toContain("Verified purchase");
  });
});
