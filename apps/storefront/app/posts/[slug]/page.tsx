import { PostPage, postMetadata, postParams, DETAIL_REVALIDATE } from "@plaspool/blog";

export default PostPage;
export const generateMetadata = postMetadata;
export const generateStaticParams = postParams;
export const revalidate = DETAIL_REVALIDATE;
export const dynamicParams = true;
