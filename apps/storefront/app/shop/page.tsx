import { redirect } from "next/navigation";
import {
  SPLASH_DESTINATION,
  SPLASH_ENABLED,
  SplashGateway,
  shopGatewayMetadata,
} from "@plaspool/shop";

export const metadata = shopGatewayMetadata;

/**
 * `/shop` — the opening sequence, or nothing at all.
 *
 * THE REDIRECT IS HERE, ON THE SERVER, rather than inside the gateway: with
 * the splash off there is no reason to ship the engine, mount a component and
 * paint a frame on the way to `/store`. See `splash/config.ts` for the switch
 * and for why this route still has to exist when it is off — it is the
 * installed app's `start_url`.
 */
export default function Page() {
  if (!SPLASH_ENABLED) redirect(SPLASH_DESTINATION);
  return <SplashGateway />;
}
