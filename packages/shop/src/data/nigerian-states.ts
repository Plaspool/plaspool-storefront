/**
 * The 36 states and the Federal Capital Territory, keyed by ISO 3166-2:NG.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY A LIST IS SPELLED HERE WHEN THE COUNTRY LIST NEVER WAS.
 *
 * The State field was free text, and the delivery price keys off it: the
 * server's `zoneFor()` and the public areas list both match the region by
 * name, case-folded. A shopper who typed "Lagos Island" priced at the
 * catch-all rate and never saw the district picker; one who typed "lagos "
 * got both. A closed list is the only thing that makes the picker reliable,
 * and the states of Nigeria are a fact of geography rather than a shop
 * setting — there is nothing for the admin to configure and nothing here to
 * drift from. Which of them the shop DELIVERS TO is still the config's
 * (`servedRegions`), and `region-field.tsx` reads that, never this file.
 *
 * `name` IS THE VALUE THE ADDRESS CARRIES. It is what the areas are filed
 * under ("Federal Capital Territory", not "FCT" or "Abuja" — see the live
 * `/api/public/marketing/areas`), so a canonical name from here matches the
 * picker and the zone exactly. The code exists for the geocoders: Cloudflare's
 * `regionCode` and Nominatim's `ISO3166-2-lvl4` both speak ISO, and a code
 * match beats a name match every time.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const NIGERIA = "NG";

export interface NigerianState {
  /** ISO 3166-2:NG, without the `NG-` prefix. */
  code: string;
  /** What the address carries, and what the areas list files under. */
  name: string;
  /** What the option says when the name alone would not place it. */
  label?: string;
  /** Other spellings a saved address, a shopper or a geocoder may use. All
   *  compared after `foldRegion()`. */
  aliases?: readonly string[];
}

export const NIGERIAN_STATES: readonly NigerianState[] = Object.freeze([
  { code: "AB", name: "Abia" },
  { code: "AD", name: "Adamawa" },
  { code: "AK", name: "Akwa Ibom" },
  { code: "AN", name: "Anambra" },
  { code: "BA", name: "Bauchi" },
  { code: "BY", name: "Bayelsa" },
  { code: "BE", name: "Benue" },
  { code: "BO", name: "Borno" },
  { code: "CR", name: "Cross River" },
  { code: "DE", name: "Delta" },
  { code: "EB", name: "Ebonyi" },
  { code: "ED", name: "Edo" },
  { code: "EK", name: "Ekiti" },
  { code: "EN", name: "Enugu" },
  {
    code: "FC",
    name: "Federal Capital Territory",
    label: "Federal Capital Territory (Abuja)",
    aliases: [
      "FCT",
      "Abuja",
      "Abuja FCT",
      "FCT Abuja",
      "Abuja Federal Capital Territory",
      "Abuja Municipal",
    ],
  },
  { code: "GO", name: "Gombe" },
  { code: "IM", name: "Imo" },
  { code: "JI", name: "Jigawa" },
  { code: "KD", name: "Kaduna" },
  { code: "KN", name: "Kano" },
  { code: "KT", name: "Katsina" },
  { code: "KE", name: "Kebbi" },
  { code: "KO", name: "Kogi" },
  { code: "KW", name: "Kwara" },
  { code: "LA", name: "Lagos" },
  { code: "NA", name: "Nasarawa", aliases: ["Nassarawa"] },
  { code: "NI", name: "Niger" },
  { code: "OG", name: "Ogun" },
  { code: "ON", name: "Ondo" },
  { code: "OS", name: "Osun" },
  { code: "OY", name: "Oyo" },
  { code: "PL", name: "Plateau" },
  { code: "RI", name: "Rivers" },
  { code: "SO", name: "Sokoto" },
  { code: "TA", name: "Taraba" },
  { code: "YO", name: "Yobe" },
  { code: "ZA", name: "Zamfara" },
]);

/** Lowercase, punctuation and runs of space collapsed, a trailing "state"
 *  dropped: "Akwa-Ibom State" and "akwa ibom" are the same state. */
export function foldRegion(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+state$/, "")
    .trim();
}

const CODE = /^(?:NG-)?([A-Z]{2})$/i;

/**
 * The state a value names, or null.
 *
 * IN ORDER OF HOW MUCH THE INPUT CAN BE TRUSTED: an ISO code (with or without
 * the `NG-` prefix), an exact name or alias, then a name or alias the input
 * merely STARTS with — "Lagos Island", "Abuja Municipal", "Kano Municipal"
 * are local government areas a shopper reasonably writes in a State box, and
 * the state is the first word. The prefix has to end on a word boundary so
 * "Ogun" never claims "Ogunpa".
 *
 * NULL IS AN HONEST ANSWER. A select cannot show what it cannot match, so a
 * saved "Port Harcourt" renders as "Choose a state" and the shopper picks
 * Rivers — better than guessing, because the guess sets the delivery price.
 */
export function matchNigerianState(value: string | null | undefined): NigerianState | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;

  const code = CODE.exec(raw)?.[1]?.toUpperCase();
  if (code) return NIGERIAN_STATES.find((state) => state.code === code) ?? null;

  const key = foldRegion(raw);
  if (!key) return null;

  const namesOf = (state: NigerianState) =>
    [state.name, ...(state.aliases ?? [])].map(foldRegion);

  const exact = NIGERIAN_STATES.find((state) => namesOf(state).includes(key));
  if (exact) return exact;

  return (
    NIGERIAN_STATES.find((state) =>
      namesOf(state).some((name) => key.startsWith(`${name} `)),
    ) ?? null
  );
}

/** The canonical name for whatever was typed, or null when nothing matched. */
export function nigerianStateName(value: string | null | undefined): string | null {
  return matchNigerianState(value)?.name ?? null;
}
