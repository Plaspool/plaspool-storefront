"use client";

import { Search, X } from "lucide-react";
import { Button, Input, cn } from "@plaspool/ui";

import { useDebouncedField } from "./use-debounced-field";
import { useListingUrl } from "./use-listing-url";

/**
 * In-listing search. Writes `q` 300 ms after the last keystroke, so a
 * seven-letter word is one navigation rather than seven.
 *
 * The URL still owns the applied value — it is what the grid filters on. The
 * input keeps a local buffer purely so the caret survives its own debounced
 * write; see `useDebouncedField` for how an external change (back button,
 * "Clear all") is still told apart from the component's own echo.
 */
export function ListingSearch({ className }: { className?: string }) {
  const { filters, patch } = useListingUrl();

  const field = useDebouncedField({
    external: filters.query,
    delay: 300,
    commit: (raw) => {
      const next = raw.trim();
      /* Replace, not push: a search term is continuous input, and one history
         entry per keystroke would make the back button useless. */
      patch({ query: next }, "replace");
      return next;
    },
  });

  return (
    <div className={cn("relative w-full", className)}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        value={field.value}
        aria-label="Search in this category"
        placeholder="Search in this category"
        onChange={(event) => field.onChange(event.target.value)}
        className={cn("pl-9", field.value && "pr-10")}
      />
      {field.value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Clear search"
          onClick={() => {
            field.reset();
            patch({ query: "" });
          }}
          className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
