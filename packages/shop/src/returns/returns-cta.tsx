"use client";

import * as React from "react";
import { Link } from "../components/link";
import { usePathname } from "next/navigation";

import { ReturnModal } from "./return-modal";
import type { ServiceArea } from "../data/returns-api";
import type { RewardsProgram } from "../data/marketing";

/**
 * A link to `/returns` that opens as a dialog instead of navigating, when a
 * script is running to intercept it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * IT IS A REAL `<Link href="/returns">`, ALWAYS — NEVER A `<button>`.
 *
 * The dialog is progressive enhancement laid over a link that already goes
 * somewhere real (Task 9). Rendering a button here would mean a shopper
 * without JavaScript, or one whose bundle has not finished loading yet, gets
 * a dead control instead of the page that does the exact same job. Pinned by
 * `returns-cta.test.tsx`, the one behaviour in this file the suite can reach.
 *
 * ═══ THE `onClick` ONLY INTERCEPTS A PLAIN LEFT CLICK ═══
 * A modified click — a new tab, a new window, a download, cmd/ctrl/shift/alt
 * held, a non-primary button, or a click something upstream already called
 * `preventDefault()` on — is left to the browser. Intercepting one of those is
 * how a link stops behaving like a link: `cmd`-clicking a "Send spools back"
 * button that silently opens the current tab instead of a new one is a bug
 * whether or not the destination is the "same" content.
 *
 * ═══ THE URL AND THE DIALOG ARE KEPT IN SYNC THROUGH HISTORY, BY HAND ═══
 * Opening the dialog pushes `/returns` as a new history entry, tagged
 * `{ returnsModal: tag }`, so the address bar reads `/returns` for as long
 * as it is open. `popstate` reads that tag off whichever entry the browser
 * just landed ON, in EITHER direction, rather than assuming which way it
 * moved: landing on an entry WITHOUT this instance's tag closes the dialog
 * (Back, off the top of it), landing back ON it reopens it (Forward, into
 * it). Closing unconditionally — the first version of this file — left
 * Forward showing the underlying page with the address bar still reading
 * `/returns`, and made a Back past this dialog into an unrelated navigation
 * take two presses instead of one, since the first press only reconciled
 * state that a correct read of `popstate` would have reconciled already.
 * Closing the dialog through its OWN control (Escape, the overlay, the ×
 * button) is the opposite direction: nothing has moved history yet, so
 * `onOpenChange` steps it back itself, guarded by the same tag, so a shopper
 * who never opened this dialog is never sent Back by closing some other
 * dialog.
 *
 * ═══ THE TAG IS PER INSTANCE, NOT A CONSTANT — `/store` MOUNTS TWO ═══
 * `AnnouncementBar` sits in `ShopShell` (every `(shop)` route) and
 * `RewardsBand` sits on `/store` too, so the home page carries two
 * `ReturnsCta`s at once once an operator publishes a `top_bar` banner. A
 * shared `{ returnsModal: true }` could not tell them apart: BOTH instances'
 * `popstate` listeners read the same boolean off the one entry either of them
 * pushed, so opening from one and pressing Back then Forward reopened BOTH —
 * two Radix overlays, two focus scopes, two scroll locks, Escape clearing
 * only one. `React.useId()` gives each MOUNTED instance its own `tag`, pushed
 * as the state's value instead of `true`; `isOwnEntry` below is the one place
 * that comparison happens, and it is exported specifically so the
 * disambiguation is provable without a DOM — see `returns-cta.test.tsx`.
 *
 * ═══ AND IT CLOSES ITSELF ON A ROUTE CHANGE AWAY FROM `/returns` ═══
 * The bar's own instance does not unmount when its `already-open` box (or,
 * now, the confirmation) links to `/account/returns` — `ShopShell` wraps that
 * route too — so without this, the bar's dialog stayed open, over the page
 * the shopper actually asked to go to. THE GUARD MATTERS MORE THAN THE IDEA:
 * Next patches `window.history.pushState`, so THIS component's own call above
 * eventually moves `usePathname()` to `/returns` too, but not synchronously
 * with the `setOpen(true)` beside it — router state catches up a render or
 * two later. A naive `if (open && pathname !== "/returns") setOpen(false)`
 * fires on the render where `open` has just gone true and `pathname` has not
 * caught up yet, closing the dialog the instant it opens. `sawReturns` is the
 * guard: only a pathname that HAS been `/returns` at least once since this
 * dialog opened, and then is not, counts as "navigated away".
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Whether a `popstate` event landed on the entry THIS instance pushed,
 *  rather than merely on some entry carrying the shared key. Exported and
 *  pure so the disambiguation two mounted `ReturnsCta`s need is provable
 *  without a DOM — see `returns-cta.test.tsx`. */
export function isOwnEntry(state: unknown, tag: string): boolean {
  return Boolean(
    state && typeof state === "object" && (state as { returnsModal?: unknown }).returnsModal === tag,
  );
}

export interface ReturnsCtaProps {
  program: RewardsProgram;
  areas: ServiceArea[];
  label: string;
  className?: string;
}

export function ReturnsCta({ program, areas, label, className }: ReturnsCtaProps) {
  const [open, setOpen] = React.useState(false);
  /* Stable for this instance's whole mounted life — see the file header for
     why more than one `ReturnsCta` can exist at once and why a shared
     constant cannot stand in for it. */
  const tag = React.useId();

  const pathname = usePathname();
  /* Whether THIS dialog has been seen sitting on `/returns`, while open, at
     least once. Guards the effect below against the render where `open` has
     just gone true but router state has not caught up yet — see the file
     header. Reset the moment this instance closes, so the next open starts
     the same check fresh. */
  const sawReturns = React.useRef(false);

  React.useEffect(() => {
    if (!open) {
      sawReturns.current = false;
      return;
    }
    if (pathname === "/returns") {
      sawReturns.current = true;
      return;
    }
    // A real departure: this dialog was on `/returns` at least once since it
    // opened, and the address bar has since moved elsewhere — a Link inside
    // the form (the `already-open` box, or the confirmation) taking the
    // shopper to `/account/returns` while this instance never unmounted.
    // History is left alone here: that navigation already pushed its own
    // entry, and stepping Back would undo the very thing the shopper asked
    // for.
    if (sawReturns.current) setOpen(false);
  }, [open, pathname]);

  React.useEffect(() => {
    // Reads the tag off the entry the browser just landed on, rather than
    // assuming a `popstate` always means "closed" — see the file header for
    // the two ways that assumption broke, and for why the comparison is
    // against THIS instance's own tag rather than a shared boolean.
    const onPop = (event: PopStateEvent) => {
      setOpen(isOwnEntry(event.state, tag));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [tag]);

  function onClick(event: React.MouseEvent<HTMLAnchorElement>) {
    // Let the browser do its job for anything that is not a plain left click:
    // a new tab, a new window, a download, a modified click. Intercepting
    // those is how a link stops behaving like a link.
    if (event.defaultPrevented) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (event.button !== 0) return;

    event.preventDefault();
    setOpen(true);
    window.history.pushState({ returnsModal: tag }, "", "/returns");
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    // Only when THIS dialog closed itself, and only when it was this
    // instance's own entry Back would otherwise have to walk past.
    if (!next && isOwnEntry(window.history.state, tag)) {
      window.history.back();
    }
  }

  return (
    <>
      <Link href="/returns" onClick={onClick} className={className}>
        {label}
      </Link>
      <ReturnModal open={open} onOpenChange={onOpenChange} program={program} areas={areas} />
    </>
  );
}
