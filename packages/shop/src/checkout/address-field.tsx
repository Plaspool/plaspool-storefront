import * as React from "react";
import { Label } from "@plaspool/ui";

/**
 * The frame every address control sits in, and the classes a native select
 * needs to sit among `Input`s without looking like a browser default.
 *
 * SPLIT OUT OF `checkout-flow.tsx` so the country and state fields can be
 * rendered on their own under Vitest (`renderToStaticMarkup`, no portal) —
 * the pattern `returns/return-intro.tsx` set.
 */

/** Classed to match `Input` exactly — the same string `return-form.tsx` keeps
 *  for its native selects, for the same reason: the select sits among Inputs
 *  in one form and must read as family, not as a browser default beside them. */
export const NATIVE_SELECT_CLASSES =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

export function Field({
  id,
  label,
  required,
  help,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  /** The config's own wording for what this field wants — "House number,
   *  street, and the nearest landmark." Wired to the input by
   *  `aria-describedby` rather than left as loose text near it. */
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </Label>
      {children}
      {help && (
        <p id={`${id}-help`} className="text-xs text-muted-foreground">
          {help}
        </p>
      )}
    </div>
  );
}
