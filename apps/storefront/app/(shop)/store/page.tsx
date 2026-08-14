import { StoreHomePage, storeHomeMetadata } from "@plaspool/shop";

export default StoreHomePage;
export const metadata = storeHomeMetadata;

/* The catalog is a fixture today, but the blog strip is a live fetch. Five
   minutes is the window a new post can take to reach the shop home. */
export const revalidate = 300;
