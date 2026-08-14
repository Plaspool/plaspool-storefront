import "./globals.css";

import { cn, ThemeProvider } from "@plaspool/ui";
// Nav and Footer moved to `(site)/layout.tsx` — the shop route group brings its
// own chrome, and rendering both here doubled them on every /store page.
import { CookieBanner, GoogleAnalytics } from "@plaspool/web";
import { siteConfig } from "@plaspool/brand";

import { Inter as FontSans } from "next/font/google";
import { Analytics as VercelAnalytics } from "@vercel/analytics/react";
import Script from "next/script";

import type { Metadata } from "next";

const font = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
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
    <html lang="en" suppressHydrationWarning>
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

      <body className={cn("min-h-screen font-sans antialiased", font.variable)}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(storeJsonLd) }}
        />
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
          defaultTheme="system"
          enableSystem
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
