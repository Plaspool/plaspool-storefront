import { ProductPage, productMetadata, productParams } from "@plaspool/shop";

export default ProductPage;
export const generateMetadata = productMetadata;
export const generateStaticParams = productParams;

/* The catalog is a fixture today; an hour is the window a price or stock
   change would take to reach a product page once it is a real API. */
export const revalidate = 3600;
