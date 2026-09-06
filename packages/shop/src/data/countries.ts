/**
 * Every country a shopper could name, and what to call it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE CODES ARE SPELLED HERE; THE NAMES NEVER ARE; WHICH ONES THE SHOP SHIPS
 * TO IS STILL THE SERVER'S.
 *
 * `checkout-flow.tsx` used to render the country as fixed text, on the rule
 * that a hardcoded country list "is a second, stale answer to a question the
 * delivery config already answers". That rule was about the SERVED list, and
 * it still holds: `config.country.allowed` alone decides where a parcel may
 * go, and `country-field.tsx` refuses to submit anywhere else. What this file
 * holds is the other list — ISO 3166-1, every assigned alpha-2 code — which
 * no config answers and which changes about once a decade. A shopper picking
 * their country from a list is what every other checkout does, and it is what
 * lets the IP hint and the GPS fill land on a real value rather than on text.
 *
 * NAMES COME FROM `Intl.DisplayNames`, NEVER A TABLE. A table drifts in a
 * different way from the codes — "Turkey" for "Türkiye", "Swaziland" for
 * "Eswatini" — and the runtime already carries the current CLDR names. Where
 * the runtime lacks them the code itself is shown, which is terse but never
 * wrong. `countries.test.ts` checks the runtime knows every code here, so a
 * typo in this list cannot ship as a two-letter option.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** ISO 3166-1 alpha-2, every assigned code, in code order. */
export const COUNTRY_CODES: readonly string[] = Object.freeze(
  (
    "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ " +
    "BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ " +
    "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ " +
    "DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR " +
    "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY " +
    "HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP " +
    "KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY " +
    "MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ " +
    "NA NC NE NF NG NI NL NO NP NR NU NZ OM " +
    "PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW " +
    "SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ " +
    "TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ " +
    "VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW"
  ).split(" "),
);

/**
 * An ISO-3166-1 alpha-2 code as a name.
 *
 * WRAPPED, because `Intl.DisplayNames` is absent on some small-ICU builds and
 * throws for a malformed code on others. The code itself is the fallback —
 * a bare "GB" beside a country selector is understandable.
 */
export function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export interface CountryOption {
  code: string;
  name: string;
}

let sorted: readonly CountryOption[] | null = null;

/**
 * Every country, named and sorted by name — computed once per runtime.
 *
 * ONCE PER RUNTIME, NOT AT MODULE LOAD: the names depend on the runtime's
 * ICU, and the sort on the names, so this is a function rather than a
 * constant. The caller renders it only after hydration for the same reason —
 * see `country-field.tsx`.
 */
export function allCountries(): readonly CountryOption[] {
  if (!sorted) {
    sorted = Object.freeze(
      COUNTRY_CODES.map((code) => ({ code, name: countryName(code) })).sort((a, b) =>
        a.name.localeCompare(b.name, "en"),
      ),
    );
  }
  return sorted;
}

/** Whether a value is a code this list knows, after uppercasing. */
export function isCountryCode(value: string | null | undefined): value is string {
  return typeof value === "string" && COUNTRY_CODES.includes(value.toUpperCase());
}
