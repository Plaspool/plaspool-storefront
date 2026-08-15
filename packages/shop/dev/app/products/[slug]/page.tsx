import { notFound } from "next/navigation";

import { getProduct, productPaths } from "../../../../src/data/catalog";
import { ProductBuySection } from "../../../../src/product/buy-section";
import { ProductTabs } from "../../../../src/product/product-tabs";
import { OrderInfo } from "../../../../src/product/order-info";

/** Harness route for the whole product page: buy side, tabs and order info. */

export function generateStaticParams() {
  return productPaths();
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  // Next 15: page params are a promise.
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <ProductBuySection product={product} />

      <div className="mt-8">
        <ProductTabs product={product} />
      </div>

      <OrderInfo className="mt-6" />
    </div>
  );
}
