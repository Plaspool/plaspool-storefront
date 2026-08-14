import { PostsIndexPage, postsIndexMetadata } from "@plaspool/blog";

export default PostsIndexPage;
export const metadata = postsIndexMetadata;
// Must match LIST_REVALIDATE in packages/blog/src/data/config.ts.
// Next.js requires route segment config to be a statically analysable
// literal, so this cannot import the constant.
export const revalidate = 300;
