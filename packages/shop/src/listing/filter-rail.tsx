"use client";

import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { Button, Input, Label, Separator, cn } from "@plaspool/ui";

import { formatNaira } from "../data/money";
import {
  activeFilterCount,
  formatDiameter,
  formatWeight,
  type Facets,
} from "./filter-state";
import { useDebouncedField } from "./use-debounced-field";
import { useListingUrl } from "./use-listing-url";

/**
 * The six filter groups, in the spec's order: Material, Colour, Diameter,
 * Weight, Price, Availability.
 *
 * One component, rendered twice — as the `hidden md:block` rail and inside the
 * `md:hidden` drawer. A filter added here cannot appear in one and not the
 * other. Counts come from the category's own facets, so no checkbox on offer
 * can empty the grid on its own.
 */

const CHECK_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`filter-${title.toLowerCase()}`}>
      <h3
        id={`filter-${title.toLowerCase()}`}
        className="font-sans text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function CheckRow({
  id,
  label,
  count,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  count?: number;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="flex min-w-0 items-center gap-2.5">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className={cn(
            "h-4 w-4 shrink-0 rounded-sm border border-brand-line accent-brand",
            CHECK_FOCUS,
          )}
        />
        <Label htmlFor={id} className="min-w-0 truncate text-sm font-normal text-foreground">
          {label}
        </Label>
      </div>
      {count !== undefined && (
        <span className="shrink-0 font-mono text-xs text-muted-foreground">{count}</span>
      )}
    </div>
  );
}

export interface FilterRailProps {
  facets: Facets;
  /** Set by the drawer, so its own copy of the controls has unique ids. */
  idPrefix?: string;
  /** The drawer's `SheetTitle` already says "Filters"; suppressing the rail's
   *  own heading there avoids announcing it twice. */
  showHeading?: boolean;
  className?: string;
}

export function FilterRail({
  facets,
  idPrefix = "rail",
  showHeading = true,
  className,
}: FilterRailProps) {
  const { filters, patch, setFilters } = useListingUrl();
  const active = activeFilterCount(filters);

  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

  /* Same local-buffer treatment as the search box, for the same reason: a field
     keyed on the value its own debounced write produces remounts itself and
     loses the caret mid-typing. `commit` returns the string the URL will report
     back, so the hook can tell its own echo from a back button or "Clear all". */
  const commitPrice = (key: "minPrice" | "maxPrice") => (raw: string) => {
    const parsed = Number.parseInt(raw, 10);
    const value = Number.isFinite(parsed) ? parsed : null;
    /* Replace, as with the search box: a number being typed digit by digit is
       continuous input, not a discrete choice worth a history entry. */
    patch(key === "minPrice" ? { minPrice: value } : { maxPrice: value }, "replace");
    return value === null ? "" : String(value);
  };

  const minField = useDebouncedField({
    external: filters.minPrice === null ? "" : String(filters.minPrice),
    delay: 400,
    commit: commitPrice("minPrice"),
  });
  const maxField = useDebouncedField({
    external: filters.maxPrice === null ? "" : String(filters.maxPrice),
    delay: 400,
    commit: commitPrice("maxPrice"),
  });

  const [minBound, maxBound] = facets.priceBounds;

  return (
    <div className={cn("space-y-6", className)}>
      {(showHeading || active > 0) && (
        <>
      <div
        className={cn(
          "flex items-center gap-3",
          showHeading ? "justify-between" : "justify-end",
        )}
      >
        {showHeading && (
          <h2 className="font-sans text-sm font-semibold text-foreground">Filters</h2>
        )}
        {active > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto px-2 py-1 text-xs"
            onClick={() =>
              setFilters({
                ...filters,
                materials: [],
                colours: [],
                diameters: [],
                weights: [],
                minPrice: null,
                maxPrice: null,
                inStockOnly: false,
              })
            }
          >
            Clear all
          </Button>
        )}
      </div>

      <Separator className="bg-brand-line" />
        </>
      )}

      <Group title="Material">
        {facets.materials.map((facet) => (
          <CheckRow
            key={facet.value}
            id={`${idPrefix}-material-${facet.value}`}
            label={facet.value}
            count={facet.count}
            checked={filters.materials.includes(facet.value)}
            onChange={() => patch({ materials: toggle(filters.materials, facet.value) })}
          />
        ))}
      </Group>

      <Group title="Colour">
        <ul className="flex flex-wrap gap-2">
          {facets.colours.map((colour) => {
            const selected = filters.colours.includes(colour.id);
            return (
              <li key={colour.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => patch({ colours: toggle(filters.colours, colour.id) })}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border transition-colors motion-reduce:transition-none",
                    selected ? "border-brand ring-2 ring-brand ring-offset-2" : "border-brand-line",
                    CHECK_FOCUS,
                  )}
                  style={{ backgroundColor: colour.hex }}
                >
                  {selected && (
                    <Check
                      aria-hidden="true"
                      className="h-4 w-4 text-white mix-blend-difference"
                    />
                  )}
                  <span className="sr-only">
                    {colour.name} ({colour.count})
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Group>

      <Group title="Diameter">
        {facets.diameters.map((facet) => (
          <CheckRow
            key={facet.value}
            id={`${idPrefix}-diameter-${facet.value}`}
            label={formatDiameter(facet.value)}
            count={facet.count}
            checked={filters.diameters.includes(facet.value)}
            onChange={() => patch({ diameters: toggle(filters.diameters, facet.value) })}
          />
        ))}
      </Group>

      <Group title="Weight">
        {facets.weights.map((facet) => (
          <CheckRow
            key={facet.value}
            id={`${idPrefix}-weight-${facet.value}`}
            label={formatWeight(facet.value)}
            count={facet.count}
            checked={filters.weights.includes(facet.value)}
            onChange={() => patch({ weights: toggle(filters.weights, facet.value) })}
          />
        ))}
      </Group>

      <Group title="Price">
        <div className="flex items-end gap-3">
          <div className="min-w-0 flex-1">
            <Label
              htmlFor={`${idPrefix}-min`}
              className="text-xs font-normal text-muted-foreground"
            >
              Min
            </Label>
            <Input
              id={`${idPrefix}-min`}
              type="number"
              inputMode="numeric"
              min={0}
              value={minField.value}
              placeholder={String(minBound)}
              onChange={(event) => minField.onChange(event.target.value)}
              className="mt-1 font-mono"
            />
          </div>
          <div className="min-w-0 flex-1">
            <Label
              htmlFor={`${idPrefix}-max`}
              className="text-xs font-normal text-muted-foreground"
            >
              Max
            </Label>
            <Input
              id={`${idPrefix}-max`}
              type="number"
              inputMode="numeric"
              min={0}
              value={maxField.value}
              placeholder={String(maxBound)}
              onChange={(event) => maxField.onChange(event.target.value)}
              className="mt-1 font-mono"
            />
          </div>
        </div>
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          {formatNaira(minBound)} – {formatNaira(maxBound)}
        </p>
      </Group>

      <Group title="Availability">
        <CheckRow
          id={`${idPrefix}-stock`}
          label="In stock only"
          checked={filters.inStockOnly}
          onChange={(next) => patch({ inStockOnly: next })}
        />
      </Group>
    </div>
  );
}
