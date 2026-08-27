import "./globals.css";
// The blog's ported design system — scoped under `.blog`, so importing it
// globally costs nothing on shop routes. See packages/blog/src/styles/blog.css.
import "@plaspool/blog/styles.css";

import { cn, JsonLd, ThemeProvider } from "@plaspool/ui";
// Nav and Footer moved to `(site)/layout.tsx` — the shop route group brings its
// own chrome, and rendering both here doubled them on every /store page.
import { CookieBanner, GoogleAnalytics } from "@plaspool/web";
import { siteConfig } from "@plaspool/brand";

import { Inter as FontSans, JetBrains_Mono, Spectral } from "next/font/google";
import { Analytics as VercelAnalytics } from "@vercel/analytics/react";
import Script from "next/script";

import type { Metadata } from "next";

const font = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

/*
 * The blog's faces (#15): Spectral for display/prose, JetBrains Mono for
 * code — the same faces the admin app's tokens name, self-hosted by
 * next/font at build time so the CSP's `font-src 'self'` stays true.
 *
 * `preload: false` on both, deliberately: preload would put six Spectral
 * files in the <head> of every shop page that never draws a serif glyph.
 * Without it the browser only fetches a face when rendered text actually
 * uses it, so shop routes pay nothing and blog routes swap in a fallback
 * serif for the first paint — the right trade for faces only one section
 * of the site uses.
 */
const spectral = Spectral({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-spectral",
  preload: false,
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  preload: false,
});

const TITLE = "PlaSpool — Buy 3D Printing Filament in Nigeria";
const DESCRIPTION = siteConfig.site_description;

export const metadata: Metadata = {
  title: { default: TITLE, template: "%s | PlaSpool" },
  description: DESCRIPTION,
  metadataBase: new URL(siteConfig.site_domain),
  applicationName: "PlaSpool",
  keywords: [
    "3d printing filament nigeria",
    "buy pla filament nigeria",
    "pla filament lagos",
    "3d printer filament",
    "bulk filament nigeria",
    "petg filament nigeria",
    "made in nigeria filament",
  ],
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  icons: {
    icon: "/brand/icon.png",
    apple: "/brand/icon.png",
  },
  // `openGraph.images` and `twitter.images` are deliberately omitted:
  // app/opengraph-image.tsx supplies them by file convention, and naming them
  // here would override it.
  openGraph: {
    type: "website",
    siteName: "PlaSpool",
    title: TITLE,
    description: DESCRIPTION,
    url: siteConfig.site_domain,
    locale: "en_NG",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const storeJsonLd = {
  "@context": "https://schema.org",
  "@type": "OnlineStore",
  name: "PlaSpool",
  description: siteConfig.site_description,
  url: siteConfig.site_domain,
  logo: `${siteConfig.site_domain}/brand/icon.png`,
  areaServed: { "@type": "Country", name: "Nigeria" },
  knowsAbout: [
    "3D printing",
    "PLA filament",
    "PETG filament",
    "additive manufacturing",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    /*
     * `data-scroll-behavior="smooth"` PRESERVES A BEHAVIOUR NEXT 16 STOPPED
     * DOING FOR US.
     *
     * `globals.css` sets `html { scroll-behavior: smooth }`, which is wanted for
     * in-page anchors — the product tab strip, and the hero's second CTA
     * whenever the bulk band has a ladder to show again.
     * Through Next 15, Next overrode it during SPA route transitions so a
     * navigation still landed at the top instantly instead of animating the
     * whole page up.
     *
     * Next 16 no longer overrides it unless this attribute says to. Without it,
     * every route change would smooth-scroll the viewport, which on a long
     * listing reads as the page sliding around after a click.
     */
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#231c50" />
        {/* Waitlister stays: /shop still uses the embed in Phase 1. */}
        <link rel="preload" href="https://waitlister.me/js/embed.js" as="script" />
        <Script
          src="https://waitlister.me/js/embed.js"
          strategy="afterInteractive"
          async
        />
      </head>

      <body
        /*
         * `font-mono` IS THE SITE'S VOICE, AND THIS IS THE ONE PLACE THAT SAYS SO.
         *
         * It was `font-sans`, which was never what the site looked like: the
         * nav, the footer, the home page and /contact all set `font-mono` on
         * themselves, and the blog's tokens now resolve to the same face. The
         * only surface actually drawing Inter was the shop — not by decision
         * but by inheriting this default and then restating it on 251
         * elements, which is why turning the blog monospaced left /store and
         * every product page behind.
         *
         * Those 251 declarations are gone with this change. Anything that
         * genuinely wants Inter can still ask for `font-sans` and get it;
         * `--font-sans` is still loaded. The point is that wanting it now has
         * to be a decision somebody writes down, rather than the thing that
         * happens when nobody says anything.
         */
        className={cn(
          "min-h-screen font-mono antialiased",
          font.variable,
          spectral.variable,
          jetbrainsMono.variable,
        )}
      >
        <JsonLd data={storeJsonLd} />
        {/* Skip link: first focusable element on the page. Visually hidden
            until it receives keyboard focus, then jumps to <main id="content">. */}
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-md focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-brand-ink focus:shadow-lg"
        >
          Skip to content
        </a>
        <ThemeProvider
          attribute="class"
          // Light mode is a product decision, not a fallback: the brand ramp, the
          // spool artwork and the marketing chrome are all designed against a
          // white ground. forcedTheme pins it so a visitor's OS dark-mode
          // preference cannot flip the site into a palette nothing was designed
          // for. Remove forcedTheme (and restore enableSystem) if a theme toggle
          // is ever put back in front of users.
          defaultTheme="light"
          enableSystem={false}
          forcedTheme="light"
          disableTransitionOnChange
        >
          {/* Chrome belongs to the route groups, not here: `(site)` carries the
              marketing nav and footer, `(shop)` carries the shop's own via
              ShopShell. Each supplies its own <main id="content"> as the skip
              link's target. The root layout owns only what is genuinely global. */}
          {children}
        </ThemeProvider>
        <CookieBanner />
        <GoogleAnalytics />
        <VercelAnalytics />
      </body>
    </html>
  );
}
