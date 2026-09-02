"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "../cn"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogClose = DialogPrimitive.Close

const DialogPortal = DialogPrimitive.Portal

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    className={cn(
      /* The scrim is a fade at every width — it never slides — so it keeps the
         fade timing rather than the sheet's, and settles while the panel is
         still arriving. Spelled out for the same reason the content's is. */
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:duration-200 data-[state=closed]:duration-150",
      className
    )}
    {...props}
    ref={ref}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

/**
 * The same dialog, re-seated on the bottom edge of a phone.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WRITTEN ENTIRELY AS `max-sm:` OVERRIDES, AND THAT IS THE WHOLE DESIGN.
 *
 * Every class below is scoped to widths under the `sm` breakpoint, so the
 * desktop dialog's own classes are not edited, re-ordered or reset — there is
 * no `sm:` restoration list to keep in sync with them, and no way for this
 * variant to change what a wide screen renders. Opt-in via `mobile="sheet"`,
 * so the cart drawer and every other consumer are untouched by default.
 *
 * A `Sheet` was the obvious alternative and is the wrong tool: it is the same
 * Radix dialog underneath, so using both would mean either mounting two of
 * them — two focus traps, two scroll locks, two Escape handlers — or picking
 * between them with `matchMedia`, which cannot answer during the server
 * render and so flashes the wrong one on first paint. CSS knows the viewport
 * already.
 *
 * `92dvh` rather than `100dvh` leaves the underlying page visible above the
 * sheet, which is what tells a shopper it is a layer over something rather
 * than a new screen. `dvh` and not `vh` because mobile browser chrome
 * collapses on scroll, and `vh` would leave the pinned submit under it.
 * ═══════════════════════════════════════════════════════════════════════════
 */
const SHEET_ON_MOBILE = [
  /* Anchored to the bottom edge, full width, instead of centred on both axes.
     The two `translate-*-0`s are what undo the centring transform. */
  "max-sm:inset-x-0 max-sm:bottom-0 max-sm:left-0 max-sm:top-auto",
  "max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0",
  /* Only the top edge is a border now — the other three sit off-screen.
     `rounded-t-lg` is `--radius` exactly. It was `rounded-t-2xl`, which is
     1rem and the ONLY `2xl` radius anywhere in this codebase: the scale in
     use is `rounded-md`/`sm`/`lg` off the one token, and a sheet corner
     twice every other corner in the app reads as imported from somewhere
     else. */
  /* The bottom corners have to be squared off explicitly now that the base
     is `rounded-lg`, or the sheet curves away from the screen edge it is
     flush against. */
  "max-sm:max-h-[92dvh] max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0",
  /* Tighter than the desktop `p-6`/`gap-4`: on a narrow screen that padding
     is width the content needs more than the margin does.

     NO BOTTOM PADDING HERE — it is the caller's, deliberately. See the note on
     `DialogContentProps["mobile"]` and `ReturnModal`'s `pb-0`. */
  "max-sm:gap-3 max-sm:px-4 max-sm:pt-3",
  /* It rises from the edge it is attached to rather than fading in place.
     Composes with the base fade — different custom properties. */
  "max-sm:data-[state=open]:slide-in-from-bottom",
  "max-sm:data-[state=closed]:slide-out-to-bottom",
  /* AND IT TAKES `sheet.tsx`'s TIMING, because below `sm` this IS that
     motion: a full-width panel travelling in from a screen edge. Those are
     the durations the cart drawer and the filter drawer already move at, so
     matching them means the shop has one speed for "a panel arrives from an
     edge" rather than two. The base pair above stays for the centred dialog,
     which is a fade in place and would read as sluggish at 500ms. */
  "max-sm:data-[state=open]:duration-500 max-sm:data-[state=closed]:duration-300",
].join(" ");

interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** `"sheet"` re-seats the dialog as a bottom sheet below `sm` and changes
   *  nothing at or above it. See `SHEET_ON_MOBILE`. */
  mobile?: "sheet"
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, mobile, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4",
        /* `rounded-lg` is `--radius` exactly. This carried NO radius at all,
           which is not a square-corner idiom being honoured: the flat panels
           that are legitimately square in this system are the
           `border-2 border-foreground` ones (`guest-prompt.tsx`), whereas
           this is `border border-brand-line … shadow-lg` — the elevated-card
           treatment with its corner deleted. Everything inside it is on the
           scale (`Card` `rounded-lg`, inputs and selects `rounded-md`, the
           close button `rounded-sm`), so a hard-square frame around
           `rounded-md` fields read as unfinished rather than as deliberate. */
        "max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-lg border border-brand-line bg-background p-6 shadow-lg",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        /* SPELLED OUT, because the default was nobody's decision.
           `tailwindcss-animate` falls back to 150ms, so this dialog opened at
           one speed, `sheet.tsx` — the same package's other overlay — at
           500/300, and the step change inside this very dialog at 200. Three
           timings for adjacent motions, none of them chosen.

           The scale now: a panel arriving from a screen edge takes
           `sheet.tsx`'s 500/300 (applied under `sm`, where this becomes
           exactly that motion — see `SHEET_ON_MOBILE`); a fade in place takes
           200/150; and content changing INSIDE an open dialog is faster still
           at 200, so the container always settles before its contents move. */
        "data-[state=open]:duration-200 data-[state=closed]:duration-150",
        mobile === "sheet" && SHEET_ON_MOBILE,
        className,
      )}
      {...props}
    >
      {children}
      {/* `focus-visible:` and the BRAND ring. Stock shadcn ships `focus:` with
          `--ring` (near-black), which made this the one control in the dialog
          that ringed a different colour from every other — the step dots, the
          Back button and the intro's checkbox all ring `--brand` — and ringed
          it on a plain mouse click too. */}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
