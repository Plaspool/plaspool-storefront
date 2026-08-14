// This file is the entire public surface of @plaspool/shop. Anything the
// host app or the dev harness needs from this package is exported from here.
// It starts empty; each later task appends its own exports as it lands.
export * from "./data/types";
export * from "./data/money";
export * from "./data/config";
export * from "./data/catalog";

// Presentational primitives. Every later surface — cards, listings, the
// product page, the cart — composes from these.
export * from "./components/spool-image";
export * from "./components/price";
export * from "./components/colour-swatches";
export * from "./components/rating-stars";
export * from "./components/empty-state";
export * from "./components/breadcrumb";
export * from "./components/quantity-stepper";
export * from "./components/bulk-tier-table";
export * from "./components/product-card";
export * from "./components/product-grid";

// The cart. Browser-local, localStorage-persisted, with bulk-tier
// recalculation. `storage.ts` stays internal — everything outside `cart/`
// goes through `useCart()`, never through `readCart`/`writeCart` directly.
export * from "./cart/types";
export * from "./cart/cart-context";
export * from "./cart/cart-drawer";
export * from "./cart/add-to-cart";

// The shop's own chrome — announcement bar, sticky nav, footer, and the
// shell that composes them around the cart. Tasks 8 and 9 mount their pages
// inside `ShopShell`.
export * from "./chrome/announcement-bar";
export * from "./chrome/shop-nav";
export * from "./chrome/shop-footer";
export * from "./chrome/shop-shell";

// `/store` — the shop home. Six sections between the shell's chrome, plus the
// metadata the host route re-exports.
export * from "./home/hero-carousel";
export * from "./home/category-tiles";
export * from "./home/featured-products";
export * from "./home/why-shop";
export * from "./home/bulk-promo";
export * from "./home/blog-strip";
export * from "./home/home-page";

// `/store/[category]` — the listing. Filter state lives in the URL, so the
// grid stays server-rendered and a filtered view is shareable; the rail,
// drawer, search and sort are the only client code.
export * from "./listing/filter-state";
export * from "./listing/filter-rail";
export * from "./listing/filter-drawer";
export * from "./listing/listing-search";
export * from "./listing/sort-select";
export * from "./listing/listing-page";

// `CardAddButton` was extracted out of `product-card.tsx` so that the card
// itself could go back to being a server component; this is the only part of
// it that needs `"use client"`.
export * from "./components/card-add-button";
