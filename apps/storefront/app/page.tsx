"use client";

// Craft Imports
import { Section, Container, Prose } from "@plaspool/ui";
import Balancer from "react-wrap-balancer";
import { PlaspoolLanding } from "@plaspool/web";
import "vanilla-cookieconsent/dist/cookieconsent.css";
import * as CookieConsent from "vanilla-cookieconsent";
import { useEffect } from "react";

// Next.js Imports
import Link from "next/link";

// Icons
import { File, Pen, Tag, Diamond, User, Folder } from "lucide-react";
import { WordPressIcon } from "@/components/icons/wordpress";
import { NextJsIcon } from "@/components/icons/nextjs";



// This page is using the craft.tsx component and design system
export default function Home() {
   useEffect(() => {
       CookieConsent.run({
            // root: 'body',
            // autoShow: true,
            // disablePageInteraction: true,
            // hideFromBots: true,
            // mode: 'opt-in',
            // revision: 0,

            cookie: {
              name: "cc_cookie",
              // domain: location.hostname,
              // path: '/',
              // sameSite: "Lax",
              expiresAfterDays: 7,
            },

            // https://cookieconsent.orestbida.com/reference/configuration-reference.html#guioptions
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

            onFirstConsent: ({ cookie }) => {
              console.log("onFirstConsent fired", cookie);
            },

            onConsent: ({ cookie }) => {
              console.log("onConsent fired!", cookie);
            },

            onChange: ({ changedCategories, changedServices }) => {
              console.log(
                "onChange fired!",
                changedCategories,
                changedServices
              );
            },

            onModalReady: ({ modalName }) => {
              console.log("ready:", modalName);
            },

            onModalShow: ({ modalName }) => {
              console.log("visible:", modalName);
            },

            onModalHide: ({ modalName }) => {
              console.log("hidden:", modalName);
            },

            categories: {
              necessary: {
                enabled: true, // this category is enabled by default
                readOnly: true, // this category cannot be disabled
              },
              analytics: {
                autoClear: {
                  cookies: [
                    {
                      name: /^_ga/, // regex: match all cookies starting with '_ga'
                    },
                    {
                      name: "_gid", // string: exact cookie name
                    },
                  ],
                },

                // https://cookieconsent.orestbida.com/reference/configuration-reference.html#category-services
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
                    // closeIconLabel: 'Reject all and close modal',
                  
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
                        description: `In this panel you can express some preferences related to the processing of your personal information. You may review and change expressed choices at any time by resurfacing this panel via the provided link. To deny your consent to the specific processing activities described below, switch the toggles to off or use the “Reject all” button and confirm you want to save your choices.`,
                      },
                      {
                        title: "Strictly Necessary",
                        description:
                          "These cookies are essential for the proper functioning of the website and cannot be disabled.",

                        //this field will generate a toggle linked to the 'necessary' category
                        linkedCategory: "necessary",
                      },
                      {
                        title: "Performance and Analytics",
                        description:
                          "These cookies collect information about how you use our website. All of the data is anonymized and cannot be used to identify you.",
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
                              domain: location.hostname,
                              desc: "Description 1",
                            },
                            {
                              name: "_gid",
                              domain: location.hostname,
                              desc: "Description 2",
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
                          'For any queries in relation to my policy on cookies and your choices, please <a href="#contact-page">contact us</a>',
                      },
                    ],
                  },
                },
              },
            },
          });
    }, []);

  return <PlaspoolLanding />;
}

// This is just some example TSX
const ToDelete = () => {
  return (
    <main className="space-y-6">
      <Prose>
        <h1>
          <Balancer>Headless WordPress built with the Next.js</Balancer>
        </h1>

        <p>
          This is <a href="https://github.com/9d8dev/next-wp">next-wp</a>,
          created as a way to build WordPress sites with Next.js at rapid speed.
          This starter is designed with{" "}
          <a href="https://ui.shadcn.com">shadcn/ui</a>,{" "}
          <a href="https://craft-ds.com">craft-ds</a>, and Tailwind CSS. Use{" "}
          <a href="https://components.work">brijr/components</a> to build your
          site with prebuilt components. The data fetching and typesafety is
          handled in <code>lib/wordpress.ts</code> and{" "}
          <code>lib/wordpress.d.ts</code>.
        </p>
      </Prose>

      <div className="flex justify-between items-center gap-4">
        {/* Vercel Clone Starter */}
        <div className="flex items-center gap-3">
          <a
            className="h-auto block"
            href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2F9d8dev%2Fnext-wp&env=WORDPRESS_URL,WORDPRESS_HOSTNAME&envDescription=Add%20WordPress%20URL%20with%20Rest%20API%20enabled%20(ie.%20https%3A%2F%2Fwp.example.com)%20abd%20the%20hostname%20for%20Image%20rendering%20in%20Next%20JS%20(ie.%20wp.example.com)&project-name=next-wp&repository-name=next-wp&demo-title=Next%20JS%20and%20WordPress%20Starter&demo-url=https%3A%2F%2Fwp.9d8.dev"
          >
            {/* eslint-disable-next-line */}
            <img
              className="not-prose my-4"
              src="https://vercel.com/button"
              alt="Deploy with Vercel"
              width={105}
              height={32.62}
            />
          </a>
          <p className="!text-sm sr-only sm:not-sr-only text-muted-foreground">
            Deploy with Vercel in seconds.
          </p>
        </div>

        <div className="flex gap-2 items-center">
          <WordPressIcon className="text-foreground" width={32} height={32} />
          <NextJsIcon className="text-foreground" width={32} height={32} />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mt-6">
        <Link
          className="border h-48 bg-accent/50 rounded-lg p-4 flex flex-col justify-between hover:scale-[1.02] transition-all"
          href="/posts"
        >
          <Pen size={32} />
          <span>
            Posts{" "}
            <span className="block text-sm text-muted-foreground">
              All posts from your WordPress
            </span>
          </span>
        </Link>
        <Link
          className="border h-48 bg-accent/50 rounded-lg p-4 flex flex-col justify-between hover:scale-[1.02] transition-all"
          href="/pages"
        >
          <File size={32} />
          <span>
            Pages{" "}
            <span className="block text-sm text-muted-foreground">
              Custom pages from your WordPress
            </span>
          </span>
        </Link>
        <Link
          className="border h-48 bg-accent/50 rounded-lg p-4 flex flex-col justify-between hover:scale-[1.02] transition-all"
          href="/posts/authors"
        >
          <User size={32} />
          <span>
            Authors{" "}
            <span className="block text-sm text-muted-foreground">
              List of the authors from your WordPress
            </span>
          </span>
        </Link>
        <Link
          className="border h-48 bg-accent/50 rounded-lg p-4 flex flex-col justify-between hover:scale-[1.02] transition-all"
          href="/posts/tags"
        >
          <Tag size={32} />
          <span>
            Tags{" "}
            <span className="block text-sm text-muted-foreground">
              Content by tags from your WordPress
            </span>
          </span>
        </Link>
        <Link
          className="border h-48 bg-accent/50 rounded-lg p-4 flex flex-col justify-between hover:scale-[1.02] transition-all"
          href="/posts/categories"
        >
          <Diamond size={32} />
          <span>
            Categories{" "}
            <span className="block text-sm text-muted-foreground">
              Categories from your WordPress
            </span>
          </span>
        </Link>
        <a
          className="border h-48 bg-accent/50 rounded-lg p-4 flex flex-col justify-between hover:scale-[1.02] transition-all"
          href="https://github.com/9d8dev/next-wp/blob/main/README.md"
        >
          <Folder size={32} />
          <span>
            Documentation{" "}
            <span className="block text-sm text-muted-foreground">
              How to use `next-wp`
            </span>
          </span>
        </a>
      </div>
    </main>
  );
};
