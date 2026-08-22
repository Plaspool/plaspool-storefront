"use client";

import * as React from "react";
import Link from "next/link";

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
 * `{ returnsModal: true }`, so the address bar reads `/returns` for as long
 * as it is open, and so Back closes the dialog rather than leaving whatever
 * page it was opened over — `popstate` closes it directly, without touching
 * history again, because the browser has already moved it. Closing the
 * dialog through its OWN control (Escape, the overlay, the × button) is the
 * opposite direction: nothing has moved history yet, so `onOpenChange` steps
 * it back itself, guarded by the same tag, so a shopper who never opened this
 * dialog is never sent Back by closing some other dialog.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export interface ReturnsCtaProps {
  program: RewardsProgram;
  areas: ServiceArea[];
  label: string;
  className?: string;
}

export function ReturnsCta({ program, areas, label, className }: ReturnsCtaProps) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onPop = () => setOpen(false);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function onClick(event: React.MouseEvent<HTMLAnchorElement>) {
    // Let the browser do its job for anything that is not a plain left click:
    // a new tab, a new window, a download, a modified click. Intercepting
    // those is how a link stops behaving like a link.
    if (event.defaultPrevented) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (event.button !== 0) return;

    event.preventDefault();
    setOpen(true);
    window.history.pushState({ returnsModal: true }, "", "/returns");
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    // Only when THIS dialog closed itself, and only when it was this dialog
    // that pushed the entry Back would otherwise have to walk past.
    if (!next && window.history.state?.returnsModal) {
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
