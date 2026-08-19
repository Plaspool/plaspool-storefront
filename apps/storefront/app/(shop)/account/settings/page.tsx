import { AccountSettingsPage } from "@plaspool/shop";

export const dynamic = "force-dynamic";

export default AccountSettingsPage;

/* Per-customer state, same reasoning as `/account/orders`: the identity here is
   cookie-identified, so nothing is fetched on the server and `force-dynamic`
   keeps this segment out of the static shell rather than letting one customer's
   name get baked into a page the Worker's cache could hand to the next
   visitor. */
