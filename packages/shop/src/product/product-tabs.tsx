"use client";

import * as React from "react";
import { cn } from "@plaspool/ui";

import type { Product } from "../data/types";
import type { PublicReview, ReviewAggregate } from "../data/reviews";
import { OverviewTab } from "./overview-tab";
import { DescriptionTab } from "./description-tab";
import { ParametersTab } from "./parameters-tab";
import { ReviewsTab } from "./reviews-tab";

/**
 * The four tabs below the buy box, and the sticky sub-nav that makes a long
 * page navigable instead of endless — the second of the two patterns worth
 * taking from Bambu, the first being the sticky buy bar.
 *
 * Quiet on purpose. Bambu's sub-nav is a dark band; here it is the background
 * with a hairline rule, because the buy bar is where this page spends its one
 * unit of boldness.
 *
 * STICKY OFFSET. The shop's own nav is sticky and this bar has to sit under
 * it, but its height belongs to the layout rather than to this component. So
 * the offset is read from `--shop-subnav-offset` and defaults to zero: the
 * layout that owns the nav sets the variable, and nothing here has to guess a
 * number that would silently go stale the moment the nav changed.
 *
 * Automatic activation — arrowing to a tab selects it. Correct here because
 * every panel is already rendered client-side and switching costs nothing, so
 * the extra Enter press of manual activation would buy nothing.
 */

interface TabDef {
  id: string;
  label: string;
  /** A mono count beside the label, where there is one worth showing. */
  count?: number;
  panel: React.ReactNode;
}

export interface ProductTabsProps {
  product: Product;
  /** Review data, fetched on the server by the page above. */
  reviewAggregate: ReviewAggregate;
  initialReviews: PublicReview[];
  initialReviewCursor: string | null;
  className?: string;
}

export function ProductTabs({
  product,
  reviewAggregate,
  initialReviews,
  initialReviewCursor,
  className,
}: ProductTabsProps) {
  /* The approved count from the API — the same number the panel shows, so the
     tab label and its contents cannot disagree. */
  const reviewCount = reviewAggregate.count;

  const tabs: TabDef[] = [
    {
      id: "overview",
      label: "Overview",
      panel: <OverviewTab claims={product.overviewClaims} summary={product.summary} />,
    },
    {
      id: "description",
      label: "Description",
      panel: <DescriptionTab blocks={product.description} />,
    },
    /*
     * ONLY WHEN THERE ARE PARAMETERS. `product.parameters` is null whenever the
     * catalogue has no printing figures for a product — there is no column
     * behind any of the nine — and a tab that opens onto an empty table reads as
     * a broken page rather than as an absent one. Nine plausible-looking
     * temperatures on a page somebody buys from would be worse than either.
     */
    ...(product.parameters
      ? [
          {
            id: "parameters",
            label: "Printing parameters",
            panel: <ParametersTab parameters={product.parameters} />,
          },
        ]
      : []),
    {
      id: "reviews",
      label: "Reviews",
      /* Zero is worth showing: it is the honest state, and hiding it would
         make an empty tab look like an unloaded one. */
      count: reviewCount,
      panel: (
        <ReviewsTab
          productSlug={product.slug}
          productName={product.name}
          aggregate={reviewAggregate}
          initialReviews={initialReviews}
          initialCursor={initialReviewCursor}
        />
      ),
    },
  ];

  const [active, setActive] = React.useState(0);
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const move = (from: number, delta: number) => {
    const next = (from + delta + tabs.length) % tabs.length;
    setActive(next);
    refs.current[next]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        move(index, 1);
        break;
      case "ArrowLeft":
        event.preventDefault();
        move(index, -1);
        break;
      case "Home":
        event.preventDefault();
        move(-1, 1);
        break;
      case "End":
        event.preventDefault();
        move(0, -1);
        break;
      default:
        break;
    }
  };

  return (
    <div className={cn("w-full min-w-0", className)}>
      <div
        className="sticky z-30 border-b border-brand-line bg-background"
        style={{ top: "var(--shop-subnav-offset, 0px)" }}
      >
        {/* The rail scrolls inside itself at 375 px rather than widening the
            page — "Printing parameters" alone is most of a phone's width. */}
        <div
          role="tablist"
          aria-label="Product information"
          className="-mb-px flex gap-1 overflow-x-auto"
        >
          {tabs.map((tab, index) => {
            const selected = index === active;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={selected}
                aria-controls={`panel-${tab.id}`}
                tabIndex={selected ? 0 : -1}
                ref={(node) => {
                  refs.current[index] = node;
                }}
                onClick={() => setActive(index)}
                onKeyDown={(event) => onKeyDown(event, index)}
                className={cn(
                  "shrink-0 whitespace-nowrap border-b-2 px-3 py-3 font-sans text-sm transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  selected
                    ? "border-brand font-semibold text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className="ml-1.5 font-mono tabular-nums text-muted-foreground">
                    ({tab.count})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {tabs.map((tab, index) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`panel-${tab.id}`}
          aria-labelledby={`tab-${tab.id}`}
          /* Focusable so a keyboard user can reach panel content that holds no
             focusable element of its own. */
          tabIndex={0}
          hidden={index !== active}
          className="py-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          {tab.panel}
        </div>
      ))}
    </div>
  );
}
