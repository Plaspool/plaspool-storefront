import { SplashGateway } from "../../../src/splash/splash-gateway";

/**
 * Harness mount for the `/shop` gateway.
 *
 * The destination is overridden because `/store` is the host app's route and
 * does not exist here — landing on a harness page proves the handover fired,
 * where a 404 would only prove that something happened.
 */
export default function Page() {
  return <SplashGateway destination="/shop/landed" />;
}
