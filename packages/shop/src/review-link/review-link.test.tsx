import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { LinkInvalid, reviewLinkGreeting, reviewLinkMetadata } from "./review-link-page";
import {
  ReviewLinkCard,
  ReviewLinkThanks,
  allReviewed,
  initialStatuses,
} from "./review-link-products";
import { ReviewPhotoField } from "../product/review-photo-field";
import { ReviewPhotoStrip } from "../product/review-photos";
import { ReviewForm } from "../product/review-form";
import type { PhotoItem } from "../product/review-photo-state";

const PRODUCT = { slug: "pla-silk", title: "PLA Silk", imageUrl: null, reviewed: false };

describe("the review link page", () => {
  it("greets by first name, or without one", () => {
    expect(reviewLinkGreeting("Ada")).toBe("Hi Ada, how did your order go?");
    expect(reviewLinkGreeting(null)).toBe("How did your order go?");
    expect(reviewLinkGreeting("  ")).toBe("How did your order go?");
  });

  it("is kept out of search and out of Referer headers", () => {
    expect(reviewLinkMetadata.robots).toMatchObject({ index: false });
    expect(reviewLinkMetadata.referrer).toBe("no-referrer");
  });

  it("tells an invalid link to ask for a new one, with no sign-in wall", () => {
    const html = renderToStaticMarkup(<LinkInvalid />);
    expect(html).toContain("expired or isn&#x27;t valid");
    expect(html).not.toMatch(/sign.in/i);
  });

  it("starts already-reviewed products as reviewed, and knows when all are done", () => {
    const statuses = initialStatuses([PRODUCT, { ...PRODUCT, slug: "petg", reviewed: true }]);
    expect(statuses).toEqual({ "pla-silk": "form", petg: "reviewed" });
    expect(allReviewed(statuses)).toBe(false);
    expect(allReviewed({ ...statuses, "pla-silk": "submitted" })).toBe(true);
  });

  it("renders the form only while a card is open", () => {
    const form = <p>THE-FORM</p>;
    const open = renderToStaticMarkup(<ReviewLinkCard product={PRODUCT} status="form">{form}</ReviewLinkCard>);
    const reviewed = renderToStaticMarkup(<ReviewLinkCard product={PRODUCT} status="reviewed">{form}</ReviewLinkCard>);
    const submitted = renderToStaticMarkup(<ReviewLinkCard product={PRODUCT} status="submitted">{form}</ReviewLinkCard>);
    expect(open).toContain("THE-FORM");
    expect(reviewed).not.toContain("THE-FORM");
    expect(reviewed).toContain("Reviewed");
    expect(submitted).toContain("Thanks, your review is in!");
    expect(submitted).not.toContain("THE-FORM");
  });

  it("offers a way back to the store once everything is reviewed", () => {
    const html = renderToStaticMarkup(<ReviewLinkThanks />);
    expect(html).toContain("Keep shopping");
    expect(html).toContain('href="/store"');
  });
});

describe("the review form's byline", () => {
  it("pre-fills the name and marks it optional on a product page", () => {
    const html = renderToStaticMarkup(
      <ReviewForm productSlug="pla-silk" productName="PLA Silk" defaultAuthorName="Ada" />,
    );
    expect(html).toContain("Name shown on your review");
    expect(html).toContain('value="Ada"');
    expect(html).toContain("(optional)");
  });

  it("drops the optional marker when the link has no first name", () => {
    const html = renderToStaticMarkup(
      <ReviewForm productSlug="pla-silk" productName="PLA Silk" reviewLink="t" requireAuthorName hideHeading />,
    );
    const nameLabel = html.slice(html.indexOf("Name shown on your review"));
    expect(nameLabel.slice(0, 80)).not.toContain("(optional)");
  });
});

describe("photos", () => {
  const item = (over: Partial<PhotoItem>): PhotoItem => ({
    key: "k",
    previewUrl: "blob:k",
    status: "done",
    photoId: "rvp_1",
    error: null,
    ...over,
  });

  it("shows a spinner while uploading and retry plus remove on failure", () => {
    const html = renderToStaticMarkup(
      <ReviewPhotoField
        items={[item({ key: "a", status: "uploading" }), item({ key: "b", status: "error", error: "file-type" })]}
        remaining={2}
        onPick={() => {}}
        onRetry={() => {}}
        onRemove={() => {}}
      />,
    );
    expect(html).toContain("Uploading");
    expect(html).toContain("Retry photo 2");
    expect(html).toContain("Remove photo 1");
    expect(html).toContain("Remove photo 2");
    expect(html).toContain("Try a JPEG or PNG");
    expect(html).toContain('accept="image/*"');
    expect(html).toContain("multiple");
  });

  it("hides the picker once four photos are attached", () => {
    const html = renderToStaticMarkup(
      <ReviewPhotoField items={[item({})]} remaining={0} onPick={() => {}} onRetry={() => {}} onRemove={() => {}} />,
    );
    expect(html).not.toContain('type="file"');
  });

  it("renders lazy thumbnails with the reviewer's name in the alt text", () => {
    const html = renderToStaticMarkup(
      <ReviewPhotoStrip
        authorName="Ada"
        photos={[{ id: "rvp_1", url: "/api/public/reviews/photos/rvp_1", width: 1600, height: 1200 }]}
      />,
    );
    expect(html).toContain("Photo from Ada&#x27;s review");
    expect(html).toContain('loading="lazy"');
    expect(html).toContain("/api/public/reviews/photos/rvp_1");
  });

  it("renders nothing for a review without photos", () => {
    expect(renderToStaticMarkup(<ReviewPhotoStrip authorName="Ada" photos={[]} />)).toBe("");
  });
});
