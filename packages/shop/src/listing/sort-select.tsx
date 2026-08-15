"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@plaspool/ui";

import { SHOW_FIXTURE_REVIEWS } from "../data/config";
import { SORT_KEYS, SORT_LABELS, type SortKey } from "./filter-state";
import { useListingUrl } from "./use-listing-url";

/**
 * "Best rated" sorts by fixture reviews. With `SHOW_FIXTURE_REVIEWS` off no
 * rating is rendered anywhere, so the option would reorder the grid by a
 * number nobody can see — a dead control. `SORT_KEYS` keeps `rating-desc`, so
 * an old URL carrying it still parses and still sorts; it is only unoffered.
 */
const OFFERED_SORT_KEYS = SORT_KEYS.filter(
  (key) => key !== "rating-desc" || SHOW_FIXTURE_REVIEWS,
);

/** Writes `sort`. Its value is read straight off the URL, so the back button
 *  moves the trigger's label with it. */
export function SortSelect({ className }: { className?: string }) {
  const { filters, patch } = useListingUrl();

  return (
    <Select value={filters.sort} onValueChange={(value) => patch({ sort: value as SortKey })}>
      <SelectTrigger aria-label="Sort products" className={cn("w-full sm:w-56", className)}>
        <SelectValue placeholder="Sort" />
      </SelectTrigger>
      <SelectContent>
        {OFFERED_SORT_KEYS.map((key) => (
          <SelectItem key={key} value={key}>
            {SORT_LABELS[key]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
