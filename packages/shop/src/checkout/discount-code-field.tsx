"use client";

import * as React from "react";
import { Loader2, Tag, X } from "lucide-react";

import { Button, Input, Label } from "@plaspool/ui";

/**
 * "Have a discount code?" — on the review step, beside the total it moves.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * IT IS A FORM OF ITS OWN, AND THAT IS NOT AN ACCIDENT.
 *
 * A bare input with an Apply button inside a page that also has a Pay button
 * is a trap: pressing Enter in the field submits whatever form encloses it,
 * and if that is the checkout, the shopper pays instead of applying their
 * code. Its own `<form>` with its own submit means Enter does the only thing
 * Enter could sensibly mean here.
 *
 * ═══ COLLAPSED UNTIL ASKED FOR ═══
 * Most orders have no code, and an empty field labelled "Discount code" on the
 * payment screen is a small invitation to go and look for one — which means
 * leaving the checkout. It opens on a click, and stays open once a code is on.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface DiscountCodeFieldProps {
  /** The code currently applied, or null. */
  applied: string | null;
  disabled?: boolean;
  onApply: (code: string) => void | Promise<void>;
  onRemove: () => void | Promise<void>;
}

export function DiscountCodeField({
  applied,
  disabled = false,
  onApply,
  onRemove,
}: DiscountCodeFieldProps) {
  const [open, setOpen] = React.useState(false);
  const [code, setCode] = React.useState("");
  const id = React.useId();

  /* An applied code keeps the section open — collapsing it would hide the one
     control that takes the discount off again. */
  const expanded = open || applied !== null;

  if (applied) {
    return (
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <Tag aria-hidden="true" className="h-4 w-4 shrink-0 text-brand" />
          <span className="min-w-0 truncate text-sm text-foreground">
            Code <span className="font-mono font-semibold">{applied}</span> applied
          </span>
        </span>
        {/* THE AMOUNT IS NOT REPEATED HERE. It is already a line in the totals
            above, in the operator's own wording — saying it twice invites the
            two to disagree the day an adjustment is computed differently from
            what this component was told. */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => void onRemove()}
          className="shrink-0 gap-1.5"
        >
          {disabled ? (
            <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <X aria-hidden="true" className="h-3.5 w-3.5" />
          )}
          Remove
        </Button>
      </div>
    );
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Have a discount code?
      </button>
    );
  }

  return (
    <form
      /* Its own form — see the header. `noValidate` because the only rule is
         "not empty", which the disabled submit already expresses without a
         browser bubble appearing over the totals. */
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = code.trim();
        if (!trimmed) return;
        void onApply(trimmed);
      }}
      className="flex flex-col gap-1.5"
    >
      <Label htmlFor={id}>Discount code</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={code}
          disabled={disabled}
          onChange={(event) => setCode(event.target.value)}
          /* UPPERCASED ON SCREEN, NOT IN STATE. Codes are conventionally
             written in caps and the shop's own are; forcing the VALUE would
             fight a shopper pasting a code that is genuinely lower-case, and
             the server is the one that decides what matches. */
          className="flex-1 uppercase"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="SPOOL10"
        />
        <Button type="submit" tone="default" disabled={disabled || !code.trim()}>
          {disabled && <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />}
          Apply
        </Button>
      </div>
    </form>
  );
}
