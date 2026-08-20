"use client";

import * as React from "react";
import {
  LineThumb,
  LineThumbSkeleton,
  OrderDetail,
  OrderDetailSkeleton,
  OrdersList,
  OrdersListSkeleton,
  lineImageAlt,
} from "@plaspool/shop";
import type { LineImage, LineImageIndex, OrderLine } from "@plaspool/shop";

import { BENCH, BENCH_LIST, THUMB_LINES } from "./fixtures";

/**
 * The order surfaces, every state at once, with no session behind them.
 *
 * Client-side because both components are — `OrdersList` takes an `onLoadMore`
 * callback, which cannot cross the server boundary, and the bench has nothing
 * to load. `lineImages` comes in from the route, which is a server component
 * and makes the same `getLineImages()` call the two account routes make.
 *
 * EACH CASE IS LABELLED WITH WHY IT IS HERE, not just what it is. A bench whose
 * cases are unexplained gets pruned by the next person who reads it.
 */
export function OrdersBench({ lineImages }: { lineImages: LineImageIndex }) {
  return (
    <div className="bg-background">
      <div className="mx-auto max-w-3xl px-4 pt-10 sm:px-6">
        <p className="border border-dashed border-brand-line px-4 py-3 font-mono text-xs text-muted-foreground">
          <strong className="font-semibold text-foreground">/dev/orders</strong> — development
          bench. Synthetic orders, real catalogue variant ids. Not reachable in a production
          build.
        </p>
      </div>

      <Case
        label="Image resolution"
        note="Every answer `getLineImages()` can give for a line, and what each one is allowed to be called."
      >
        <ThumbBench lineImages={lineImages} />
      </Case>

      {/* THE LIST'S WAIT, IMMEDIATELY ABOVE THE LIST. The defect a row skeleton
          grows is a SIDEWAYS one: heights matched perfectly while the first
          column went 40px -> 158px on resolve, sliding every order number and
          every status line right by up to 113px. No case on this bench could
          show it, which is exactly why it survived. Two rules to hold now: the
          left edge of the order numbers down BOTH lists, and the left edge of
          the rail. Neither may move between this case and the next, at any
          width, whatever line count a row happens to have. */}
      <Case
        label="The list, waiting"
        note="`OrdersListSkeleton`, the state `/account/orders` opens in. Hold a rule down the order numbers here and in the next case."
      >
        <OrdersListSkeleton />
      </Case>

      {/* THE SECOND PAGE ARRIVING, which is the same skeleton row in the one
          place it sits BESIDE resolved rows rather than replacing them — so a
          disagreement about width shows up as a step in one list rather than
          as a change between two screens. */}
      <Case
        label="The list, loading more"
        note="`loading` with a cursor: two resolved rows, then the two pending rows `loadMore` appends. The step, if there is one, is visible without a second screenshot."
      >
        <OrdersList
          items={BENCH_LIST.slice(0, 4)}
          cursor="cur_bench"
          loading
          failed={false}
          onLoadMore={() => {}}
          lineImages={lineImages}
        />
      </Case>

      <Case label="The list" note="Every order above, as `/account/orders` renders it.">
        <OrdersList
          items={BENCH_LIST}
          cursor={null}
          loading={false}
          failed={false}
          onLoadMore={() => {}}
          lineImages={lineImages}
        />
      </Case>

      {/* THE WAIT, IMMEDIATELY ABOVE THE PAGES IT STANDS IN FOR. "A skeleton
          that reflows on resolve is worse than none" is a claim about pixels,
          and the only way to check it is to measure the same blocks in both —
          which needs both on one page, at one width, in one browser. The order
          number is the five-line case below on purpose: that is the widest
          strip and the longest item list, so whatever the skeleton gets wrong
          about a variable-length list, it gets wrong most here. */}
      <Case
        label="The wait"
        note="`OrderDetailSkeleton`, the state every one of the pages below resolves from. Hold a rule against it and the next case."
      >
        <OrderDetailSkeleton orderNumber="2026-000007-F" isGuest={false} />
      </Case>

      {BENCH.map((bench) => (
        <Case key={bench.order.orderNumber} label={bench.label} note={bench.note}>
          <OrderDetail
            order={bench.order}
            lines={bench.lines}
            events={bench.events}
            isGuest={false}
            lineImages={lineImages}
          />
        </Case>
      ))}
    </div>
  );
}

/**
 * `LineThumb`, once per resolution case, side by side.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS SECTION IS FIRST ON THE PAGE. The defect these surfaces keep growing
 * is a claim the data does not support — an `alt` naming a colour the
 * photograph is not of was found and fixed once already on the product page.
 * An `alt` is invisible in a screenshot, so a reviewer looking at rows cannot
 * see it. Each case therefore prints the `src` it resolved to AND the name it
 * would carry if it were named, next to the picture it produced.
 *
 * TWO OF THE FOUR ARE SYNTHESISED, AND THEY SAY SO. The live catalogue has one
 * product, seven variants, and `imageUrl: null` on every one — so today every
 * line in the shop resolves to the product cover, and neither "the variant's
 * own photograph" nor "no photograph anywhere" can be reached with real data.
 * Both paths are real code and must be looked at, so they are built by
 * doctoring the live entry rather than by inventing a URL: the cover's bytes
 * stand in for a per-colour shot, which is also the sharpest possible demo —
 * the two pictures are IDENTICAL and only the name differs.
 * ═══════════════════════════════════════════════════════════════════════════
 */
function ThumbBench({ lineImages }: { lineImages: LineImageIndex }) {
  const live: LineImage | undefined = lineImages[THUMB_LINES.inCatalogue.variantId];

  const cases: {
    label: string;
    what: string;
    line: OrderLine;
    images: LineImageIndex;
    live: boolean;
  }[] = [
    {
      label: "Own photograph",
      what: "A photograph OF this colour. The only case whose name may say the colour of the thing photographed.",
      line: THUMB_LINES.inCatalogue,
      images: entry(THUMB_LINES.inCatalogue, live && { ...live, ofThisColour: true }),
      live: false,
    },
    {
      label: "Product cover",
      what: "No photograph of this colour, so the product's own picture stands in. The name must NOT claim the colour — and this is every line in the shop today.",
      line: THUMB_LINES.inCatalogue,
      images: entry(THUMB_LINES.inCatalogue, live),
      live: true,
    },
    {
      label: "No photograph",
      what: "Nothing photographed, but the catalogue knows the colour — so the drawn spool is tinted to the real hex and the name may say it.",
      line: THUMB_LINES.inCatalogue,
      images: entry(THUMB_LINES.inCatalogue, live && { ...live, src: null, ofThisColour: false }),
      live: false,
    },
    {
      label: "No photograph, no colour",
      what: "In the catalogue, but carrying neither a picture nor a `colorHex`. There is nothing left to draw, so this must render as the case below and not as the case above — an earlier cut drew a default grey spool here and captioned it with the line's colour.",
      line: THUMB_LINES.inCatalogue,
      images: entry(
        THUMB_LINES.inCatalogue,
        live && { ...live, src: null, ofThisColour: false, colourHex: null },
      ),
      live: false,
    },
    {
      label: "Not in the catalogue",
      what: "Discontinued, deleted, or a catalogue that could not be read. No picture and no colour exist, so none is drawn and nothing is named.",
      line: THUMB_LINES.absent,
      images: lineImages,
      live: true,
    },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <ul className="grid gap-6 sm:grid-cols-2">
        {cases.map((c) => {
          const resolved = c.images[c.line.variantId];
          return (
            <li key={c.label} className="flex gap-4">
              <LineThumb line={c.line} images={c.images} size={64} />
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground">
                  {c.label}
                  {!c.live && (
                    <span className="ml-2 font-normal normal-case tracking-normal text-muted-foreground">
                      synthesised — unreachable with live data
                    </span>
                  )}
                </p>
                <p className="mt-1 font-sans text-xs text-muted-foreground">{c.what}</p>
                <dl className="mt-2 font-mono text-[11px] leading-5 text-muted-foreground">
                  <Row label="src" value={resolved ? (resolved.src ?? "null — no photograph") : "—"} />
                  {/* `null` PRINTED AS `null`, not as a dash. The difference
                      between "the catalogue records no colour" and "there is no
                      catalogue entry" is invisible in the picture — both draw
                      the same empty box, on purpose — so the data rows are the
                      only place a reviewer can see that two distinct states
                      reached one honest answer. */}
                  <Row label="hex" value={resolved ? (resolved.colourHex ?? "null") : "—"} />
                  {/* THE LINE THAT MATTERS. Empty means the thumbnail is
                      decorative, which is what both surfaces use — the row
                      states the item in text beside it. */}
                  <Row
                    label="named"
                    value={lineImageAlt(c.line, resolved) || "— (decorative: nothing may be claimed)"}
                  />
                </dl>
              </div>
            </li>
          );
        })}

        <li className="flex gap-4">
          <LineThumbSkeleton size={64} />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground">
              The wait
            </p>
            <p className="mt-1 font-sans text-xs text-muted-foreground">
              `LineThumbSkeleton` at the same `size`. One number drives both boxes, so a row
              cannot shift when its picture lands — hold a rule against this and the four above.
            </p>
          </div>
        </li>
      </ul>
    </div>
  );
}

/** A one-entry index, so a case can be handed a doctored answer without any
 *  other case seeing it. An `undefined` image builds an EMPTY index, which is
 *  exactly what an unreachable catalogue produces — so the bench degrades to
 *  the honest case rather than to a blank column if the live catalogue ever
 *  stops carrying the variant these fixtures name. */
function entry(line: OrderLine, image: LineImage | undefined): LineImageIndex {
  return image ? { [line.variantId]: image } : {};
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-12 shrink-0 text-foreground/70">{label}</dt>
      <dd className="min-w-0 break-all">{value}</dd>
    </div>
  );
}

function Case({
  label,
  note,
  children,
}: {
  label: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t-4 border-dashed border-brand-line">
      <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-6">
        <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-brand">
          {label}
        </h2>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{note}</p>
      </div>
      {children}
    </section>
  );
}
