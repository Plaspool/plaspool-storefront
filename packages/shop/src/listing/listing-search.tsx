"use client";

import { useRef } from "react";
import { Search, X } from "lucide-react";
import { useDebouncedCallback } from "use-debounce";
import { Button, Input, cn } from "@plaspool/ui";

import { useListingUrl } from "./use-listing-url";

/**
 * In-listing search. Writes `q` 300 ms after the last keystroke, so a
 * seven-letter word is one navigation rather than seven.
 *
 * The input is uncontrolled and seeded from the URL: the browser owns the
 * caret while you type, and the URL owns the applied value. There is no React
 * state holding a second copy of `q`. The clear button follows the applied
 * value for the same reason.
 */
export function ListingSearch({ className }: { className?: string }) {
  const { filters, patch } = useListingUrl();
  const inputRef = useRef<HTMLInputElement>(null);

  const write = useDebouncedCallback((value: string) => {
    /* Replace, not push: a search term is continuous input, and one history
       entry per keystroke would make the back button useless. */
    patch({ query: value.trim() }, "replace");
  }, 300);

  return (
    <div className={cn("relative w-full", className)}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        ref={inputRef}
        type="search"
        /* Remounts when the URL's `q` changes from elsewhere — a "Clear all
           filters" button, or the back button — so the field cannot keep
           showing a term the grid is no longer filtered by. */
        key={filters.query}
        defaultValue={filters.query}
        aria-label="Search in this category"
        placeholder="Search in this category"
        onChange={(event) => write(event.target.value)}
        className={cn("pl-9", filters.query && "pr-10")}
      />
      {filters.query && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Clear search"
          onClick={() => {
            write.cancel();
            if (inputRef.current) inputRef.current.value = "";
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
