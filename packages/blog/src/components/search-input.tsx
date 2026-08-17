"use client";

import { Search } from "lucide-react";

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
    // A plain input carrying the ported field treatment (`.searchbox` in
    // blog.css) rather than the shadcn `<Input>`: the blog's controls sit on
    // the design system's own grid — one height for every control on the
    // row, derived from `--ctl-*`.
    <div className="relative w-full max-w-sm">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
        style={{ color: "var(--ink-4)" }}
      />
      <input
        type="search"
        name="search"
        className="searchbox"
        placeholder="Search posts..."
        defaultValue={defaultValue}
        onChange={(e) => handleSearch(e.target.value)}
        aria-label="Search posts"
      />
    </div>
  );
}
