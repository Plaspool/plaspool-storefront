"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@plaspool/ui";

import { SORT_KEYS, SORT_LABELS, type SortKey } from "./filter-state";
import { useListingUrl } from "./use-listing-url";

/**
 * EVERY SORT IS OFFERED AGAIN, INCLUDING "Best rated".
 *
 * It used to be filtered out, because no rating was rendered anywhere and the
 * option would have reordered the grid by a number nobody could see — a dead
 * control. The bulk aggregate endpoint (`Plaspool/plaspool-admin#12`) is what
 * changed that: cards carry real customer ratings now, so the sort reorders by
 * something visible.
 */
const OFFERED_SORT_KEYS = SORT_KEYS;

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
