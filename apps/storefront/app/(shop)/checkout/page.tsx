import { CheckoutFlow } from "@plaspool/shop";

export default CheckoutFlow;

/* Same reasoning as `/cart`: everything here is per-visitor state driven from
   the browser (the cart, the checkout API's cookie-identified cart id). No
   server-side fetch of its own, so no revalidate window to declare and
   nothing here can shorten `/store`'s. */
