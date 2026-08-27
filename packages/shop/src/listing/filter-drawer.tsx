"use client";

import { SlidersHorizontal } from "lucide-react";
import {
  Badge,
  Button,
  ScrollArea,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  cn,
} from "@plaspool/ui";

import { activeFilterCount, type Facets } from "./filter-state";
import { FilterRail } from "./filter-rail";
import { useListingUrl } from "./use-listing-url";

/**
 * Below `md`, the rail becomes a left sheet. A 16 rem rail beside a two-column
 * grid is unusable at 375 px, and mobile is the majority case in this market.
 *
 * The sheet's body is the same `FilterRail` the desktop rail renders — the
 * whole point, so the two can never drift apart. Filters apply as they are
 * ticked, because the URL is the state; the sheet has no "Apply" button to
 * forget to press.
 */
export function FilterDrawer({ facets, className }: { facets: Facets; className?: string }) {
  const { filters } = useListingUrl();
  const active = activeFilterCount(filters);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" className={cn("gap-2", className)}>
          <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
          Filters
          {active > 0 && (
            <Badge variant="secondary" className="font-mono">
              {active}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-[85vw] flex-col p-0 sm:max-w-sm">
        <SheetHeader className="border-b border-brand-line px-5 py-4 text-left">
          <SheetTitle className="text-base">Filters</SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1">
          <FilterRail
            facets={facets}
            idPrefix="drawer"
            showHeading={false}
            className="px-5 py-5"
          />
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
