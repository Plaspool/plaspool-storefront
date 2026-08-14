import { TagsPage, tagsPageMetadata } from "@plaspool/blog";

export default TagsPage;
export const metadata = tagsPageMetadata;
// Must match DETAIL_REVALIDATE in packages/blog/src/data/config.ts.
// Next.js requires route segment config to be a statically analysable
// literal, so this cannot import the constant.
export const revalidate = 3600;
