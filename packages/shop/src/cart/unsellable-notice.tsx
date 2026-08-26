"use client";

import * as React from "react";
import { PackageX, Trash2 } from "lucide-react";
import { Button } from "@plaspool/ui";

import type { UnsellableLine } from "./sellable";

/**
 * The basket's lines that cannot be bought, and the only control that can take
 * them out.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS AT ALL, AND WHY IT IS NOT JUST A QUIETER BADGE.
 *
 * A line whose variant has left the catalogue used to be dropped from
 * `resolved` and counted in `itemCount`: badge 1, drawer "Your cart is empty",
 * and no Remove button anywhere in the store able to name it, because every
 * control that renders one iterates `resolved`. The basket sat on that number
 * until it expired.
 *
 * Fixing only the count would have made that basket SILENT rather than wrong —
 * the shopper would see an empty cart while `/checkout` went on refusing the
 * whole thing with `unresolved_lines`, whose own copy is "go back to the cart
 * and remove it". This is the row that message has always been pointing at.
 *
 * PROPS, NOT `useCart()`. Every other cart surface reads the context directly,
 * and this one deliberately does not: a component that reaches for a provider
 * cannot be rendered in this repo's test environment, which is `node` with no
 * jsdom and no browser (see `vitest.config.mts`). The bug being fixed here was
 * two surfaces making contradictory claims about one basket — a claim only
 * visible in the rendered bytes — so the sentence this puts on screen has to be
 * assertable. `unsellable-notice.test.tsx` is what that buys.
 *
 * NOT `role="alert"`. The problem banner beside this one is an alert because
 * the shopper pressed something and is owed an answer. This is state that was
 * already true when the page loaded, and interrupting a screen reader mid-flow
 * to announce it would be the wrong urgency for something that has been sitting
 * in the basket since before they arrived.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export interface UnsellableNoticeProps {
  lines: UnsellableLine[];
  /** A cart write is in flight; the controls disable rather than letting two
   *  edits race and land in whatever order the network chose. */
  pending?: boolean;
  onRemove: (lineId: string) => void;
  className?: string;
}

export function UnsellableNotice({
  lines,
  pending = false,
  onRemove,
  className,
}: UnsellableNoticeProps) {
  /* A GENERATED ID, NOT A CONSTANT. The drawer is mounted for every `(shop)`
     route, so opening it on `/cart` puts two of these in one document — and a
     duplicated `id` breaks the `aria-labelledby` on both. */
  const headingId = React.useId();

  if (lines.length === 0) return null;

  const many = lines.length > 1;

  return (
    <section
      aria-labelledby={headingId}
      className={`border border-destructive-strong px-3 py-3 ${className ?? ""}`}
    >
      <h2
        id={headingId}
        className="flex items-center gap-2 font-sans text-sm font-semibold text-destructive-strong"
      >
        <PackageX aria-hidden="true" className="h-4 w-4 shrink-0" />
        {many ? "These items are no longer available" : "This item is no longer available"}
      </h2>

      <p className="mt-1 font-sans text-xs text-muted-foreground">
        {/* SAYS WHAT IT BLOCKS. "No longer available" on its own reads as a
            note; the shopper needs to know the basket will not check out until
            the row is gone, because that is the only reason to act on it. */}
        Remove {many ? "them" : "it"} to continue to checkout.
      </p>

      <ul className="mt-3 flex flex-col gap-2">
        {lines.map((line) => {
          /* THE CATALOGUE'S NAME WHERE THERE STILL IS ONE. When the variant has
             gone entirely there is nothing honest left to call it — the API
             sends null for the title, the sku and the options alike — so it is
             described rather than named. Inventing a name for a row nobody can
             look up would be the same lie the badge was telling, and the
             variant id is an internal handle, never a thing to show a shopper. */
          const label = line.name ?? "An item you added";
          return (
            <li key={line.lineId} className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate font-sans text-sm text-foreground">
                {label}
                {line.qty > 1 && (
                  <span className="ml-1 font-mono text-xs tabular-nums text-muted-foreground">
                    × {line.qty}
                  </span>
                )}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => onRemove(line.lineId)}
                aria-label={`Remove ${label} from cart`}
                className="h-auto shrink-0 gap-1.5 px-2 py-1 font-sans text-xs text-destructive-strong focus-visible:ring-brand focus-visible:ring-offset-background"
              >
                <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                Remove
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
