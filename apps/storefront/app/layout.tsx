import "./globals.css";

import {
  Button,
  cn,
  Container,
  Section,
  ThemeProvider,
  ThemeToggle,
} from "@plaspool/ui";
import {
  contentMenu,
  Footer,
  mainMenu,
  MobileNav,
  Nav,
} from "@plaspool/web";
import { siteConfig } from "@plaspool/brand";

import { Inter as FontSans } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import Script from "next/script";

import Balancer from "react-wrap-balancer";
import Logo from "@/public/logo.svg";
import Image from "next/image";
import Link from "next/link";

import type { Metadata } from "next";

const font = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Plaspool - Buy 3D Printing Filaments in Nigeria",
  description: "PLA filaments for high‑quality 3D printing in Nigeria. Durable, affordable, and ready to ship nationwide. Trusted by makers, printing labs, and tested for precision.",
  metadataBase: new URL(siteConfig.site_domain),
  keywords: "3d printing, filaments, PLA, CNC",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "/brand/icon.png",
  },
  openGraph: {
    type: "website",
    title: "Plaspool - Buy 3D Printing Filaments in Nigeria",
    description: "PLA filaments for high‑quality 3D printing in Nigeria. Durable, affordable, and ready to ship nationwide. Trusted by makers, printing labs, and tested for precision.",
    url: siteConfig.site_domain,
    images: [
      {
        url: `${siteConfig.site_domain}/layers.png`,
        width: 1200,
        height: 630,
        alt: "Plaspool - 3D Printing Filaments",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Plaspool",
    description: "PLA filaments for high‑quality 3D printing in Nigeria. Durable, affordable, and ready to ship nationwide. Trusted by makers, printing labs, and tested for precision.",
    images: [`${siteConfig.site_domain}/layers.png`],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="robots" content="index, follow" />
        <meta name="googlebot" content="index,follow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          rel="preload"
          href="https://waitlister.me/js/embed.js"
          as="script"
        ></link>
        <meta name="theme-color" content="#FFFFFF" />
        <Script
          src="https://waitlister.me/js/embed.js"
          strategy="afterInteractive"
          async
        />
        <Script
          src="https://cdn.jsdelivr.net/gh/orestbida/cookieconsent@3.1.0/dist/cookieconsent.umd.js"
          strategy="afterInteractive"
          async
        />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-40STPM61PP"
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-40STPM61PP');
          `}
        </Script>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orestbida/cookieconsent@3.1.0/dist/cookieconsent.css"
        ></link>
      </head>

      <body className={cn("min-h-screen font-sans antialiased", font.variable)}>
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
          <Nav />
          {/* tabIndex={-1}: programmatically focusable as the skip link's
              jump target, without joining the normal Tab order. */}
          <main id="content" tabIndex={-1} className="focus:outline-none">
            {children}
          </main>
          <Footer />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
