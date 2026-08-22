"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { Button, Input, Label, NEO_SURFACE, Textarea, cn } from "@plaspool/ui";

import { ReturnRequestError, requestReturn } from "../data/returns-api";
import type { ReturnConfirmation, ServiceArea } from "../data/returns-api";
import { pointsLabel, unitLabel } from "../data/marketing";
import type { RewardsProgram } from "../data/marketing";

/**
 * Asking for a return.
 *
 * THE DIRECT SIBLING OF `product/review-form.tsx` — a client form posting
 * cross-origin, field-level errors first and a whole-form message only as the
 * fallback. Where the two differ, it is because the API differs, not because
 * this form invented its own idiom.
 *
 * ═══ THE DISTRICT PICKER IS A NATIVE `<select>`, NOT `@plaspool/ui`'s `Select` ═══
 * That `Select` is Radix: it portals its listbox and renders it only once
 * opened on the client, so under `renderToStaticMarkup` — this file's own test
 * harness — it emits zero options, and the district grouping this form's own
 * test asserts on would have nothing to assert against. (NOT because it makes
 * the form work without JavaScript — it does not. There is no `name`
 * attribute anywhere in this form and no `action`, so a shopper with no
 * script running cannot submit any of it regardless of what this one field is
 * made of; that is not this select's problem to solve.) There is no
 * form-select precedent to violate either: the only Radix `Select` in this
 * package is `listing/sort-select.tsx`, a sort control where client-only is
 * fine, and the checkout's address form uses `<Input>` throughout, even for
 * "State". A native select is also the better mobile control, which is where
 * most of this shop's traffic is.
 *
 * ═══ NO EMAIL FIELD ═══
 * The pickup address belongs to the signed-in session, not to whatever a
 * shopper types. The API refuses an `email` key outright — see
 * `return-form.test.tsx`'s first assertion, pinned where a regression would
 * otherwise slip in unnoticed as a "helpful" extra field.
 *
 * ═══ EVERY WORD OF THE PROGRAMME COMES FROM `program`, NEVER FROM SOURCE ═══
 * `data/marketing.ts` sets the rule out at length and `house-rules.test.ts`
 * greps the real nouns out of this package. `pointsLabel`/`unitLabel` are how
 * a count agrees with a noun this file never spells.
 *
 * ═══ THE FORM NEVER EMPTIES ITSELF ═══
 * Every branch `placeError` can reach is recoverable — a paused programme, a
 * rate limit, a session that expired mid-type — and a form that clears on any
 * of them is one the shopper types twice. Nothing here calls a setter that
 * would reset a field the shopper filled in. The one branch that cannot avoid
 * losing what was typed is `sign-in`: recovering means leaving the page, and
 * the copy there says so rather than promising what a navigation cannot keep.
 *
 * ═══ `onDone` FIRES FROM THE CONFIRMATION, NOT AS PART OF SUCCESS ═══
 * Task 10 passes `onDone={() => onOpenChange(false)}`, closing its dialog the
 * instant it runs. Calling it alongside `setConfirmation(...)` would unmount
 * this form in the same tick React would otherwise paint the confirmation —
 * the one screen `requestId` is ever shown on would never be seen. `onDone`
 * fires only from the confirmation's own "Done" control; the standalone
 * `/returns` page passes no `onDone`, so its confirmation simply stays put.
 */

/** The API's own floor for one request, mirrored so a quantity below it is
 *  reported beside the field before a request is ever made. The API still
 *  gets the last word — see `placeError`'s `below-minimum` case — because the
 *  programme this form was handed can go stale while it sits open in a tab. */
function belowMinimum(qty: number, program: RewardsProgram): boolean {
  return !Number.isFinite(qty) || !Number.isInteger(qty) || qty < program.minUnitsPerReturn;
}

/** Joins whichever message ids currently apply to one field into a single
 *  `aria-describedby`, dropping the falsy ones. A field can carry permanent
 *  help text, an error, both, or neither, and `aria-describedby` accepts a
 *  space-separated list for exactly this case. */
function describedBy(...parts: Array<string | false | null | undefined>): string | undefined {
  const ids = parts.filter((part): part is string => Boolean(part));
  return ids.length ? ids.join(" ") : undefined;
}

/*
 * A local, non-exported `Field` — deliberately duplicated from
 * `checkout/checkout-flow.tsx:137` rather than imported. The checkout's own
 * copy is a non-exported local too, so there is nothing to import; lifting it
 * into `@plaspool/ui` so two forms can share it is a refactor of its own, not
 * this task's business.
 */
function Field({
  id,
  label,
  required,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </Label>
      {children}
    </div>
  );
}

/** Classed to match `Input` exactly, minus the classes a `<select>` has no use
 *  for (`file:…`, `placeholder:…`) — the two controls sit in the same form and
 *  must read as one family, not as a themed control beside a browser default. */
const NATIVE_SELECT_CLASSES =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

/** The API's own ceilings (`server/marketing/returns/customer.ts` in the
 *  admin repo — `phone`/`name` at 200, `pickupAddress` at 1000), mirrored so
 *  a paste from somewhere long fails quietly at the keyboard rather than
 *  loudly as a 400 after a round trip. */
const PHONE_MAX = 200;
const ADDRESS_MAX = 1000;
const NAME_MAX = 200;

/** Where a refusal belongs on screen. `null` means "above the submit". */
type Placement =
  | { field: "qtyDeclared" | "serviceAreaId"; message: string }
  | { field: null; message: string }
  | { kind: "already-open"; existingId: string }
  | { kind: "sign-in" };

/** Exported so the whole branch table is testable without a DOM — this
 *  suite has none, deliberately, and the brief calls this function "the
 *  load-bearing part". See `return-form.test.tsx`. */
export function placeError(err: ReturnRequestError, program: RewardsProgram): Placement {
  switch (err.reason) {
    case "below-minimum": {
      const min = err.min ?? program.minUnitsPerReturn;
      return {
        field: "qtyDeclared",
        message: `We collect from ${min} ${unitLabel(min, program)} upwards.`,
      };
    }
    case "outside-area": {
      const served = err.served ?? [];
      return {
        field: "serviceAreaId",
        message: served.length
          ? `We do not collect there yet. We do collect from ${served.join(", ")}.`
          : "We do not collect there yet.",
      };
    }
    /* NOT AN ERROR. The shopper's answer already exists; the useful thing is a
       way to it, not a red sentence about a rule they did not know. */
    case "already-open":
      return { kind: "already-open", existingId: err.existingId ?? "" };
    /* A session can expire with a form half-typed, so this is handled here and
       not only by the dialog's guest branch. */
    case "unauthenticated":
      return { kind: "sign-in" };
    case "programme-paused":
      return { field: null, message: "Returns are paused just now. Nothing you typed is lost — try again shortly." };
    case "rate-limited":
      return { field: null, message: "That is a few requests in a short time. Give it a few minutes and try again." };
    case "invalid":
      return { field: null, message: "Something in the form was not accepted. Check the fields and try again." };
    case "failed":
      return { field: null, message: "The request could not be sent. Check your connection and try again." };
  }
}

export interface ReturnFormProps {
  program: RewardsProgram;
  areas: ServiceArea[];
  /** Task 10's modal passes this to close itself. Fired only from the
   *  confirmation's own "Done" control, never automatically on success — see
   *  the file header. The page passes nothing, and its confirmation simply
   *  stays on screen. */
  onDone?: () => void;
  className?: string;
}

export function ReturnForm({ program, areas, onDone, className }: ReturnFormProps) {
  const [qty, setQty] = React.useState(String(program.minUnitsPerReturn));
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [pickupAddress, setPickupAddress] = React.useState("");
  const [serviceAreaId, setServiceAreaId] = React.useState("");

  const [sending, setSending] = React.useState(false);
  /* Client-side validation appears only after a submit attempt — reporting a
     blank required field before the shopper has reached it is the form
     arguing with them while they are still filling it in. */
  const [attempted, setAttempted] = React.useState(false);
  const [placement, setPlacement] = React.useState<Placement | null>(null);
  const [confirmation, setConfirmation] = React.useState<ReturnConfirmation | null>(null);

  /* THE TWO BLOCK-LEVEL OUTCOMES — `already-open` AND `sign-in` — CAN LAND
     ENTIRELY OFF-SCREEN, SILENTLY. Both render at the TOP of the form; submit
     is at the BOTTOM. In the dialog (a scrolling `max-h` around a ~700px
     form) that is off-screen on any phone; on `/returns` it is a full-page
     scroll. This ref plus the effect below fixes the sighted and
     screen-reader cases at once: focusing an off-screen element scrolls it
     into view, and `role="alert"` on the block itself means a screen reader
     announces it the moment it is placed, without waiting on focus at all.
     Field-level errors and the plain message above the submit button are
     deliberately UNCHANGED — see the file header on why this form never
     empties itself, and `review-form.tsx` for the same silence being the
     pre-existing house shape there. */
  const blockAlertRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (placement && "kind" in placement) {
      blockAlertRef.current?.focus();
    }
  }, [placement]);

  const uid = React.useId();
  const id = (part: string) => `${uid}-${part}`;

  const byRegion = React.useMemo(() => {
    const grouped = new Map<string, ServiceArea[]>();
    for (const area of areas) {
      const list = grouped.get(area.region);
      if (list) list.push(area);
      else grouped.set(area.region, [area]);
    }
    return grouped;
  }, [areas]);

  /** No district can be chosen at all. Task 9's brief calls for the select
   *  itself to render `disabled` here; a "choose a district" nag beside a
   *  control nobody can fill in is a dead end, so submit is disabled too
   *  rather than letting a shopper reach a guaranteed generic API refusal. */
  const noAreas = areas.length === 0;

  const qtyNumber = Number(qty);
  const problems = {
    qtyDeclared: belowMinimum(qtyNumber, program)
      ? `We collect from ${program.minUnitsPerReturn} ${unitLabel(program.minUnitsPerReturn, program)} upwards.`
      : null,
    phone: phone.trim() ? null : "Tell us a phone number to reach you on.",
    pickupAddress: pickupAddress.trim() ? null : "Tell us where to collect from.",
    serviceAreaId: !noAreas && !serviceAreaId ? "Choose a district." : null,
  };
  const valid = Object.values(problems).every((problem) => problem === null);

  /** The message beside one field: a client-side problem once a submit has
   *  been attempted, else a server placement naming that same field — which
   *  only arises when the client thought the value was fine and the API,
   *  reading a fresher programme or a fresher service-area list, disagreed. */
  function fieldMessage(field: "qtyDeclared" | "serviceAreaId"): string | null {
    if (attempted && problems[field]) return problems[field];
    if (placement && "field" in placement && placement.field === field) return placement.message;
    return null;
  }

  /** A server placement naming this field is only correct until the shopper
   *  changes the value it complained about — otherwise "we don't collect
   *  there" keeps pointing at a district they already changed away from. */
  function clearFieldPlacement(field: "qtyDeclared" | "serviceAreaId") {
    setPlacement((current) => (current && "field" in current && current.field === field ? null : current));
  }

  const pointsForQty = Number.isFinite(qtyNumber) && qtyNumber > 0 ? qtyNumber * program.pointsPerUnit : 0;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setAttempted(true);
    setPlacement(null);
    if (!valid || sending) return;

    setSending(true);
    try {
      const result = await requestReturn({
        qtyDeclared: qtyNumber,
        phone,
        pickupAddress,
        serviceAreaId,
        name: name.trim() ? name.trim() : undefined,
      });
      setConfirmation(result);
    } catch (err) {
      setPlacement(
        err instanceof ReturnRequestError
          ? placeError(err, program)
          : { field: null, message: "The request could not be sent. Check your connection and try again." },
      );
    } finally {
      setSending(false);
    }
  }

  if (confirmation) {
    const confirmedProgram = confirmation.program;
    const confirmedPoints = confirmation.qtyDeclared * confirmedProgram.pointsPerUnit;
    return (
      <div
        role="status"
        className={cn(
          "flex items-start gap-3 rounded-lg border border-brand-line bg-brand-soft p-4",
          className,
        )}
      >
        <Check aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
        <div className="text-sm leading-6">
          <p className="font-semibold text-foreground">
            Request sent — {confirmation.qtyDeclared} {unitLabel(confirmation.qtyDeclared, confirmedProgram)} for{" "}
            {confirmedPoints} {pointsLabel(confirmedPoints, confirmedProgram)}.
          </p>
          <p className="mt-1 text-muted-foreground">
            {confirmedProgram.name} will be in touch to arrange pickup. Reference {confirmation.requestId}.
          </p>
          {/* ═══ "VIEW YOUR RETURNS", ALWAYS — NOT ONLY BESIDE "DONE" ═══
              Spec §2's whole argument for requiring a session was "every
              submitter can see their own request" — a promise this screen
              made at every OTHER outcome (the `already-open` box above links
              here too) and never once at the moment it is actually kept.
              Unconditional because the standalone `/returns` page passes no
              `onDone` and still owes this shopper the same door.
              SAFE ON THE MODAL PATH ONLY BECAUSE OF `ReturnsCta`'s route-change
              close (Important 2) — without it, a plain `<Link>` here would
              navigate the page underneath while this dialog stayed open over
              it, exactly the failure the already-open box's identical link
              had. */}
          <div className="mt-3 flex flex-wrap items-center gap-4">
            {/* The only dismissal this component offers of its own. The page
                passes no `onDone` and is happy to leave this on screen
                indefinitely. */}
            {onDone && (
              <Button type="button" variant="outline" onClick={onDone}>
                Done
              </Button>
            )}
            <Link
              href="/account/returns"
              className="font-sans text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              View your returns
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className={cn("flex flex-col gap-5", className)}>
      {placement && "kind" in placement && placement.kind === "already-open" && (
        <div
          ref={blockAlertRef}
          role="alert"
          tabIndex={-1}
          className="border-2 border-foreground bg-brand-soft px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-background"
        >
          <p className="font-sans text-sm font-semibold text-foreground">
            You already have an open return request.
          </p>
          <p className="mt-0.5 font-sans text-sm text-muted-foreground">
            Nothing here was sent again — nothing you typed is lost either.
            {placement.existingId && ` Reference ${placement.existingId}.`}
          </p>
          <Link
            href="/account/returns"
            className="mt-1.5 inline-block font-sans text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            View your returns
          </Link>
        </div>
      )}

      {placement && "kind" in placement && placement.kind === "sign-in" && (
        <div
          ref={blockAlertRef}
          role="alert"
          tabIndex={-1}
          className="border-2 border-foreground bg-brand-soft px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-background"
        >
          <p className="font-sans text-sm font-semibold text-foreground">Sign in to send this request.</p>
          <p className="mt-0.5 font-sans text-sm text-muted-foreground">
            {/* Signing in is a full navigation away from this form, so it does
                NOT preserve what was typed. Say that, rather than promise a
                preservation this branch cannot actually deliver. */}
            Your session ended. Signing in will bring you back to this page, but you will need to fill it in again.
          </p>
          <Link
            href={`/sign-in?next=${encodeURIComponent("/returns")}`}
            className="mt-1.5 inline-block font-sans text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Sign in
          </Link>
        </div>
      )}

      <Field id={id("qty")} label="How many are you returning?" required>
        <Input
          id={id("qty")}
          type="number"
          inputMode="numeric"
          min={program.minUnitsPerReturn}
          value={qty}
          aria-required="true"
          aria-invalid={fieldMessage("qtyDeclared") ? true : undefined}
          aria-describedby={describedBy(id("qty-help"), fieldMessage("qtyDeclared") && id("qty-error"))}
          onChange={(event) => {
            setQty(event.target.value);
            clearFieldPlacement("qtyDeclared");
          }}
        />
        <p id={id("qty-help")} className="mt-1.5 font-sans text-xs text-muted-foreground">
          {Math.max(qtyNumber || 0, 0)} {unitLabel(qtyNumber || 0, program)} × {program.pointsPerUnit} ={" "}
          {pointsForQty} {pointsLabel(pointsForQty, program)}
        </p>
        {fieldMessage("qtyDeclared") && (
          <p id={id("qty-error")} className="mt-1.5 font-sans text-sm text-destructive-strong">
            {fieldMessage("qtyDeclared")}
          </p>
        )}
      </Field>

      <Field id={id("name")} label="Name">
        <Input id={id("name")} value={name} maxLength={NAME_MAX} onChange={(event) => setName(event.target.value)} />
      </Field>

      <Field id={id("phone")} label="Phone" required>
        <Input
          id={id("phone")}
          type="tel"
          value={phone}
          maxLength={PHONE_MAX}
          aria-required="true"
          aria-invalid={attempted && problems.phone ? true : undefined}
          aria-describedby={describedBy(attempted && problems.phone && id("phone-error"))}
          onChange={(event) => setPhone(event.target.value)}
        />
        {attempted && problems.phone && (
          <p id={id("phone-error")} className="mt-1.5 font-sans text-sm text-destructive-strong">
            {problems.phone}
          </p>
        )}
      </Field>

      <Field id={id("address")} label="Pickup address" required>
        <Textarea
          id={id("address")}
          rows={3}
          value={pickupAddress}
          maxLength={ADDRESS_MAX}
          aria-required="true"
          aria-invalid={attempted && problems.pickupAddress ? true : undefined}
          aria-describedby={describedBy(attempted && problems.pickupAddress && id("address-error"))}
          onChange={(event) => setPickupAddress(event.target.value)}
        />
        {attempted && problems.pickupAddress && (
          <p id={id("address-error")} className="mt-1.5 font-sans text-sm text-destructive-strong">
            {problems.pickupAddress}
          </p>
        )}
      </Field>

      <Field id={id("area")} label="District" required>
        {/* NATIVE, ON PURPOSE — see the file header. `optgroup` groups by
            region without any script running, so the grouping this form's
            own test asserts on survives with JavaScript off. */}
        <select
          id={id("area")}
          value={serviceAreaId}
          disabled={noAreas}
          aria-required="true"
          aria-invalid={fieldMessage("serviceAreaId") ? true : undefined}
          aria-describedby={describedBy(
            noAreas && id("area-empty"),
            fieldMessage("serviceAreaId") && id("area-error"),
          )}
          onChange={(event) => {
            setServiceAreaId(event.target.value);
            clearFieldPlacement("serviceAreaId");
          }}
          className={NATIVE_SELECT_CLASSES}
        >
          <option value="">Choose a district</option>
          {[...byRegion.entries()].map(([region, list]) => (
            <optgroup key={region} label={region}>
              {list.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {noAreas && (
          <p id={id("area-empty")} className="mt-1.5 font-sans text-xs text-muted-foreground">
            We are not collecting anywhere yet.
          </p>
        )}
        {fieldMessage("serviceAreaId") && (
          <p id={id("area-error")} className="mt-1.5 font-sans text-sm text-destructive-strong">
            {fieldMessage("serviceAreaId")}
          </p>
        )}
      </Field>

      {placement && "field" in placement && placement.field === null && (
        <p role="alert" className="font-sans text-sm text-destructive-strong">
          {placement.message}
        </p>
      )}

      <Button type="submit" disabled={sending || noAreas} className={cn("h-12 text-base", NEO_SURFACE)}>
        {sending && <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />}
        Send return request
      </Button>
    </form>
  );
}
