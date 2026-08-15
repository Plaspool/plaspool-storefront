import { StoreHomePage, storeHomeMetadata } from "@plaspool/shop";

/* The harness root is the shop home, so `/store` can be checked against clean
   chrome — the real host still renders the marketing nav and footer around it
   until Phase 1 moves them into a `(site)` group. */
export const metadata = storeHomeMetadata;

export default StoreHomePage;
