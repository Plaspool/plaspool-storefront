"use client";

import * as React from "react";
import { Input } from "@plaspool/ui";

import type { DeliveryField } from "../data/delivery-config";
import {
  NIGERIA,
  NIGERIAN_STATES,
  foldRegion,
  nigerianStateName,
} from "../data/nigerian-states";
import { NATIVE_SELECT_CLASSES } from "./address-field";

/**
 * The State field: a select of the 36 states and the FCT for a Nigerian
 * address, the free-text input it always was for anywhere else.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT IS SHOWN IS WHAT IS SENT. The select's value is the canonical state
 * name from `nigerian-states.ts`, so the district picker under it and the
 * server's zone both match it exactly — "Lagos Island" and "lagos " were two
 * of the ways the free-text field used to price an order at the wrong rate.
 * A saved address whose state matches nothing renders as "Choose a state"
 * rather than as a guess; `required` on the select then stops the form until
 * the shopper picks one.
 *
 * ═══ THE SERVED LIST IS THE SERVER'S ═══
 * When the config carries `servedRegions`, a state outside it is listed but
 * `disabled` — visible, so a shopper in Kano learns the shop does not reach
 * them BEFORE filling in the rest, and unchoosable, so the server's
 * `outside_service_region` refusal is never the way they find out. With
 * `servedRegions: null` (today) every state is open, and the server prices
 * the ones without districts at the state's zone rate.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const REGION_PLACEHOLDER = "Choose a state";

export function RegionField({
  id,
  field,
  countryCode,
  value,
  servedRegions,
  describedBy,
  onChange,
}: {
  id: string;
  field: DeliveryField;
  /** The address's country as it stands — `NIGERIA` gets the select. */
  countryCode: string;
  value: string;
  servedRegions: readonly string[] | null;
  describedBy?: string;
  onChange: (region: string) => void;
}) {
  if (countryCode.toUpperCase() !== NIGERIA) {
    return (
      <Input
        id={id}
        type="text"
        required={field.required}
        maxLength={field.maxLength}
        autoComplete={field.autocomplete}
        aria-describedby={describedBy}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  const served = servedRegions === null || servedRegions.length === 0
    ? null
    : new Set(servedRegions.map(foldRegion));
  const canonical = nigerianStateName(value) ?? "";

  return (
    <select
      id={id}
      required={field.required}
      autoComplete={field.autocomplete}
      aria-describedby={describedBy}
      value={canonical}
      onChange={(e) => onChange(e.target.value)}
      className={NATIVE_SELECT_CLASSES}
    >
      <option value="">{REGION_PLACEHOLDER}</option>
      {NIGERIAN_STATES.map((state) => {
        const open = served === null || served.has(foldRegion(state.name));
        return (
          <option key={state.code} value={state.name} disabled={!open}>
            {state.label ?? state.name}
            {open ? "" : " (not yet)"}
          </option>
        );
      })}
    </select>
  );
}
