import { COMMERCE_API_BASE, MARKETING_REVALIDATE } from "./config";
import { formatNaira } from "./money";

/**
 * The marketing client — banners and the rewards programme.
 *
 * Two endpoints, both public reads, both already live:
 *
 *   GET /api/public/marketing/banners?placement=top_bar|popup|section
 *   GET /api/public/marketing/rewards
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * EVERY WORD OF THE PROGRAMME COMES FROM THE API, AND THAT IS A RULE RATHER
 * THAN A PREFERENCE.
 *
 * The admin lets an operator rename the programme and its units — "Spool
 * Points", "spools" — and it enforces on its own side that no screen spells
 * them itself (`server/marketing/no-hardcoded-labels.test.ts`). A storefront
 * that hardcoded "Spool Points" would be the one surface that kept the old name
 * after a rename, which is worse than having no name: the store and the returns
 * desk would be describing different programmes to the same customer.
 *
 * So nothing in `packages/shop` may spell a points or unit noun. If the
 * programme is absent, the section renders nothing.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * NEITHER READ THROWS. The same rule the catalogue and reviews clients follow: a
 * marketing service having a bad day must not take a shop page down with it. A
 * missing banner is an absent line; a missing programme is an absent section.
 */

/** Where a banner is meant to appear. The API's own vocabulary. */
export type BannerPlacement = "top_bar" | "popup" | "section";

/**
 * What the storefront gets — already filtered by status and schedule.
 *
 * The API deliberately does NOT send `status`, `revision` or the window: those
 * are what it decided visibility with, and shipping them would invite this
 * client to re-implement the decision and get a third opinion into it. A banner
 * that arrives here is a banner that should be shown.
 */
export interface PublicBanner {
  id: string;
  title: string;
  body: string;
  ctaText: string | null;
  ctaUrl: string | null;
  placement: BannerPlacement;
  /** Higher wins where a placement can only show one. */
  priority: number;
}

/**
 * The rewards programme, in the operator's words.
 *
 * Singular and plural are separate fields because the API refuses to guess a
 * plural — "spool"/"spools" is easy and the next unit may not be.
 */
export interface RewardsProgram {
  name: string;
  pointsLabelSingular: string;
  pointsLabelPlural: string;
  unitLabelSingular: string;
  unitLabelPlural: string;
  /** The smallest return that earns anything. */
  minUnitsPerReturn: number;
  pointsPerUnit: number;
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${COMMERCE_API_BASE}${path}`, {
      next: { revalidate: MARKETING_REVALIDATE },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Live banners for one placement, highest priority first.
 *
 * FILTERED SERVER-SIDE by `?placement=`, not here. The endpoint takes the
 * parameter, and asking for every banner in order to discard most of them would
 * make a top-bar render pay for the popups.
 */
export async function listBanners(placement: BannerPlacement): Promise<PublicBanner[]> {
  const body = await getJson<{ banners: PublicBanner[] }>(
    `/api/public/marketing/banners?placement=${placement}`,
  );
  const banners = body?.banners ?? [];
  return [...banners].sort((a, b) => b.priority - a.priority);
}

/** The programme, or null when none is configured. */
export async function getRewardsProgram(): Promise<RewardsProgram | null> {
  const body = await getJson<{ program: RewardsProgram | null }>(
    "/api/public/marketing/rewards",
  );
  return body?.program ?? null;
}

/**
 * `10` and a plural label → `"10 Spool Points"`; `1` → the singular.
 *
 * Here rather than in a component because three surfaces need the same
 * agreement between a number and its noun, and because the choice of which
 * label to use is the one piece of logic the API cannot do for us — it sends
 * both and leaves the count to the caller.
 */
export function pointsLabel(count: number, program: RewardsProgram): string {
  return count === 1 ? program.pointsLabelSingular : program.pointsLabelPlural;
}

export function unitLabel(count: number, program: RewardsProgram): string {
  return count === 1 ? program.unitLabelSingular : program.unitLabelPlural;
}

/**
 * What ONE point is worth against an order, in whole naira.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE ONE FIGURE IN THIS MODULE THAT IS SPELLED RATHER THAN READ, AND IT IS
 * NOT A LAPSE.
 *
 * `GET /api/public/marketing/rewards` sends the programme's nouns, its
 * `pointsPerUnit` and its `minUnitsPerReturn` — and nothing at all about what
 * a point redeems for. There is no field to read, so the number lives here
 * ONCE rather than in each screen that quotes it. Two surfaces quote it today
 * (the return dialog's first step and the landing page's card); a second
 * spelling is how they end up disagreeing about the price of a point.
 *
 * WHEN THE ADMIN GROWS THE FIELD, DELETE THIS. It becomes `pointValueNaira` on
 * `RewardsProgram` and every call site below changes with it — the rule the
 * rest of this file already keeps.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export const POINT_VALUE_NAIRA = 100;

/** `"₦100"` — one point's worth, in the shop's own money format. */
export function pointValue(): string {
  return formatNaira(POINT_VALUE_NAIRA);
}

/**
 * `"1 Spool Point"` — the left-hand side of the value equation both surfaces
 * draw. Singular by construction: the equation is always priced per point.
 */
export function onePointLabel(program: RewardsProgram): string {
  return `1 ${program.pointsLabelSingular}`;
}

/**
 * The programme's own announcement, in two sentences.
 *
 * ═══ HERE, NOT IN A COMPONENT, BECAUSE TWO COMPONENTS SAY IT ═══
 * It was written for the return dialog and lived in `return-intro.tsx`. The
 * landing page's card now makes the same offer, and a marketing sentence typed
 * out twice is the exact shape of defect `house-rules.test.ts` exists to catch:
 * the instance edited, the sibling left behind, the two screens promising
 * different things about one programme.
 *
 * Each sentence is returned as ONE whole string rather than as JSX fragments,
 * which is the property `return-intro.test.tsx` depends on — a sentence
 * assembled from interpolated children is one a suite can only assert on in
 * pieces.
 *
 * NOT ONE PROGRAMME NOUN IS SPELLED IN EITHER, and `pointsLabel()` is what
 * keeps the count agreeing with its noun: the live programme pays ONE point
 * per unit, so a plural-only sentence would read "1 Spool Points" in
 * production.
 */
export function programOpening(program: RewardsProgram): string {
  return `Your ${program.unitLabelSingular} doesn't have to become waste when the filament runs out.`;
}

export function programOffer(program: RewardsProgram): string {
  const earned = `${program.pointsPerUnit} ${pointsLabel(program.pointsPerUnit, program)}`;
  return (
    `Return your empty filament ${program.unitLabelPlural} to PlaSpool and earn ${earned} ` +
    `for every eligible ${program.unitLabelSingular}. Save them up and use your ` +
    `${program.pointsLabelPlural} towards your next PlaSpool order.`
  );
}
