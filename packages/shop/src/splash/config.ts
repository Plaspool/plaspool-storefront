/**
 * The splash gateway's one switch.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT `/shop` IS, SO THAT TURNING IT OFF MEANS SOMETHING.
 *
 * `/shop` holds no content. It mounts the vendored animation engine, plays the
 * mark for up to 2.8 seconds, and then hands over to `/store` — which is the
 * canonical shop entry and the URL every internal link already uses. See
 * `splash-gateway.tsx` for the two ceilings that bound that hold.
 *
 * `SPLASH_ENABLED = false` removes the sequence. It does NOT shorten it.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ═══ OFF IS A REDIRECT, NOT A FASTER ANIMATION ═══
 * Skipping the hold in the browser would still cost a mount, a paint and the
 * engine's bundle before anything moved — a visitor would watch a blank
 * gateway flash past on the way to the shop, which is a worse version of the
 * thing being removed. So when this is off, `app/shop/page.tsx` redirects on
 * the SERVER and the gateway is never rendered at all: no frame, no engine, no
 * client JavaScript, and it works with scripting disabled.
 *
 * ═══ `/shop` STAYS A ROUTE EITHER WAY, AND MUST ═══
 * It is the installed app's `start_url` — `app/manifest.ts` is emphatic about
 * why, and about why `id` is pinned so `start_url` can move at all. With the
 * splash off the PWA still launches at `/shop`; it simply arrives in the shop
 * immediately instead of after the animation. Deleting the route would break
 * every install already out there.
 *
 * ═══ TO BRING IT BACK ═══
 * Flip `SPLASH_ENABLED` to `true`. Nothing else changes: the engine, the
 * timings and the `noscript` fallback are all still in place, and
 * `SplashGateway` honours this flag itself, so a direct mount cannot disagree
 * with what this file says.
 *
 * A flag that gates nothing is a trap — `data/config.ts` opens with the
 * post-mortem of one that had to be deleted for exactly that. This one gates
 * the engine mount, the hold, and whether `/shop` renders at all.
 */

/**
 * Whether the opening animation plays. `false` sends every visitor straight to
 * `SPLASH_DESTINATION`.
 */
export const SPLASH_ENABLED = false;

/**
 * Where the gateway hands over to, on or off.
 *
 * Lives here rather than beside the engine so the redirect and the animation
 * cannot drift onto different destinations — `SplashGateway` takes this as its
 * default and `app/shop/page.tsx` redirects to it.
 */
export const SPLASH_DESTINATION = "/store";
