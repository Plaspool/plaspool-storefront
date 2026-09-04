import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EVERY LINK IN THIS PACKAGE GOES THROUGH `components/link.tsx`, AND A RAW
 * `next/link` IMPORT SILENTLY BREAKS TWO THINGS AT ONCE.
 *
 * The wrapper does two jobs that have nothing to do with each other, which is
 * exactly why this is worth a failing test rather than a code review:
 *
 *   1. `prefetch={false}`. On a `*.workers.dev` hostname nothing absorbs the
 *      RSC prefetches, so a 38-card listing spends ~78 KV reads and 39 Worker
 *      requests per view — both free-tier budgets gone at ~1,300 views. The
 *      file's own header sets this out at length.
 *
 *   2. The currency segment. A shopper browsing `/usd/store` who follows a raw
 *      `<Link href="/store/products/x">` is dropped back into naira mid-
 *      journey, with no error and no indication that the price they are now
 *      looking at is in a different currency from the one they chose.
 *
 * NEITHER FAILURE IS VISIBLE IN REVIEW. One is a bill, the other is a price a
 * shopper reads wrong. A new component importing `next/link` directly — which
 * is the obvious thing to type, and what every example on the internet shows —
 * gets both. So the import is asserted against here.
 *
 * THE ONE LEGITIMATE IMPORT is the wrapper itself, which necessarily imports
 * what it wraps.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const SRC = join(__dirname, "..");
const ALLOWED = join(SRC, "components", "link.tsx");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : [];
  });
}

describe("the shop's Link wrapper", () => {
  it("is the only thing in this package that imports next/link", () => {
    const offenders = sourceFiles(SRC).filter((file) => {
      if (file === ALLOWED) return false;
      return /from\s+["']next\/link["']/.test(readFileSync(file, "utf8"));
    });

    expect(
      offenders.map((f) => f.slice(SRC.length + 1).replace(/\\/g, "/")),
    ).toEqual([]);
  });

  it("still finds the files it is supposed to be scanning", () => {
    /* A guard on the guard: a broken path or a changed extension filter would
       make the assertion above pass by examining nothing, which is the way a
       test like this rots without anybody noticing. */
    const files = sourceFiles(SRC);
    expect(files.length).toBeGreaterThan(50);
    expect(files).toContain(ALLOWED);
  });
});
