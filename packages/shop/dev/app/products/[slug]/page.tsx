import { notFound } from "next/navigation";

import { getProduct, productPaths } from "../../../../src/data/catalog";
import { getReviewAggregate, listReviews } from "../../../../src/data/reviews";
import { ProductBuySection } from "../../../../src/product/buy-section";
import { ProductTabs } from "../../../../src/product/product-tabs";
import { OrderInfo } from "../../../../src/product/order-info";

/** Harness route for the whole product page: buy side, tabs and order info. */

/* Both of these went async when the catalogue moved from a local array to the
   commerce API, and this harness route never caught up — it was passing a
   `Promise<Product | null>` to components expecting a `Product`. */
export async function generateStaticParams() {
  return productPaths();
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  // Next 15: page params are a promise.
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  /* Fetched HERE, on the server, exactly as `ProductPage` does it — both the
     buy side's star line and the reviews tab take them as props rather than
     fetching for themselves. Both calls are cached and neither throws. */
  const [reviewAggregate, reviewPage] = await Promise.all([
    getReviewAggregate(product.slug),
    listReviews(product.slug),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <ProductBuySection product={product} reviewAggregate={reviewAggregate} />

      <div className="mt-8">
        <ProductTabs
          product={product}
          reviewAggregate={reviewAggregate}
          initialReviews={reviewPage.items}
          initialReviewCursor={reviewPage.nextCursor}
        />
      </div>

      <OrderInfo className="mt-6" />
    </div>
  );
}
