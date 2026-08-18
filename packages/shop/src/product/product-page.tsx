import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCategory, getProduct, productPaths } from "../data/catalog";
import { getReviewAggregate, listReviews } from "../data/reviews";
import { Breadcrumb } from "../components/breadcrumb";
import { ProductBuySection } from "./buy-section";
import { ProductTabs } from "./product-tabs";
import { OrderInfo } from "./order-info";

/**
 * `/store/products/<slug>` — the page the whole store points at.
 *
 * A server component: only the buy side and the tabs are client code, and
 * both draw their own boundary. Everything above them — the trail, the
 * layout, the order info — renders on the server.
 */

export async function productMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) return {};
  return {
    title: `${product.name} — PlaSpool`,
    description: product.summary,
    alternates: { canonical: `/store/products/${slug}` },
  };
}

export function productParams(): { slug: string }[] {
  return productPaths();
}

export async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  // Next 15: page params are a promise.
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();

  const category = getCategory(product.categorySlug);

  /* Reviews are fetched HERE, on the server, rather than in the tab that
     shows them: the approved reviews then arrive in the HTML — visible to a
     crawler, and costing the reader no round trip to read what is already
     the page's most persuasive content. Both calls are cached (see
     `REVIEWS_REVALIDATE`) and neither can throw, so a review service having
     a bad day cannot take a product page down with it. */
  const [reviewAggregate, reviewPage] = await Promise.all([
    getReviewAggregate(product.slug),
    listReviews(product.slug),
  ]);

  return (
    <div
      className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 md:py-10 lg:px-8"
      /* The tab strip sticks under the shop's nav, whose height (h-16) belongs
         to the chrome rather than to the tabs. The page that composes both is
         the right place to tell one about the other. */
      style={{ "--shop-subnav-offset": "4rem" } as CSSProperties}
    >
      <Breadcrumb
        trail={[
          { label: "Home", href: "/" },
          { label: "Store", href: "/store" },
          ...(category ? [{ label: category.name, href: `/store/${category.slug}` }] : []),
          { label: product.name },
        ]}
      />

      <ProductBuySection
        product={product}
        reviewAggregate={reviewAggregate}
        className="mt-6"
      />

      {/* Clearance for the sticky buy bar is reserved by ShopShell, not here:
          it has to cover the footer too, which is outside this page. */}
      <div className="mt-12">
        <ProductTabs
          product={product}
          reviewAggregate={reviewAggregate}
          initialReviews={reviewPage.items}
          initialReviewCursor={reviewPage.nextCursor}
        />
        <OrderInfo className="mt-6" />
      </div>
    </div>
  );
}

export default ProductPage;
