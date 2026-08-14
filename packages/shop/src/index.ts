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
export * from "./product/order-info";

// The relocated Waitlister embed, which collects real signups.
export * from "./waitlist/waitlist-page";
export * from "./waitlist/waitlist-embed";
export * from "./waitlist/metadata";
