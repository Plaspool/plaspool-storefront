import type { ReactNode } from "react";
import { cn } from "@plaspool/ui";

/**
 * Every "there is nothing here" surface in the store.
 *
 * The body says what to do next. It never apologises and never fills the space
 * with mood — "No spools in this category yet. Try PLA or PETG, which carry
 * the widest range." is the register.
 */

export interface EmptyStateProps {
  /** A Lucide icon at its default 24 px reads correctly in the circle. */
  icon: ReactNode;
  title: string;
  /**
   * What to do next. OPTIONAL, because some empty states say it all in the
   * title and an action button — the cart is the case: "Your cart is empty"
   * over a "Browse the store" button needs no sentence between them, and the
   * one that was there listed materials as though the shopper had asked what
   * the shop sells rather than been told their basket was empty.
   *
   * Omit it rather than passing `""`: an empty string still renders the
   * paragraph, and with it `mt-2` and a line box of vertical space.
   */
  body?: string;
  /** Usually a `Button`. Optional, because some empty states have nowhere
   *  useful to send you. */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, body, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-16 text-center",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-muted-foreground"
      >
        {icon}
      </span>
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {body && <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
