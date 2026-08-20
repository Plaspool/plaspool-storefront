import type { Badge } from "./types";

/**
 * Which badge a product wears, when it qualifies for more than one.
 *
 * ═══ ONE BADGE, NOT A STACK ═══
 * `badgesFrom` derives every badge a product QUALIFIES for, and it should keep
 * doing so — "new" and "running out" are two independent facts about a product
 * and a filter or a sort may want either. What a CARD may show is a different
 * question, and the answer is one.
 *
 * A card that stacked "New" over "Low stock" put two competing instructions in
 * the same corner of the same tile: one says *this just arrived*, the other
 * says *decide now*. The shopper resolves that by reading both and acting on
 * neither, and the stack also pushes down into the photograph it sits over.
 *
 * ═══ WHY SCARCITY OUTRANKS NOVELTY ═══
 * "Low stock" is the only badge here that can stop being true while the
 * shopper is looking at it, and the only one whose absence costs them
 * something — a colour sold out between the grid and the buy box. "New" is
 * context; it will still be true tomorrow, and the product page repeats it.
 * So the more perishable fact wins the one slot.
 */
const PRIORITY: Badge[] = ["Low stock", "New", "Bulk sale"];

/**
 * The single badge to render, or `null` when the product has earned none.
 *
 * Order in `badges` is ignored on purpose: the answer must not depend on the
 * order `badgesFrom` happened to push them in.
 */
export function primaryBadge(badges: Badge[]): Badge | null {
  return PRIORITY.find((badge) => badges.includes(badge)) ?? null;
}
