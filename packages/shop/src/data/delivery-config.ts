import { COMMERCE_API_BASE } from "./config";

/**
 * The delivery config — the server's description of the address form.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE FORM IS NOT SPELLED IN THIS REPO ANY MORE. The shop can be switched
 * between asking for a district and simply taking a typed address, and the
 * switch lives in the admin. So the storefront renders what
 * `GET /api/public/shop/delivery-config` describes rather than what a
 * component hardcodes — the same rule `marketing.ts` follows for the rewards
 * programme's nouns, and for the same reason: two surfaces disagreeing about
 * what the shop asks for is worse than either answer.
 *
 * COOKIELESS AND SHARED-CACHED. Every shopper gets the same answer, the
 * response is `s-maxage=60`, and nothing per-viewer may ever go into it — so
 * this client sends no credentials. `cache: "no-store"` keeps the BROWSER from
 * holding its own private copy across a session; the CDN's 60s copy is still
 * what answers, which is the point.
 *
 * NOTHING HERE THROWS. A config that fails to arrive is not a checkout that
 * fails to render: it falls back to `DISTRICT_FALLBACK`, which is today's
 * form. §5.8 — failing toward the RICHER form is safe, because the district
 * form asks for a superset of what simple mode asks for. Failing toward the
 * simpler one would drop a field the server may want.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** How the shop asks for an address. `district` is the default and is what
 *  the shop did before this config existed. */
export type AddressMode = "district" | "simple";

/**
 * The address fields this storefront knows how to render.
 *
 * A CLOSED UNION ON PURPOSE, and the parser drops anything outside it (§5.6).
 * New keys will be added server-side before this build ships them, and an old
 * storefront that rendered an unknown key would have no input type, no
 * validation and no place in the payload for it.
 */
export type FieldKey =
  | "name"
  | "phone"
  | "region"
  | "district"
  | "city"
  | "line1"
  | "line2"
  | "postalCode";

const FIELD_KEYS: readonly FieldKey[] = [
  "name",
  "phone",
  "region",
  "district",
  "city",
  "line1",
  "line2",
  "postalCode",
];

export interface DeliveryField {
  key: FieldKey;
  show: boolean;
  required: boolean;
  /** Empty only where `show` is false — a hidden field carries no label on
   *  the wire, and none is ever rendered. */
  label: string;
  /** The server's own zod limit. It 400s past this, so the input enforces it
   *  too rather than letting the shopper type into a refusal. */
  maxLength?: number;
  autocomplete?: string;
  help?: string;
  /** `"areas"` means the options come from the public service-areas list
   *  rather than being typed. Only ever set on `district`. */
  source?: "areas";
}

export interface DistrictsConfig {
  source: string;
  groupBy: string;
  help?: string;
  unlistedMessage?: string;
}

export interface LocationConfig {
  /** THE FEATURE FLAG FOR THE WIRE SHAPE (§8). `AddressesBody` is `.strict()`,
   *  so a server that has not shipped the `location` field 400s on it — and a
   *  server old enough to do that is also old enough never to say `true`
   *  here. The storefront sends `location` if and only if this is true. */
  offer: boolean;
  required: boolean;
  label?: string;
  help?: string;
  /** Past this, the reading is kept but described to the shopper as rough. */
  maxAccuracyMeters?: number;
  /** Always false today, and it is on the wire so nobody wires pricing to a
   *  coordinate by accident — there is no geographic data in this system. */
  pricing: boolean;
}

export interface DeliveryConfig {
  mode: AddressMode;
  revision: number;
  country: { default: string; allowed: string[]; locked: boolean };
  fields: DeliveryField[];
  districts: DistrictsConfig | null;
  location: LocationConfig;
  /** When non-null, the states the shop will deliver to at all. */
  servedRegions: string[] | null;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TODAY'S FORM, FIELD FOR FIELD — and this constant is the reason the switch
 * can be off without a shopper noticing anything.
 *
 * It is NOT the example payload in the design document. That document's
 * `mode: "district"` example differs from this storefront in the field order
 * and in every label ("Street address" for what is on screen as "Address",
 * "Area" for "District", a REQUIRED district picker where this one is
 * optional, a hidden postcode where this one is shown). The document's own
 * rule is that the off-config reproduces the current form verbatim, so the
 * current form is what this encodes; the example is only illustrative of the
 * envelope, as it says of itself.
 *
 * Read it against `checkout-flow.tsx`'s address step before changing a word.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export const DISTRICT_FALLBACK: DeliveryConfig = deepFreeze({
  mode: "district",
  revision: 0,
  country: { default: "NG", allowed: ["NG"], locked: true },
  fields: [
    { key: "name", show: true, required: true, label: "Full name", maxLength: 200, autocomplete: "name" },
    { key: "phone", show: true, required: false, label: "Phone", maxLength: 40, autocomplete: "tel" },
    { key: "line1", show: true, required: true, label: "Address", maxLength: 200, autocomplete: "address-line1" },
    {
      key: "line2",
      show: true,
      required: false,
      label: "Apartment, suite, etc.",
      maxLength: 200,
      autocomplete: "address-line2",
    },
    { key: "city", show: true, required: true, label: "City", maxLength: 120, autocomplete: "address-level2" },
    { key: "region", show: true, required: true, label: "State", maxLength: 120, autocomplete: "address-level1" },
    /* OPTIONAL, and the picker is additionally hidden when the typed State has
       no served areas — see `visibleFields()`. A required picker that can have
       no options is the dead control the address step must never become. */
    { key: "district", show: true, required: false, label: "District", maxLength: 120, source: "areas" },
    {
      key: "postalCode",
      show: true,
      required: false,
      label: "Postal code",
      maxLength: 40,
      autocomplete: "postal-code",
    },
  ],
  districts: { source: "/api/public/marketing/areas", groupBy: "region" },
  location: { offer: false, required: false, pricing: false },
  servedRegions: null,
});

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const str = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const bool = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

const num = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

function parseField(raw: unknown): DeliveryField | null {
  if (!isRecord(raw)) return null;

  const key = raw.key;
  // §5.6 — an unknown field is SKIPPED, not rendered and not a failure. This
  // is what lets the server add a field before this build knows about it.
  if (typeof key !== "string" || !FIELD_KEYS.includes(key as FieldKey)) return null;

  const show = bool(raw.show, false);
  const label = str(raw.label);
  // A shown field with no label is not renderable — an unlabelled input is
  // worse than an absent one. Hidden fields legitimately carry no label.
  if (show && !label) return null;

  const field: DeliveryField = {
    key: key as FieldKey,
    show,
    required: bool(raw.required, false),
    label: label ?? "",
  };

  const maxLength = num(raw.maxLength);
  if (maxLength !== undefined) field.maxLength = maxLength;
  const autocomplete = str(raw.autocomplete);
  if (autocomplete) field.autocomplete = autocomplete;
  const help = str(raw.help);
  if (help) field.help = help;
  if (raw.source === "areas") field.source = "areas";

  return field;
}

function parseLocation(raw: unknown): LocationConfig {
  if (!isRecord(raw)) return { offer: false, required: false, pricing: false };

  const location: LocationConfig = {
    offer: bool(raw.offer, false),
    required: bool(raw.required, false),
    pricing: bool(raw.pricing, false),
  };
  const label = str(raw.label);
  if (label) location.label = label;
  const help = str(raw.help);
  if (help) location.help = help;
  const maxAccuracyMeters = num(raw.maxAccuracyMeters);
  if (maxAccuracyMeters !== undefined) location.maxAccuracyMeters = maxAccuracyMeters;

  return location;
}

function parseDistricts(raw: unknown): DistrictsConfig | null {
  if (!isRecord(raw)) return null;
  const source = str(raw.source);
  if (!source) return null;

  const districts: DistrictsConfig = { source, groupBy: str(raw.groupBy) ?? "region" };
  const help = str(raw.help);
  if (help) districts.help = help;
  const unlistedMessage = str(raw.unlistedMessage);
  if (unlistedMessage) districts.unlistedMessage = unlistedMessage;

  return districts;
}

function parseCountry(raw: unknown): DeliveryConfig["country"] {
  if (!isRecord(raw)) return DISTRICT_FALLBACK.country;
  const allowed = Array.isArray(raw.allowed)
    ? raw.allowed.filter((c): c is string => typeof c === "string").map((c) => c.toUpperCase())
    : [];
  return {
    /* UPPERCASED HERE, ONCE. §5.4 — the server regex-refuses anything that is
       not two uppercase letters, and a lowercase code would fall into the
       catch-all zone and price wrong rather than erroring. */
    default: (str(raw.default) ?? DISTRICT_FALLBACK.country.default).toUpperCase(),
    allowed: allowed.length > 0 ? allowed : [...DISTRICT_FALLBACK.country.allowed],
    locked: bool(raw.locked, true),
  };
}

/**
 * A response body into a config this storefront can render, or today's form.
 *
 * DEFENSIVE THE WHOLE WAY DOWN, because the alternative to a fallback here is
 * a checkout that cannot ask for an address. Unknown fields are dropped,
 * unknown top-level keys are ignored by construction, and anything that is not
 * recognisably a config at all becomes `DISTRICT_FALLBACK`.
 */
export function parseDeliveryConfig(raw: unknown): DeliveryConfig {
  if (!isRecord(raw)) return DISTRICT_FALLBACK;

  const body = isRecord(raw.config) ? raw.config : raw;
  const mode = body.mode;
  if (mode !== "district" && mode !== "simple") return DISTRICT_FALLBACK;
  if (!Array.isArray(body.fields)) return DISTRICT_FALLBACK;

  const fields = body.fields
    .map(parseField)
    .filter((field): field is DeliveryField => field !== null);
  if (fields.length === 0) return DISTRICT_FALLBACK;

  /* ═══ §5.3 — THE REGION IS NEVER HIDDEN ═══
     The shipping zone, and therefore the tax rate AND the delivery price, is
     derived from `countryCode` + `region`. A config that hides it is one this
     storefront cannot honour without pricing the order wrong, so it is
     refused rather than obeyed: shown anyway, and logged.

     A config with no region field AT ALL is not a repairable config — there is
     no label to render it with — so that one falls back whole. */
  const region = fields.find((field) => field.key === "region");
  if (!region) return DISTRICT_FALLBACK;
  if (!region.show) {
    console.warn(
      "[delivery-config] region.show was false; showing it anyway — the shipping zone and tax rate are derived from it.",
    );
    region.show = true;
    region.required = true;
  }

  return {
    mode,
    revision: num(body.revision) ?? 0,
    country: parseCountry(body.country),
    fields,
    districts: parseDistricts(body.districts),
    location: parseLocation(body.location),
    servedRegions: Array.isArray(body.servedRegions)
      ? body.servedRegions.filter((r): r is string => typeof r === "string")
      : null,
  };
}

/** Where the config lives. Public, cookieless, cacheable. */
export const DELIVERY_CONFIG_PATH = "/api/public/shop/delivery-config";

/**
 * The config for this checkout, or today's form.
 *
 * NEVER THROWS AND NEVER REJECTS. On `localhost` this always falls back,
 * because the commerce API sends no CORS header for that origin — which is
 * the documented local-dev condition, not a bug in the call.
 */
export async function readDeliveryConfig(): Promise<DeliveryConfig> {
  try {
    const res = await fetch(`${COMMERCE_API_BASE}${DELIVERY_CONFIG_PATH}`, {
      // No `credentials`. See the header — this response is shared-cached.
      cache: "no-store",
    });
    if (!res.ok) return DISTRICT_FALLBACK;
    return parseDeliveryConfig(await res.json());
  } catch {
    return DISTRICT_FALLBACK;
  }
}
