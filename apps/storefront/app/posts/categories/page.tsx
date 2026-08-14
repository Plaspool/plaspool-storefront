import { CategoriesPage, categoriesPageMetadata } from "@plaspool/blog";

export default CategoriesPage;
export const metadata = categoriesPageMetadata;
// Must match DETAIL_REVALIDATE in packages/blog/src/data/config.ts.
// Next.js requires route segment config to be a statically analysable
// literal, so this cannot import the constant.
export const revalidate = 3600;
