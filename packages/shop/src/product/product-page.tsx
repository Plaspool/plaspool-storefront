import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCategory, getProduct, productPaths } from "../data/catalog";
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

      <ProductBuySection product={product} className="mt-6" />

      {/* Extra bottom room so the last of the page is not sitting under the
          sticky buy bar. */}
      <div className="mt-12 pb-24">
        <ProductTabs product={product} />
        <OrderInfo className="mt-6" />
      </div>
    </div>
  );
}

export default ProductPage;
