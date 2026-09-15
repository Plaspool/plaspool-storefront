import { cn } from "@plaspool/ui";

import type { OrderBox } from "../data/orders-api";

/**
 * What was inside a mystery box, under its order line.
 *
 * PRESENTATIONAL AND PROP-DRIVEN so `renderToStaticMarkup` can assert it — the
 * order page around it is a client component this suite cannot render whole.
 *
 * ═══ THREE STATES, AND ONLY ONE OF THEM IS A LIST ═══
 *   - Not a box, and nothing revealed: renders NOTHING.
 *   - A box with nothing revealed: one quiet line saying so. Never an empty
 *     "Inside" heading — absent `boxes` means "not yet", not "empty".
 *   - Revealed: "Inside", then the items. Several boxes get "Box 1", "Box 2"
 *     by POSITION ONLY — the API names none, and guessing which parcel held
 *     which box would be a claim nobody made. When fewer boxes are revealed
 *     than were bought, the quiet line stays for the rest.
 *
 * Titles are snapshots of what was packed and are rendered verbatim, never
 * linked: the product may since have been renamed or removed.
 */

export const BOX_SURPRISE_LINE = "What's inside stays a surprise until it arrives.";

/** `title` plus its option values, joined the way every line in the shop is. */
export function boxItemLabel(item: { title: string; optionValues?: Record<string, string> | null }): string {
  return [item.title, ...Object.values(item.optionValues ?? {})]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(" · ");
}

export function BoxContents({
  isBox,
  boxes,
  qty,
  cancelled = false,
  className,
}: {
  /** From the catalogue — the line's own snapshot carries no box flag. */
  isBox: boolean;
  /** The line's `boxes`, as sent. Absent until delivered. */
  boxes?: OrderBox[] | null;
  qty: number;
  /** A cancelled order — possibly the shop's automatic cancel-and-refund of a
   *  box it could not fill. Nothing is on its way, so there is no surprise to
   *  promise; the order's own cancelled state says the rest. */
  cancelled?: boolean;
  className?: string;
}) {
  const revealed = (boxes ?? []).filter((box) => Array.isArray(box?.items));
  if (!isBox && revealed.length === 0) return null;
  if (cancelled && revealed.length === 0) return null;
  const stillSurprise = !cancelled && revealed.length < Math.max(qty, 1);

  if (revealed.length === 0) {
    return <p className={cn("mt-1 text-xs text-muted-foreground", className)}>{BOX_SURPRISE_LINE}</p>;
  }

  const numbered = revealed.length > 1 || qty > 1;
  return (
    <div className={cn("mt-2", className)}>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Inside</p>
      {revealed.map((box, index) => (
        <div key={index} className="mt-1.5">
          {numbered && <p className="text-xs font-medium text-foreground">Box {index + 1}</p>}
          <ul className="flex flex-col gap-0.5 text-xs text-foreground">
            {box.items.map((item, itemIndex) => (
              <li key={itemIndex}>{boxItemLabel(item)}</li>
            ))}
          </ul>
        </div>
      ))}
      {stillSurprise && <p className="mt-1.5 text-xs text-muted-foreground">{BOX_SURPRISE_LINE}</p>}
    </div>
  );
}
