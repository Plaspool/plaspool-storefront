import type { ReactNode } from "react";
import Link from "next/link";
import { Separator, cn } from "@plaspool/ui";
import { BrandLogo } from "@plaspool/brand";

import { listCategories } from "../data/catalog";
import { PAYMENT_METHODS } from "../data/config";

/**
 * The shop's footer. Dark chrome — the one place brand navy inverts to
 * `slate-900` — with the six categories, the handful of policy and company
 * links the store has today, and the payment methods as small mono chips.
 *
 * "Delivery" and "Returns" both point at `/shipping`, the one policy page
 * that covers both topics; there is no separate route for either yet.
 * "About" points at the marketing site's `/#about`, the same anchor the
 * marketing nav itself uses. Every link that means "the shop" points at
 * `/store`, never `/shop`, which is the noindex splash gateway.
 */

const FOOTER_LINK_FOCUS =
  "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900";

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="font-sans text-xs font-semibold uppercase tracking-wide text-white/50">
        {title}
      </h2>
      <ul className="mt-3 space-y-2.5">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className={cn(
          "text-sm text-white/70 underline-offset-4 transition-colors hover:text-white hover:underline motion-reduce:transition-none",
          FOOTER_LINK_FOCUS,
        )}
      >
        {children}
      </Link>
    </li>
  );
}

export function ShopFooter() {
  const categories = listCategories();
  const year = new Date().getFullYear();

  return (
    <footer className="bg-slate-900 text-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div>
            <Link
              href="/store"
              aria-label="PlaSpool store home"
              className={cn("inline-block", FOOTER_LINK_FOCUS)}
            >
              <BrandLogo variant="lockup" tone="dark" className="h-7 w-auto" />
            </Link>
            <p className="mt-4 max-w-xs text-sm text-white/60">
              Filament for 3D printing, made and shipped from Lagos.
            </p>
          </div>

          <FooterColumn title="Shop">
            {categories.map((category) => (
              <FooterLink key={category.slug} href={`/store/${category.slug}`}>
                {category.name}
              </FooterLink>
            ))}
          </FooterColumn>

          <FooterColumn title="Help">
            <FooterLink href="/shipping">Delivery</FooterLink>
            <FooterLink href="/shipping">Returns</FooterLink>
            <FooterLink href="/contact">Contact</FooterLink>
          </FooterColumn>

          <FooterColumn title="Company">
            <FooterLink href="/#about">About</FooterLink>
            <FooterLink href="/posts">Blog</FooterLink>
          </FooterColumn>
        </div>

        <Separator className="my-10 bg-white/10" />

        <div>
          <h2 className="font-sans text-xs font-semibold uppercase tracking-wide text-white/50">
            Payment methods
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {PAYMENT_METHODS.map((method) => (
              <li
                key={method}
                className="rounded border border-white/15 px-2.5 py-1 font-mono text-xs text-white/80"
              >
                {method}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} PlaSpool. All rights reserved.</p>
          <p>Made in Nigeria.</p>
        </div>
      </div>
    </footer>
  );
}
