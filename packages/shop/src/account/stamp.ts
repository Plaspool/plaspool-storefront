/**
 * One date formatter for the account area.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THERE WERE FIVE OF THESE, UNDER TWO NAMES, IN ONE FOLDER.
 *
 * `formatStamp` in `order-progress.tsx`, `status-timeline.tsx` and
 * `rewards-page.tsx` — the last two byte-identical — plus `formatDate` in
 * `order-detail.tsx` and `orders-list.tsx`. Every one of them called
 * `toLocaleDateString("en-NG", …)` with a slightly different options object,
 * and each was written by somebody who did not know the other four existed.
 *
 * The failure that shape produces is not a crash. It is a shop that writes
 * "19 Aug 2026, 1:00 pm" on one screen and "19 Aug 2026, 13:00" on the next,
 * and nobody notices because no single file is wrong.
 *
 * ═══ THREE SHAPES, BECAUSE THERE ARE GENUINELY THREE JOBS ═══
 * They are options on one function rather than three functions, so a fourth
 * caller has to pick from what exists instead of adding a fifth spelling.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface StampOptions {
  /**
   * The narrowest form, for a column that cannot hold a sentence.
   *
   * Under the five-stop track a 320px column is ~51px wide: "19 Aug 2025"
   * wrapped to two lines there, which made the track ragged AND made it taller
   * than the skeleton reserving its space. THE YEAR IS DROPPED ONLY WHEN IT IS
   * THIS YEAR — an order from last August reading "13 Aug" beside nothing
   * carrying a year is a date the shopper has to guess at.
   */
  short?: boolean;
  /** A date with no clock, for a page header that says when an order was
   *  placed. The time of day is noise there. */
  dateOnly?: boolean;
}

/** Epoch ms → the shop's date. An unparseable value is `""`, never "Invalid
 *  Date": a blank space is a gap, and "Invalid Date" is the page shouting. */
export function formatStamp(epochMs: number, opts: StampOptions = {}): string {
  const date = new Date(epochMs);
  if (Number.isNaN(date.getTime())) return "";

  if (opts.short) {
    const thisYear = date.getFullYear() === new Date().getFullYear();
    return date.toLocaleDateString("en-NG", {
      day: "numeric",
      month: "short",
      ...(thisYear ? {} : { year: "2-digit" }),
    });
  }

  if (opts.dateOnly) {
    return date.toLocaleDateString("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  return date.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
