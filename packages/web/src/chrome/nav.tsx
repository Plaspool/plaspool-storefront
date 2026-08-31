"use client"

import * as React from "react"
import Link from "next/link"
import { buttonVariants, cn, controlSurface } from "@plaspool/ui"
import { BrandLogo } from "@plaspool/brand"
import { AccountMenu } from "@plaspool/shop"

/**
 * ═══ "THE SHOP" MEANS `/store` HERE, AND IS NOT PREFETCHED ═══
 * Every link in this nav that means "the shop" pointed at `/shop`, which is
 * not a page: it is the splash gateway, and its whole job is to play the mark
 * for 2.8s and then `router.replace()` to `/store`. `splash-gateway.tsx` says
 * so in its own header — "every internal link that means 'the shop' points at
 * `/store`" — and the shop's own chrome obeys that. This nav did not.
 *
 * The cost showed up in the Worker logs as bursts of `GET /shop?_rsc=…`.
 * Next prefetches a `<Link>` when it enters the viewport, so three of these
 * (two here, one in the footer) fired on every home-page visit, each pulling
 * 14kB of RSC payload for a page the shopper leaves seconds after arriving —
 * and the gateway then prefetches `/store` itself on top of that. On a
 * `*.workers.dev` host none of it is absorbed by Cloudflare's cache: that
 * hostname bypasses the CDN, so the `s-maxage=31536000` on the response is
 * inert and every prefetch is a real Worker invocation.
 *
 * `prefetch={false}` AS WELL AS THE RETARGET, because the two alone pull in
 * opposite directions: `/store`'s payload is 53kB against `/shop`'s 14kB, so
 * retargeting on its own would have made every home-page visit heavier, not
 * lighter — paid by the majority who never click through. False means the
 * click is a fetch rather than a paint, which is still faster than the 2.8s
 * animation it replaces.
 *
 * `/shop` IS NOT DEAD. It is the installed app's `start_url` — see
 * `app/manifest.ts`, which is emphatic about why. The splash is the PWA's
 * opening animation; it was never meant to sit in the browser's funnel.
 *
 * ═══ THE ACCOUNT CONTROL IS `AccountMenu`, NOT A "SIGN IN" LINK ═══
 * The marketing nav had no way into `/sign-in` at all, so the home page — the
 * page most visitors land on — was the one place a shopper could not sign in.
 *
 * WHAT IT IS NOT IS A BARE `<Link href="/sign-in">Sign in</Link>`. The session
 * lives in a cookie on the commerce API's registrable domain, so this origin
 * cannot read it while rendering: a hardcoded "Sign in" would be served to
 * everybody, including the shopper who signed in a minute ago, and a failed
 * probe would leave it there permanently. That exact bug is written up at
 * length in `account-menu.tsx`'s own header — it was fixed once already in the
 * shop nav, and putting a plain link here would reintroduce it on the busiest
 * page in the store. `AccountMenu` keeps "not yet known" separate from
 * "definitely nobody", so it shows a guest "Sign in", a signed-in shopper
 * their own name and menu, and neither claim before it knows.
 *
 * AT EVERY WIDTH, for the reason `ShopNav` gives beside its own copy: identity
 * belongs in the header on a phone exactly as it does on a desktop, and
 * hiding it behind the hamburger means a shopper cannot tell whether they are
 * signed in without opening a menu. It costs one 40px control until `xl`.
 * The mobile panel below therefore carries no account row of its own — and
 * could not reuse `MobileAccountLinks` if it wanted to, since that component
 * is built from `SheetClose` and this menu is a plain toggled div, not a
 * Radix sheet.
 *
 * The slate classes are the override this nav needs: `AccountMenu` is styled
 * in the shop's own tokens, and `cn` is tailwind-merge, so what is passed in
 * wins over what the component sets.
 */
const ACCOUNT_IN_MARKETING_NAV =
  "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-brand focus-visible:ring-offset-white"

export default function Nav() {
    const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

    return (
         <nav className="bg-white border-b font-mono border-brand-line sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="flex justify-between items-center h-16">
                    <Link href="/" className="flex items-center" aria-label="PlaSpool home">
                      <BrandLogo variant="lockup" tone="light" className="h-8" />
                    </Link>
                    {/* The right-hand cluster: the desktop links, the account
                        control at every width, and the hamburger below `md`.
                        DOM order puts `AccountMenu` between them so it is the
                        rightmost control on desktop, where the hamburger is
                        hidden, and sits to the left of the hamburger on a
                        phone, where the links are. */}
                    <div className="flex items-center gap-1 md:gap-4">
                    <div className="hidden md:flex items-center space-x-8">
                      <Link href="/#about" className="text-muted-foreground hover:text-foreground font-medium tracking-wide">
                        About
                      </Link>
                      <Link href="/store" prefetch={false} className="whitespace-nowrap text-muted-foreground hover:text-foreground font-medium tracking-wide">
                        Products
                      </Link>
                      {/* `pwa-hide` — the installed app is the shop, not the
                          website. See `.pwa-hide` in `globals.css`. */}
                      <Link href="/posts" className="pwa-hide whitespace-nowrap text-muted-foreground hover:text-foreground font-medium tracking-wide">
                        Blog
                      </Link>
                      <Link href="/contact" className="whitespace-nowrap text-muted-foreground hover:text-foreground font-medium tracking-wide">
                        Contact Us
                      </Link>
                      {/* buttonVariants on the Link rather than a <Button> inside an <a>:
                          a <button> nested in an anchor is invalid HTML and breaks
                          keyboard activation. */}
                      <Link
                        href="/store"
                        prefetch={false}
                        className={cn(
                          /* `variant: "surfaced"` keeps the geometry and drops
                             the stock fill, ring and disabled fade, all four of
                             which fight the bevel. */
                          buttonVariants({ variant: "surfaced" }),
                          "whitespace-nowrap",
                          controlSurface("primary")
                        )}
                      >
                        Shop Filaments
                      </Link>
                      {/* <Button className="bg-brand hover:bg-brand">Contact Us</Button> */}
                    </div>

                    <AccountMenu className={ACCOUNT_IN_MARKETING_NAV} />

                    {/* Mobile menu button */}
                    <div className="md:hidden">
                      <button
                        type="button"
                        className="inline-flex items-center justify-center p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand"
                        aria-controls="mobile-menu"
                        aria-expanded={mobileMenuOpen}
                        onClick={() => setMobileMenuOpen((open) => !open)}
                      >
                        <span className="sr-only">Open main menu</span>
                        {/* Hamburger icon */}
                        <svg
                          className="block h-6 w-6"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                      </button>
                    </div>
                    </div>
                  </div>
                </div>

                {/* Mobile menu, show/hide based on menu state */}
                <div className={cn("md:hidden bg-white border-t border-brand-line", mobileMenuOpen ? "block" : "hidden")} id="mobile-menu">
                  <div className="px-2 pt-2 pb-3 space-y-1 font-mono">
                    <Link onClick={() => setMobileMenuOpen(false)}
                      href="/#about"
                      className="block px-3 py-2 rounded-md text-base font-medium text-foreground hover:bg-muted"
                    >
                      About
                    </Link>
                    <Link onClick={() => setMobileMenuOpen(false)}
                      href="/store"
                      prefetch={false}
                      className="block px-3 py-2 rounded-md text-base font-medium text-foreground hover:bg-muted"
                    >
                      Products
                    </Link>
                    <Link onClick={() => setMobileMenuOpen(false)}
                      href="/posts"
                      className="pwa-hide block px-3 py-2 rounded-md text-base font-medium text-foreground hover:bg-muted"
                    >
                      Blog
                    </Link>
                       <Link onClick={() => setMobileMenuOpen(false)}
                      href="/contact"
                      className="block px-3 py-2 rounded-md text-base font-medium text-foreground hover:bg-muted"
                    >
                      Contact us
                    </Link>
                    <Link onClick={() => setMobileMenuOpen(false)}
                      href="/store"
                      prefetch={false}
                      className="block px-3 py-2 rounded-md text-base font-medium text-foreground hover:bg-muted"
                    >
                      Shop Filaments
                    </Link>
                  </div>
                </div>
              </nav>
    )}
