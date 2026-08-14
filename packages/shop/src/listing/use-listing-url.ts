"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { parseFilters, serialiseFilters, type Filters } from "./filter-state";

/**
 * The one way any listing control changes state.
 *
 * Every control reads its value from `useSearchParams()` and writes through
 * `setFilters`, which replaces the URL. There is deliberately no `useState`
 * mirror anywhere in `listing/` — a mirror is how a checkbox ends up ticked
 * while the grid behind it says otherwise.
 *
 * History mode is per-control, and deliberately not uniform. A discrete
 * toggle — a checkbox, a swatch, the sort select — pushes, because the spec's
 * verification requires that pressing back takes a filter off; with `replace`
 * the only entry to go back to is whatever page you arrived from, so back
 * leaves the listing entirely (verified in the browser before this was
 * changed). Continuous input — the debounced search box and the two price
 * fields — replaces, so typing a seven-letter word does not bury the page
 * under seven history entries.
 *
 * `{ scroll: false }` throughout, so the grid re-renders under a stationary
 * viewport rather than throwing you back to the breadcrumb.
 */

type HistoryMode = "push" | "replace";
export function useListingUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = parseFilters(Object.fromEntries(searchParams.entries()));

  const setFilters = useCallback(
    (next: Filters, mode: HistoryMode = "push") => {
      const params = serialiseFilters(next).toString();
      const href = params ? `${pathname}?${params}` : pathname;
      if (mode === "replace") router.replace(href, { scroll: false });
      else router.push(href, { scroll: false });
    },
    [pathname, router],
  );

  const patch = useCallback(
    (part: Partial<Filters>, mode: HistoryMode = "push") => {
      const current = parseFilters(Object.fromEntries(searchParams.entries()));
      setFilters({ ...current, ...part }, mode);
    },
    [searchParams, setFilters],
  );

  return { filters, pathname, setFilters, patch };
}
