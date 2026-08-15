"use client";

import { Search } from "lucide-react";

import { Input } from "@plaspool/ui";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useDebouncedCallback } from "use-debounce";

export function SearchInput({ defaultValue }: { defaultValue?: string }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();

  const handleSearch = useDebouncedCallback((term: string) => {
    const params = new URLSearchParams(searchParams);
    if (term) {
      params.set("search", term);
    } else {
      params.delete("search");
    }
    replace(`${pathname}?${params.toString()}`);
  }, 300);

  return (
    // The plain `<Input>` this replaced hardcoded a dark slate fill with
    // white text, matching nothing else on the page. A search field on a
    // light page reads as an ordinary field: white background, a visible
    // border, a leading icon rather than a colour block.
    <div className="relative w-full max-w-sm">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        name="search"
        className="pl-9"
        placeholder="Search posts..."
        defaultValue={defaultValue}
        onChange={(e) => handleSearch(e.target.value)}
        aria-label="Search posts"
      />
    </div>
  );
}
