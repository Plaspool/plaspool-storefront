// This file is the entire public surface of @plaspool/shop. Anything the
// host app or the dev harness needs from this package is exported from here.
// It starts empty; each later task appends its own exports as it lands.
export * from "./data/types";
export * from "./data/money";
export * from "./data/config";
export * from "./data/reviews";
export * from "./data/catalog";
export * from "./data/auth-api";
export * from "./data/checkout-api";
/* A signed-in customer's points balance and history (admin#2). The checkout's
   offer and the account summary both read it; neither spells a points noun. */
export * from "./data/points-api";

// Presentational primitives. Every later surface — cards, listings, the
// product page, the cart — composes from these.
export * from "./components/spool-image";
export * from "./components/product-photo";
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
export * from "./home/rewards-band";
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

// The `/shop` gateway. The engine itself is vendored and not re-exported —
// nothing outside `./splash` should mount it directly.
export * from "./splash/splash-gateway";
export * from "./splash/metadata";

// Product detail. The gallery, buy box and sticky buy bar land with Task 10,
// which needs the cart; these are the parts below them that do not.
export * from "./product/product-tabs";
export * from "./product/overview-tab";
export * from "./product/description-tab";
export * from "./product/parameters-tab";
export * from "./product/reviews-tab";
export * from "./product/review-form";
export * from "./product/order-info";

// The buy side of the product page. `ProductBuySection` is the one that
// matters — it owns the selected colour, size and quantity that the gallery,
// the buy box and the sticky bar all read.
export * from "./product/gallery";
export * from "./product/buy-box";
export * from "./product/sticky-buy-bar";
export * from "./product/buy-section";

// The relocated Waitlister embed, which collects real signups.
export * from "./waitlist/waitlist-page";
export * from "./waitlist/waitlist-embed";
export * from "./waitlist/metadata";

// The assembled `/store/products/<slug>`, and the metadata and static params
// the host route re-exports.
export * from "./product/product-page";

// Checkout: cart entry, the address/delivery/contact/review flow, and the
// Paystack return route. See `checkout/checkout-flow.tsx` for why it is one
// component rather than one route per step.
export * from "./checkout/checkout-flow";
export * from "./checkout/checkout-complete";
export * from "./checkout/cart-page";

// Order history: `/account/orders` (the signed-in list) and
// `/account/orders/[orderNumber]` (one order, signed-in or guest-with-token).
export * from "./data/orders-api";
export * from "./account/orders-list";
export * from "./account/avatar";
export * from "./account/account-menu";
export * from "./account/settings-page";
export * from "./account/order-detail";
