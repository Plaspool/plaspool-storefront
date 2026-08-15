import { CategoryPage, categoryMetadata, categoryParams } from "@plaspool/shop";

/* The harness mirrors the host route one level up: `/pla` here is
   `/store/pla` there, against clean shop chrome. */
export default CategoryPage;
export const generateMetadata = categoryMetadata;
export const generateStaticParams = categoryParams;
