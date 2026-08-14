"use client";

import { useEffect } from "react";
import * as CookieConsent from "vanilla-cookieconsent";
import "vanilla-cookieconsent/dist/cookieconsent.css";

/**
 * Mounted in the root layout, so consent is offered on EVERY route.
 *
 * It previously ran from `apps/storefront/app/page.tsx`, which meant the banner
 * only ever appeared on the homepage — anyone landing on a blog post from
 * search was tracked with no notice and no way to object.
 *
 * The categories and copy below are the existing configuration relocated, not
 * rewritten. Only the placeholder cookie-table descriptions and the dead
 * `#contact-page` anchor were replaced, and links to the legal pages added.
 */
export function CookieBanner() {
  useEffect(() => {
    CookieConsent.run({
      cookie: {
        name: "cc_cookie",
        expiresAfterDays: 7,
      },

      guiOptions: {
        consentModal: {
          layout: "cloud inline",
          position: "bottom center",
          equalWeightButtons: true,
          flipButtons: false,
        },
        preferencesModal: {
          layout: "box",
          equalWeightButtons: true,
          flipButtons: false,
        },
      },

      categories: {
        necessary: {
          enabled: true, // this category is enabled by default
          readOnly: true, // this category cannot be disabled
        },
        analytics: {
          autoClear: {
            cookies: [{ name: /^_ga/ }, { name: "_gid" }],
          },
          services: {
            ga: {
              label: "Google Analytics",
              onAccept: () => {},
              onReject: () => {},
            },
            youtube: {
              label: "Youtube Embed",
              onAccept: () => {},
              onReject: () => {},
            },
          },
        },
        ads: {},
      },

      language: {
        default: "en",
        translations: {
          en: {
            consentModal: {
              title: "We use cookies",
              description:
                "We use cookies to improve your experience and gather simple analytics. By continuing, you agree to our use of cookies.",
              acceptAllBtn: "Accept all",
              acceptNecessaryBtn: "Reject all",
              showPreferencesBtn: "Manage Individual preferences",
              footer:
                '<a href="/privacy">Privacy policy</a>\n<a href="/terms">Terms of service</a>',
            },
            preferencesModal: {
              title: "Manage cookie preferences",
              acceptAllBtn: "Accept all",
              acceptNecessaryBtn: "Reject all",
              savePreferencesBtn: "Accept current selection",
              closeIconLabel: "Close modal",
              serviceCounterLabel: "Service|Services",
              sections: [
                {
                  title: "Your Privacy Choices",
                  description:
                    "In this panel you can express some preferences related to the processing of your personal information. You may review and change expressed choices at any time by resurfacing this panel via the provided link. To deny your consent to the specific processing activities described below, switch the toggles to off or use the “Reject all” button and confirm you want to save your choices.",
                },
                {
                  title: "Strictly Necessary",
                  description:
                    "These cookies are essential for the proper functioning of the website and cannot be disabled.",
                  linkedCategory: "necessary",
                },
                {
                  title: "Performance and Analytics",
                  description:
                    "These cookies collect information about how you use our website. All of the data is anonymized and cannot be used to identify you. Nothing is loaded until you accept.",
                  linkedCategory: "analytics",
                  cookieTable: {
                    caption: "Cookie table",
                    headers: {
                      name: "Cookie",
                      domain: "Domain",
                      desc: "Description",
                    },
                    body: [
                      {
                        name: "_ga",
                        domain: window.location.hostname,
                        desc: "Google Analytics — distinguishes returning visitors.",
                      },
                      {
                        name: "_gid",
                        domain: window.location.hostname,
                        desc: "Google Analytics — distinguishes visitors within a session.",
                      },
                    ],
                  },
                },
                {
                  title: "Targeting and Advertising",
                  description:
                    "These cookies are used to make advertising messages more relevant to you and your interests. The intention is to display ads that are relevant and engaging for the individual user and thereby more valuable for publishers and third party advertisers.",
                  linkedCategory: "ads",
                },
                {
                  title: "More information",
                  description:
                    'For any queries in relation to our policy on cookies and your choices, please <a href="/contact">contact us</a>.',
                },
              ],
            },
          },
        },
      },
    });
  }, []);

  return null;
}
