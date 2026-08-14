"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { siteConfig } from "@plaspool/brand";

import PlaSpoolSplash from "./splash-engine";
import type { SplashHandle } from "./splash-engine";

/**
 * `/shop` — the opening sequence, and then the shop.
 *
 * This route holds nothing of its own. It plays the animated mark and moves
 * the visitor to `/store`, which is server-rendered independently and is the
 * canonical shop entry. Every internal link that means "the shop" points at
 * `/store`; this exists only so the brand gets one moment on screen.
 *
 * TWO RULES DECIDE HOW LONG THAT MOMENT LASTS, and both are ceilings:
 *
 *   1. `maxMs` — a hard wall-clock cap the engine enforces with a timer rather
 *      than with rAF, so a frame-starved phone ends the sequence SOONER, never
 *      later. An explicit value outranks the engine's default hold.
 *   2. `BACKSTOP_MS` — this file's own timer, which redirects regardless of
 *      what the engine did or did not do.
 *
 * There is deliberately NO FLOOR. The admin app holds its splash for six
 * seconds so two tips can be read; that behaviour in front of a storefront is
 * a conversion and a Core Web Vitals problem, and there is nothing to wait for
 * because `/store` does not depend on this page for anything.
 *
 * The engine is vendored unedited in `splash-engine.js` — it is generated from
 * a review harness that asserts every bug it was built to stop regressing, and
 * editing it silently un-tests it.
 */

const DESTINATION = "/store";

/** The engine's ceiling. `forge` runs 1560 ms; with the default hold the exit
 *  begins around 2580 ms and `onDone` lands around 2760 ms. */
const MAX_MS = 2800;

/**
 * Ours. It exists for the failures `maxMs` cannot cover — a throw inside
 * `mount`, a WebGL context that never comes back, an `onDone` that is somehow
 * never reached. A brand animation must never be the reason someone cannot
 * reach the shop, so the redirect does not depend on the animation succeeding.
 */
const BACKSTOP_MS = MAX_MS + 1500;

const TAGLINE = "3D printing filament, made in Nigeria";

export interface SplashGatewayProps {
  /** Where the gateway hands over to. */
  destination?: string;
}

export function SplashGateway({ destination = DESTINATION }: SplashGatewayProps) {
  const router = useRouter();
  const hostRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    let settled = false;
    let handle: SplashHandle | null = null;

    const go = () => {
      if (settled) return;
      settled = true;
      try {
        handle?.destroy();
      } catch {
        /* The overlay is `pointer-events: none` and the navigation is next;
           a teardown that throws must not stop the handover. */
      }
      router.replace(destination);
    };

    /* Armed before the mount, so a `mount` that throws synchronously is
       already covered by the time the catch runs. */
    const backstop = window.setTimeout(go, BACKSTOP_MS);

    try {
      /* The destination is a static route; warming it means the handover is a
         paint rather than a fetch. Best effort — a failure here is invisible. */
      router.prefetch(destination);
    } catch {
      /* Prefetch is an optimisation, never a precondition. */
    }

    try {
      const host = hostRef.current;
      if (!host) {
        go();
      } else {
        handle = PlaSpoolSplash.mount(host, {
          /* `auto` reads `[data-theme]` and then the OS preference, so the
             splash cannot disagree with the page behind it. */
          theme: "auto",
          /*
            THE MARK ONLY. The name and the tagline below are ours, and this is
            the one non-obvious call in the file.

            `tips: []` looks like the way to drop the tip card and is not:
            `normaliseTips` ends `return out.length ? out : TIPS`, so an empty
            array is treated as "not supplied" and the engine substitutes its
            OWN defaults — which are the admin app's shopkeeper encouragements
            ("Slow days are not the verdict"). Verified on screen before this
            was changed. There is no option that yields zero tips while the
            boot-screen chrome is on.

            `chrome: false` drops the whole boot-screen layout — tip card and
            progress rail, but also the name and tagline, which is why they are
            rendered here instead. That is the better half of the trade anyway:
            they become real text in the store's own type ramp rather than
            engine-drawn glyphs, and a storefront has no boot to narrate.
          */
          chrome: false,
          maxMs: MAX_MS,
          debugHandle: false,
          onDone: go,
        });
      }
    } catch {
      /* Every failure path ends with the visitor in the shop. */
      go();
    }

    return () => {
      window.clearTimeout(backstop);
      try {
        handle?.destroy();
      } catch {
        /* Unmounting; nothing left to protect. */
      }
    };
  }, [router, destination]);

  return (
    <>
      {/*
        Without JavaScript there is no engine and no router, so the browser
        does the redirect instead.

        Written as a raw string rather than as a `<meta>` element because React
        hoists `<meta>` into `<head>` wherever it is rendered — which would lift
        this one out of the `<noscript>` and refresh the page for everyone,
        including the visitors who are watching the animation.

        `destination` is a route this package controls, and it is URI-encoded
        on the way in regardless, so the attribute cannot be broken out of.
      */}
      <noscript
        dangerouslySetInnerHTML={{
          __html: `<meta http-equiv="refresh" content="0; url=${encodeURI(destination)}">`,
        }}
      />

      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 py-24 text-center">
        {/*
          What is under the overlay. It is the whole page for anyone whose
          meta-refresh is disabled, and the accessible content of the route for
          everyone else — the engine's own visual stack is `aria-hidden`, so a
          screen reader lands on a heading and a link rather than on nothing.
        */}
        <h1 className="font-sans text-lg font-semibold text-foreground">
          Opening the {siteConfig.site_name} shop
        </h1>
        <a
          href={destination}
          className="rounded-sm font-sans text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Go to the shop
        </a>
      </div>

      {/*
        The overlay. `pointer-events: none` so a fading layer cannot swallow a
        click meant for the link underneath, and an opaque background so the
        page behind it is not visible through the animation.

        `aria-hidden` on the whole stack: the engine hides its own visual layer
        anyway, and the heading and link above are already the accessible
        content of this route. Announcing the mark twice would be worse.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center gap-7 bg-background"
      >
        {/*
          The engine sizes its mark to this element, so the box is the mark's
          size. Fixed rather than fluid: the sequence is 2.8 seconds long and a
          mark that reflows partway through reads as a bug.
        */}
        <div ref={hostRef} data-splash-host="" className="h-32 w-32 sm:h-40 sm:w-40" />

        <div className="flex flex-col items-center gap-2 px-6 text-center">
          <p className="font-sans text-2xl font-semibold tracking-tight text-foreground">
            {siteConfig.site_name}
          </p>
          <p className="font-sans text-sm text-muted-foreground">{TAGLINE}</p>
        </div>
      </div>
    </>
  );
}
