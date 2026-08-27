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
  body: string;
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
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
