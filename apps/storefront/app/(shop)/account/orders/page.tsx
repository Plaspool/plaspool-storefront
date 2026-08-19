import { OrdersListPage } from "@plaspool/shop";

export const dynamic = "force-dynamic";

export default OrdersListPage;

/* Per-customer state, same reasoning as `/cart` and `/checkout`: `GET
   /orders` is cookie-identified, so nothing here fetches on the server —
   `force-dynamic` keeps this segment out of the static shell rather than
   letting one customer's order list get baked into a page the Worker's
   cache could hand to the next visitor. Carries no revalidate window of its
   own and cannot drag `/store`'s down. */
