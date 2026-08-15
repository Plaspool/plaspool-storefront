import { CATEGORIES, COLOURS, PREMIUM_TIERS, PRODUCTS, STANDARD_TIERS } from "./fixtures";
import type { Category, Product } from "./types";

/**
 * The seam. Today these read a local array; when the commerce API lands they
 * become async fetches and only their bodies change. Nothing outside this file
 * knows the catalog is a fixture.
 */
export function listCategories(): Category[] { return CATEGORIES; }

export function getCategory(slug: string): Category | null {
  return CATEGORIES.find((c) => c.slug === slug) ?? null;
}

export function listProducts(): Product[] { return PRODUCTS; }

export function listProductsByCategory(slug: string): Product[] {
  return PRODUCTS.filter((p) => p.categorySlug === slug);
}

export function listFeaturedProducts(): Product[] {
  return PRODUCTS.filter((p) => p.featured);
}

export function getProduct(slug: string): Product | null {
  return PRODUCTS.find((p) => p.slug === slug) ?? null;
}

export function productPaths(): { slug: string }[] {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

export function categoryPaths(): { category: string }[] {
  return CATEGORIES.map((c) => ({ category: c.slug }));
}

/**
 * Shared catalog vocabulary — not `fixtures.ts` itself, which never leaves
 * this directory, but the colour pool and bulk-tier ladders every product
 * draws from. Other components (colour swatches, the bulk-pricing band) need
 * the same colours and tiers the products use, so they are re-exported here
 * rather than reached through `listProducts()`.
 */
export { COLOURS, STANDARD_TIERS, PREMIUM_TIERS };
