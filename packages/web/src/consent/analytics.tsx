"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import * as CookieConsent from "vanilla-cookieconsent";

const GA_ID = "G-40STPM61PP";

/**
 * GA4, and NOT BEFORE CONSENT. The tag previously loaded from the root layout
 * on every page view regardless of choice, which is the thing a consent banner
 * exists to prevent.
 *
 * Expect reported analytics volume to fall once this ships. That is the correct
 * behaviour, not a regression.
 */
export function GoogleAnalytics() {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const check = () => setAllowed(CookieConsent.acceptedCategory("analytics"));
    check();
    window.addEventListener("cc:onConsent", check);
    window.addEventListener("cc:onChange", check);
    return () => {
      window.removeEventListener("cc:onConsent", check);
      window.removeEventListener("cc:onChange", check);
    };
  }, []);

  if (!allowed) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
    </>
  );
}
