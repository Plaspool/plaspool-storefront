import { CartPage } from "@plaspool/shop";

export default CartPage;

/* Per-visitor state — the cart is a cookie, read only in the browser (see
   `cart-api.ts`). Nothing here fetches on the server, so this carries no
   revalidate window of its own and cannot drag `/store`'s down; the shell's
   own catalogue fetch keeps its 300s window regardless of what this route
   does. */
