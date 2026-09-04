"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

import { Button, cn } from "@plaspool/ui";

import { createCart } from "../data/cart-api";
import {
  isSwitchable,
  type CurrencyCode,
  type CurrencyConfig,
} from "../data/currency-config";
import { resolveCurrency, storeCurrency, storedCurrency } from "../data/currency-preference";
import { currencyFromPathname, currencyHref, canonicalPath } from "../data/currency-routing";
import { symbolFor } from "../data/format-money";

/**
 * The currency control, in the site header and nowhere else.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * IT IS IN THE HEADER BECAUSE A CART'S CURRENCY IS WRITTEN ONCE, AT CREATION.
 *
 * `POST /cart` sets the currency and NOTHING updates it afterwards — order
 * totals freeze against it. So the choice has to be made before the first item
 * is added, which means it belongs somewhere present on every page rather than
 * on the one screen a shopper reaches last. There is deliberately no currency
 * control at checkout: by then the question has been answered and cannot be
 * reopened, and offering it would be a control that either lies or throws the
 * basket away.
 *
 * ═══ IT RENDERS NOTHING UNLESS THE SERVER OFFERS A CHOICE ═══
 * `isSwitchable` is false whenever the config lists one currency, which is
 * every deploy until an operator enables dollars — and the admin will not let
 * them until Paystack has approved USD and a Zenith domiciliary account is
 * attached. A disabled control or a one-option dropdown would announce a
 * feature the shop does not have; a shopper who picked USD before Paystack
 * agreed would dead-end at "Currency not supported by merchant" with nothing
 * to click. So this returns null, and shipping it changes nothing.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface CurrencySwitcherProps {
  config: CurrencyConfig;
  className?: string;
}

/** What switching costs when the basket is not empty, and the shopper's answer
 *  to it. `pending` is the currency they asked for and have not yet agreed to
 *  pay for. */
type Prompt = { pending: CurrencyCode } | null;

export function CurrencySwitcher({ config, className }: CurrencySwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();

  /* ═══ THE URL IS THE TRUTH, THE COOKIE IS ONLY THE MEMORY ═══
     Which currency this page is PRICED in was decided when it was rendered, and
     it is written in the path. Reading the cookie to decide what to highlight
     would let the two disagree — a shopper on `/store` with a stale USD cookie
     would see USD selected above naira prices. The cookie's job is to answer
     "where should they land next time", which is `resolveCurrency` below, not
     "what are they looking at now". */
  const active = currencyFromPathname(pathname) ?? config.default;

  const [prompt, setPrompt] = React.useState<Prompt>(null);
  const [busy, setBusy] = React.useState(false);

  /* ═══ THE COOKIE IS RECONCILED TO THE PAGE, NOT THE OTHER WAY ROUND ═══
     A shopper who lands on `/usd/store` from a shared link has chosen dollars
     by arriving; a stored `NGN` would otherwise send them back to naira on
     their next visit for no reason they could see. Also self-heals the case
     the config's own rule creates: a stored USD after an operator switches
     dollars off resolves back to the default and is rewritten as such. */
  React.useEffect(() => {
    if (resolveCurrency(storedCurrency(), config) !== active) storeCurrency(active);
  }, [active, config]);

  if (!isSwitchable(config)) return null;

  /** Where this page lives in another currency's tree. */
  const destinationFor = (code: CurrencyCode) => currencyHref(canonicalPath(pathname), code);

  async function choose(code: CurrencyCode, replace = false) {
    if (code === active || busy) return;
    setBusy(true);
    try {
      /* ═══ THE COOKIE IS WRITTEN BEFORE THE NAVIGATION, ALWAYS ═══
         Even if the cart call below refuses. The preference is what to QUOTE,
         and the cart's own currency is a separate, server-owned fact — a
         shopper who asked for dollars should keep being shown dollars whether
         or not they agreed to empty a basket. */
      storeCurrency(code);

      const result = await createCart(code, replace);

      if (!result.ok && result.reason === "currency_locked") {
        /* THE ONE REFUSAL WITH A QUESTION ATTACHED. The basket has lines in
           another currency and the cart's currency cannot be changed, so the
           only way through is a new cart — which discards them. Asked, never
           assumed: `replace` is not retried automatically anywhere. */
        setPrompt({ pending: code });
        return;
      }

      /* Every other outcome navigates. A success is the happy path; an
         `offline` or `refused` is a cart call that failed for reasons that
         have nothing to do with which prices the shopper is reading, and
         holding them on the wrong currency because the cart service is having
         a bad minute would be the wrong trade. The cart keeps whatever
         currency it already had, which is the server's call to make. */
      setPrompt(null);
      router.push(destinationFor(code));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* `radiogroup`, not a set of links: these are two states of one setting,
          and a screen reader should hear "Currency, NGN selected, 1 of 2"
          rather than two unrelated destinations. */}
      <div
        role="radiogroup"
        aria-label="Currency"
        className={cn("flex items-center rounded-md border border-brand-line", className)}
      >
        {config.currencies.map((code) => {
          const selected = code === active;
          return (
            <button
              key={code}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={busy}
              onClick={() => void choose(code)}
              className={cn(
                "px-2 py-1 font-mono text-xs tabular-nums transition-colors first:rounded-l-[5px] last:rounded-r-[5px]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                "disabled:opacity-60 motion-reduce:transition-none",
                selected
                  ? "bg-brand text-brand-ink"
                  : "text-muted-foreground hover:bg-brand-soft hover:text-brand",
              )}
            >
              {/* The symbol AND the code. The symbol alone is the thing a
                  shopper scans for; the code is what disambiguates it, and
                  `$` is not unique to one currency in the world even if it is
                  in this shop. */}
              <span aria-hidden="true">{symbolFor(code)}</span> {code}
            </button>
          );
        })}
      </div>

      {prompt && (
        <SwitchWarning
          to={prompt.pending}
          busy={busy}
          onCancel={() => setPrompt(null)}
          onConfirm={() => void choose(prompt.pending, true)}
        />
      )}
    </>
  );
}

/**
 * "Switching empties your basket" — asked before it happens, never after.
 *
 * ═══ WHY THIS IS A REAL DIALOG AND NOT A TOAST ═══
 * It is destructive and irreversible: the lines are gone and the shopper
 * re-adds them by hand. A notification that reports what already happened
 * would be telling somebody about a decision made on their behalf.
 *
 * ESCAPE AND THE BACKDROP BOTH CANCEL, because cancelling is the safe action
 * and the safe action should be the easy one. There is no way to confirm by
 * accident: the only control that empties the basket is the one labelled with
 * what it does.
 */
function SwitchWarning({
  to,
  busy,
  onCancel,
  onConfirm,
}: {
  to: CurrencyCode;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const headingId = React.useId();
  const bodyId = React.useId();

  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-describedby={bodyId}
        /* The overlay closes on click; the panel must not, or every click
           inside the dialog would dismiss it. */
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm border-2 border-foreground bg-background p-5"
      >
        <h2 id={headingId} className="text-base font-semibold text-foreground">
          Switching to {to} empties your basket
        </h2>
        <p id={bodyId} className="mt-2 text-sm leading-6 text-muted-foreground">
          {`A basket is priced in one currency for its whole life, so we have to start a
            new one to show you ${to} prices. What is in it now will be removed — nothing
            has been ordered, and you can add the items again.`}
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <Button
            type="button"
            tone="primary"
            disabled={busy}
            onClick={onConfirm}
            className="sm:flex-1"
          >
            {`Empty basket and use ${to}`}
          </Button>
          <Button
            type="button"
            tone="default"
            disabled={busy}
            onClick={onCancel}
            className="sm:flex-1"
          >
            Keep my basket
          </Button>
        </div>
      </div>
    </div>
  );
}
