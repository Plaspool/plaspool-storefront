"use client"

import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"

import { cn } from "../cn"

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <ScrollAreaPrimitive.Root
    ref={ref}
    className={cn("relative overflow-hidden", className)}
    {...props}
  >
    {/*
      ═══════════════════════════════════════════════════════════════════════
      `[&>div]:!block` — THE ONE CLASS THAT STOPS EVERY DRAWER OVERFLOWING.

      Radix wraps whatever you put in a Viewport in a div of its own and sets
      `display: table; min-width: 100%` on it INLINE. That is deliberate on
      their part: a table box shrink-wraps to MAX-CONTENT, which is what lets
      content wider than the viewport scroll horizontally.

      It is also completely wrong for a narrow vertical drawer, and it defeats
      every `min-w-0` and `truncate` underneath it. Measured on the cart drawer
      at a 768px viewport, one line, one ordinary product name:

          sheet 384px │ viewport 383px │ table div 519px │ row 471px

      The row was not overflowing because anything was too wide — it had 519px
      of space and used it. `truncate` never fired (`scrollWidth` equalled
      `clientWidth`), so there was no ellipsis either; the name was simply
      sliced off by the Root's `overflow: hidden` 36px past the sheet edge, and
      the unit price — "₦26,500 each" — rendered ENTIRELY outside the drawer.
      Nothing looked broken in the DOM. It just was not on screen.

      `!` because Radix sets `display` inline, and an inline style beats a
      class. `[&>div]` reaches the wrapper we do not otherwise control.

      ═══ WHY THE PRIMITIVE AND NOT THE CART ═══
      All four consumers are vertical scroll regions in narrow drawers — this
      cart, both mobile navs and the filter drawer — and not one of them wants
      to scroll sideways. The other three carry the identical latent defect;
      fixing only the surface that was reported is "the instance fixed, the
      sibling left", which is the failure this repo's ledger keeps recording.

      A future consumer that genuinely needs horizontal scrolling wants a
      `horizontal` orientation and a `w-max` child, which is explicit and
      local — not this, which is a global default nobody chose.
      ═══════════════════════════════════════════════════════════════════════
    */}
    <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit] [&>div]:!block">
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
))
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none transition-colors",
      orientation === "vertical" &&
        "h-full w-2.5 border-l border-l-transparent p-[1px]",
      orientation === "horizontal" &&
        "h-2.5 flex-col border-t border-t-transparent p-[1px]",
      className
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
))
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName

export { ScrollArea, ScrollBar }
