import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCategory, getProduct, productPaths } from "../data/catalog";
import { getReviewAggregate, listReviews } from "../data/reviews";
import { Breadcrumb } from "../components/breadcrumb";
import { ProductBuySection } from "./buy-section";
import { ProductTabs } from "./product-tabs";
import { OrderInfo } from "./order-info";
import { currencyFromSegment } from "../data/currency-routing";

/**
 * The route's params. `currency` is present only under the `[currency]`
 * segment — its absence IS the default currency, which owns the bare
 * `/store/...` path. See `currency-routing.ts`.
 */
export interface ProductRouteParams {
  slug: string;
  currency?: string;
}

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
  params: Promise<ProductRouteParams>;
}): Promise<Metadata> {
  const { slug, currency: segment } = await params;
  const product = await getProduct(slug, false, currencyFromSegment(segment));
  if (!product) return {};
  return {
    /* Owner-written SEO copy wins VERBATIM — they wrote the whole title, so
       nothing is appended to it. The fallbacks are what this page always
       said: the name with the brand, and the derived summary. */
    title: product.seoTitle ?? `${product.name} — PlaSpool`,
    description: product.seoDescription ?? product.overview,
    /* The default currency's URL, for every variant — see the same note on
       `categoryMetadata`. Two currencies must not compete as duplicate
       content. */
    alternates: { canonical: `/store/products/${slug}` },
  };
}

export async function productParams(): Promise<{ slug: string }[]> {
  return productPaths();
}

export async function ProductPage({
  params,
  fresh = false,
}: {
  params: Promise<ProductRouteParams>;
  /* See `CategoryPage` — a prop rather than a `searchParams` read, so the
     prerendered product page keeps its cache and only `/preview` skips it. */
  fresh?: boolean;
}) {
  // Next 15: page params are a promise.
  const { slug, currency: segment } = await params;
  /* Undefined on the bare `/store/...` path, which is the default currency and
     therefore sends no `?currency=` — see `CategoryPage`. */
  const product = await getProduct(slug, fresh, currencyFromSegment(segment));
  if (!product) notFound();

  const category = await getCategory(product.categorySlug, fresh);

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
