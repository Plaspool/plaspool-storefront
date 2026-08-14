import type { LucideIcon } from "lucide-react";
import { Factory, Package, Ruler, Truck } from "lucide-react";

/**
 * Four claims, from the competitive analysis's synthesis of what a Nigerian
 * buyer actually weighs: where it was made, whether it is measured, when it
 * arrives, and what a box costs.
 *
 * No card chrome — an icon row and hairline rules, per design system rule 4.
 * The figures are mono, the sentences are sans.
 */

interface Claim {
  icon: LucideIcon;
  title: string;
  /** The measured part. Mono, because it is a measurement. */
  figure: string;
  body: string;
}

const CLAIMS: Claim[] = [
  {
    icon: Factory,
    title: "Made in Nigeria",
    figure: "Extruded in Lagos",
    body: "Our own line, not repackaged imports — so a reorder matches the batch you already printed.",
  },
  {
    icon: Ruler,
    title: "Tolerance tested",
    figure: "±0.02 mm",
    body: "Diameter is measured on every batch before it leaves the floor, and the figure is on the spool.",
  },
  {
    icon: Truck,
    title: "Nationwide delivery",
    figure: "Next day in Lagos",
    body: "Two to four working days everywhere else in Nigeria, tracked from the moment it ships.",
  },
  {
    icon: Package,
    title: "Bulk pricing",
    figure: "Up to 22% off",
    body: "Quantity discounts start at four spools and apply automatically at the basket, with no quote to wait for.",
  },
];

export function WhyShop() {
  return (
    <section aria-labelledby="why-shop" className="border-b border-brand-line">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-14 lg:px-8">
        <h2
          id="why-shop"
          className="font-sans text-xl font-semibold text-foreground sm:text-2xl"
        >
          Why shop PlaSpool
        </h2>

        <ul className="mt-6 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {CLAIMS.map((claim) => {
            const Icon = claim.icon;
            return (
              <li
                key={claim.title}
                className="border-t border-brand-line pt-5 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0"
              >
                <Icon aria-hidden="true" className="h-6 w-6 text-brand" />
                <h3 className="mt-3 font-sans text-base font-semibold text-foreground">
                  {claim.title}
                </h3>
                <p className="mt-1 font-mono text-sm tabular-nums text-brand">{claim.figure}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{claim.body}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
