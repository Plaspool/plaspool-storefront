/**
 * How a cart line names the variant it holds.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ONE PLACE, BECAUSE A LINE IS NAMED FOUR TIMES AND A SIZE CAN BE ABSENT.
 *
 * The drawer and the cart page each render the variant twice — once visibly
 * and once as the accessible name of a quantity stepper — and all four used
 * `${colour} · ${size.label}` directly. That is fine while every product has
 * a weight, and it is why this exists now that one does not: `sizeLabelOf`
 * leaves the label empty when the catalogue records no weight, and the naive
 * join renders `Black · ` with a separator pointing at nothing.
 *
 * Joining only the parts that exist keeps a sizeless line reading as `Black`
 * rather than as a line with something missing off the end.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** What the shopper sees under the product name: `Black · 1kg`, or `Black`. */
export function variantDescriptor(colourName: string, sizeLabel: string): string {
  return [colourName, sizeLabel].filter(Boolean).join(" · ");
}

/**
 * The accessible name of a control acting on one line.
 *
 * COMMAS RATHER THAN THE MIDDLE DOT, because this is read aloud: a screen
 * reader announcing "Black middot 1kg" is worse than a pause.
 */
export function lineDescriptor(
  productName: string,
  colourName: string,
  sizeLabel: string,
): string {
  return [productName, colourName, sizeLabel].filter(Boolean).join(", ");
}
