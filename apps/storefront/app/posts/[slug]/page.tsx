import { PostPage, postMetadata, postParams } from "@plaspool/blog";

export default PostPage;
export const generateMetadata = postMetadata;
export const generateStaticParams = postParams;
export const revalidate = 3600;
export const dynamicParams = true;
