import { PostPage, postMetadata, postParams } from "@plaspool/blog";

export default PostPage;
export const generateMetadata = postMetadata;
export const generateStaticParams = postParams;
// Must match DETAIL_REVALIDATE in packages/blog/src/data/config.ts.
// Next.js requires route segment config to be a statically analysable
// literal, so this cannot import the constant.
export const revalidate = 3600;
export const dynamicParams = true;
