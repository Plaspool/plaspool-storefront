import { Link } from "../components/link";
import { TextSkeleton, cn } from "@plaspool/ui";

/**
 * The account area's tab row — one component, two callers.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * IT IS SHARED BECAUSE THE HAND-COPIED VERSION WAS ALREADY WRONG IN BOTH
 * PLACES, IDENTICALLY, AND WAS ONLY FOUND IN ONE.
 *
 * The orders list's Ongoing/Cancelled row and the rewards page's
 * Everything/Earned/Spent row were written as two byte-identical class strings.
 * That copy carried two defects, and the geometry that exposed them exists on
 * only one of the two pages — which is exactly the shape this package's ledger
 * keeps recording: the instance fixed, the sibling left. So there is one row
 * now, and the notes below belong to it rather than to whichever caller was
 * measured.
 *
 * ═══ DEFECT 1: `first:pl-0` MATCHED EVERY TAB ═══
 * Tailwind's `first:` compiles to `:first-child`, and each tab's `<a>` is the
 * ONLY child of its own `<li>` — so every anchor is a first child and every tab
 * lost its left padding. The two tabs then butted together with nothing but the
 * first one's right padding between them, and the gap read as one control.
 * Measured at `padding-left: 0px` on both. Position is the `<li>`'s to know, so
 * the index decides it here rather than a pseudo-class guessing at the DOM.
 *
 * ═══ DEFECT 2: THE LABELS ELLIPSISED AT 320px ═══
 * "Ongoing & delivered" and "Cancelled & refunded" need 137px and 135px of text
 * at `text-sm`; 320px leaves 288px for the pair, and 24px of padding put them
 * 4px over each. `truncate` did what it was told and the tabs read "Ongoing &
 * delivere…". Shortening the labels was the other option and it is worse: the
 * whole reason both nouns are in both labels is that "Ongoing" alone is a lie
 * about the tab that also holds every delivered order.
 * So the TYPE steps down instead — `text-xs` below `sm`, `text-sm` above —
 * which this shop already does for row metadata at the same width. The label a
 * screen reader announces is identical at every width, which a
 * breakpoint-swapped label would not have been.
 *
 * `truncate` STAYS. It is now unreachable at every width this shop renders at,
 * and it is the difference between a tab that clips and a tab that wraps to two
 * lines and makes the row 20px taller than the rule under it.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ═══ LINKS IN A `<nav>`, NOT `role="tablist"` ═══
 * The ARIA tabs pattern describes panels swapped in place by script, and it
 * comes with obligations this does not meet: arrow-key roving focus, a
 * `tabpanel` with `aria-labelledby` pointing back, and `aria-selected` managed
 * on script's timing. These are ordinary navigations that change the URL — the
 * browser's own model — so they are ordinary links, and the current one is
 * marked `aria-current="page"`, which is what a screen reader announces for
 * "you are here" everywhere else in this shop.
 */
/**
 * THE TAB'S OWN BOX — its type, its vertical padding, and the border the
 * selected mark hangs on.
 *
 * `-mb-px` PULLS THE 2px UNDERLINE OVER THE ROW'S OWN HAIRLINE so the two
 * occupy one edge rather than stacking into a 3px band under the selected tab
 * only.
 *
 * Named as a constant because `TabRowSkeleton` below draws the SAME box, and a
 * placeholder that hand-rolled it would be a third copy of the geometry this
 * file exists to stop there being two of. It was exactly that once already:
 * `pb-2.5 pt-2.5` plus a fixed `h-4` bar, measuring 37px against the live
 * row's 42px.
 */
const TAB_BOX = "-mb-px block truncate border-b-2 py-2.5 font-sans text-xs sm:text-sm";

/** The row's rule. Shared for the same reason. */
const TAB_LIST = "flex border-b border-brand-line";

/** The first tab's text starts on the page's own left margin; every other one
 *  is spaced from its neighbour. Decided by POSITION IN THE LIST, never by
 *  `:first-child` — see the header. */
function tabPad(i: number): string {
  return i === 0 ? "pr-3 sm:pr-4" : "px-3 sm:px-4";
}

export interface TabItem {
  /** Stable identity, and the key. */
  key: string;
  label: string;
  href: string;
}

export function TabRow({
  label,
  items,
  current,
  className,
}: {
  /** Names the whole row for assistive tech — "Which orders", not "Tabs". */
  label: string;
  items: TabItem[];
  /** The `key` of the tab being shown. */
  current: string;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={className}>
      <ul className={TAB_LIST}>
        {items.map((item, i) => {
          const selected = item.key === current;
          return (
            <li key={item.key} className="min-w-0">
              <Link
                href={item.href}
                aria-current={selected ? "page" : undefined}
                className={cn(
                  TAB_BOX,
                  tabPad(i),
                  "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  selected
                    ? "border-brand font-semibold text-foreground"
                    : "border-transparent text-muted-foreground hover:border-brand-line hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * The row's placeholder — the SAME box, so nothing moves when the tabs arrive.
 *
 * It draws `count` tabs out of `TAB_LIST`, `TAB_BOX` and `tabPad`, which are
 * the constants the live row uses, so its height is the live row's height by
 * construction rather than by two people agreeing on a number. The bars inside
 * carry the tab's own type, for the same reason.
 */
export function TabRowSkeleton({ count = 2, className }: { count?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={className}>
      <ul className={TAB_LIST}>
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className="min-w-0">
            <div className={cn(TAB_BOX, tabPad(i), "border-transparent")}>
              <TextSkeleton
                className={cn("font-sans text-xs sm:text-sm", i === 0 ? "w-28" : "w-32")}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
