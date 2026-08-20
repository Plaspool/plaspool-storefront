import type { MetadataRoute } from "next";

/**
 * The installed app is THE SHOP, not the whole site.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * `id` IS LOAD-BEARING AND MUST NOT BE REMOVED OR CHANGED.
 *
 * A manifest with no `id` gets one implicitly: `start_url`. So the day
 * `start_url` moved from `/` to `/shop`, every browser that had already
 * installed this app would have decided the manifest now described a
 * DIFFERENT app — and kept launching the old one at `/`. The change would
 * have appeared to work on any fresh device and to do nothing at all on the
 * machine of anybody who already had it installed.
 *
 * Pinning `id` to `/` — the value the implicit id already had — keeps the
 * identity of existing installs while freeing `start_url` to move. It is the
 * one line here that exists for installs that happened in the past, which is
 * exactly why it looks removable and is not.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "PlaSpool — 3D Printing Filament",
    short_name: "PlaSpool",
    description: "Buy 3D printing filament in Nigeria.",

    /*
     * `/shop` IS THE SPLASH GATEWAY, NOT A PAGE. It plays the animated mark
     * and then `router.replace()`s to `/store` — see `splash-gateway.tsx`.
     * Launching there is what gives the installed app an opening animation
     * instead of dropping the shopper onto the marketing landing page at `/`.
     *
     * The OS still paints its own splash — the icon below on
     * `background_color` — before any of this runs. That screen belongs to
     * the platform and cannot be replaced by web content; the animation is
     * the first thing the WEB draws, immediately after it.
     *
     * `replace()` rather than `push()` in the gateway matters here: the app
     * opens with `/store` as the only history entry, so there is no back
     * gesture that lands on a splash the shopper already sat through.
     */
    start_url: "/shop",

    /*
     * SCOPE STAYS THE ORIGIN ROOT, DELIBERATELY.
     *
     * It reads like the natural place to fence the app down to the shop, and
     * it is not: `/cart`, `/checkout`, `/account/*` and `/sign-in` are all
     * SIBLINGS of `/store`, so the only prefix that contains the whole
     * purchase flow is `/`. A tighter scope would eject checkout into a
     * browser tab mid-purchase.
     *
     * The store-only feel comes from `.pwa-hide` in `globals.css` — a
     * `display-mode: standalone` media query that drops the blog and
     * marketing entry points from the chrome. See that file.
     */
    scope: "/",

    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#231c50",

    /*
     * TODO(brand): add a MASKABLE icon. Android composites a non-maskable
     * icon by letterboxing it inside the adaptive shape, which is why the
     * launcher icon reads as "the logo, floating on a background". Fixing it
     * needs a NEW asset, not a new `purpose` string: a maskable icon must
     * keep its content inside the middle 80% safe zone, and declaring this
     * un-padded 1024px mark as `purpose: "maskable"` would crop it instead.
     * Ship `icon-maskable.png` with the padding baked in, then add it here as
     * a second entry alongside this one.
     */
    icons: [{ src: "/brand/icon.png", sizes: "1024x1024", type: "image/png" }],
  };
}
