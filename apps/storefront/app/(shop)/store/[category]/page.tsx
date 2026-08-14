import { CategoryPage, categoryMetadata, categoryParams } from "@plaspool/shop";

export default CategoryPage;
export const generateMetadata = categoryMetadata;
export const generateStaticParams = categoryParams;

/* The catalog is a fixture today; five minutes is the window a merchandising
   change would take to reach a listing once it is a real API. */
export const revalidate = 300;
