import { notFound } from "next/navigation";

import { getProduct, productPaths } from "../../../../src/data/catalog";
import { ProductTabs } from "../../../../src/product/product-tabs";
import { OrderInfo } from "../../../../src/product/order-info";

/**
 * Harness route for the product page's lower half — the tabs and the order
 * info. The gallery, buy box and sticky buy bar land with Task 10, which
 * depends on the cart.
 */

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
      <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground">
        {product.name}
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{product.summary}</p>

      <div className="mt-8">
        <ProductTabs product={product} />
      </div>

      <OrderInfo className="mt-6" />
    </div>
  );
}
