"use client"

import * as React from "react"
import Link from "next/link"
import { buttonVariants, cn } from "@plaspool/ui"
import { BrandLogo } from "@plaspool/brand"
import { AccountMenu } from "@plaspool/shop"

/**
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
  "text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-blue-900 focus-visible:ring-offset-white"

export default function Nav() {
    const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

    return (
         <nav className="bg-white border-b font-mono border-slate-200 sticky top-0 z-50">
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
                      <Link href="/#about" className="text-slate-600 hover:text-slate-900 font-medium tracking-wide">
                        About
                      </Link>
                      <Link href="/shop" className="whitespace-nowrap text-slate-600 hover:text-slate-900 font-medium tracking-wide">
                        Products
                      </Link>
                      {/* `pwa-hide` — the installed app is the shop, not the
                          website. See `.pwa-hide` in `globals.css`. */}
                      <Link href="/posts" className="pwa-hide whitespace-nowrap text-slate-600 hover:text-slate-900 font-medium tracking-wide">
                        Blog
                      </Link>
                      <Link href="/contact" className="whitespace-nowrap text-slate-600 hover:text-slate-900 font-medium tracking-wide">
                        Contact Us
                      </Link>
                      {/* buttonVariants on the Link rather than a <Button> inside an <a>:
                          a <button> nested in an anchor is invalid HTML and breaks
                          keyboard activation. */}
                      <Link
                        href="/shop"
                        className={cn(
                          buttonVariants(),
                          "whitespace-nowrap bg-slate-800 text-white hover:bg-slate-700"
                        )}
                      >
                        Shop Filaments
                      </Link>
                      {/* <Button className="bg-blue-900 hover:bg-blue-800">Contact Us</Button> */}
                    </div>

                    <AccountMenu className={ACCOUNT_IN_MARKETING_NAV} />

                    {/* Mobile menu button */}
                    <div className="md:hidden">
                      <button
                        type="button"
                        className="inline-flex items-center justify-center p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-900"
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
                <div className={cn("md:hidden bg-white border-t border-slate-200", mobileMenuOpen ? "block" : "hidden")} id="mobile-menu">
                  <div className="px-2 pt-2 pb-3 space-y-1 font-mono">
                    <Link onClick={() => setMobileMenuOpen(false)}
                      href="/#about"
                      className="block px-3 py-2 rounded-md text-base font-medium text-slate-900 hover:bg-slate-100"
                    >
                      About
                    </Link>
                    <Link onClick={() => setMobileMenuOpen(false)}
                      href="/shop"
                      className="block px-3 py-2 rounded-md text-base font-medium text-slate-900 hover:bg-slate-100"
                    >
                      Products
                    </Link>
                    <Link onClick={() => setMobileMenuOpen(false)}
                      href="/posts"
                      className="pwa-hide block px-3 py-2 rounded-md text-base font-medium text-slate-900 hover:bg-slate-100"
                    >
                      Blog
                    </Link>
                       <Link onClick={() => setMobileMenuOpen(false)}
                      href="/contact"
                      className="block px-3 py-2 rounded-md text-base font-medium text-slate-900 hover:bg-slate-100"
                    >
                      Contact us
                    </Link>
                    <Link onClick={() => setMobileMenuOpen(false)}
                      href="/shop"
                      className="block px-3 py-2 rounded-md text-base font-medium text-slate-900 hover:bg-slate-100"
                    >
                      Shop Filaments
                    </Link>
                  </div>
                </div>
              </nav>
    )}
