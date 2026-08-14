import { WaitlistPage } from "../../../src/waitlist/waitlist-page";

/**
 * Harness mount. Note that `embed.js` is loaded by the host app's root layout
 * and not here, so the container stays inert in the harness and only the
 * iframe renders — which is the half of the embed worth looking at for layout.
 */
export default function Page() {
  return <WaitlistPage />;
}
