import { DELIVERY } from "../data/config";
import { formatNaira } from "../data/money";

/**
 * One line above the nav, answering the two questions this market asks
 * first: how much before delivery is free, and how fast Lagos is.
 *
 * Not dismissible — a dismissible bar needs storage and a state machine for
 * one sentence. The threshold is read from `DELIVERY.freeOver` through
 * `formatNaira`, the same constant the cart and the product page read, so
 * the figure can only ever say one thing across the store.
 */
export function AnnouncementBar() {
  return (
    <p className="m-0 bg-brand px-4 py-2 text-center text-xs text-brand-ink">
      {"Free delivery on orders over "}
      <span className="font-mono tabular-nums">{formatNaira(DELIVERY.freeOver)}</span>
      {" · Next day in Lagos"}
    </p>
  );
}
