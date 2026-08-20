"use client";

import * as React from "react";
import { Download, X } from "lucide-react";
import { cn } from "@plaspool/ui";

/**
 * "Add PlaSpool to your home screen" — offered only when the browser has
 * actually said it will do it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE ONE RULE THIS FILE EXISTS TO KEEP: NEVER OFFER AN INSTALL NOBODY CAN
 * PERFORM.
 *
 * An install banner is unusually easy to get wrong in the direction this
 * codebase keeps getting caught by — a page asserting something it does not
 * know. The wrong version sniffs the user agent, decides "this looks like a
 * phone", and shows an Install button that does nothing on half of them. So
 * this waits for `beforeinstallprompt`, which is the BROWSER telling us, in its
 * own words, that this page is installable right now and that it has handed us
 * the prompt to fire. No event, no banner. There is no UA string anywhere in
 * this file and there must never be one.
 *
 * That event answers, at once and correctly, every question a sniffer would
 * have had to guess at: whether the platform supports installing, whether the
 * manifest and service-worker criteria are met, and whether the app is ALREADY
 * installed — Chrome simply does not fire it in any of those cases.
 *
 * ═══ THE COST, NAMED RATHER THAN HIDDEN: iOS SEES NOTHING ═══
 * Safari does not implement `beforeinstallprompt`. Installing there is Share →
 * "Add to Home Screen", which no page can trigger and no page can observe the
 * result of. The alternative was a second banner, shown by sniffing for iOS,
 * carrying instructions — and it fails the rule above twice: it cannot tell an
 * iOS visitor who has ALREADY installed the app from one who has not, so it
 * would nag the most committed shoppers on every visit, and it would be this
 * shop telling somebody what their browser's menus contain. An iOS shopper
 * loses a banner they were never going to be able to tap. That is the right
 * side to fail on, and it is a decision rather than an oversight.
 *
 * ═══ IT MOVES THE PAGE, AND THAT IS THE REAL TRADE HERE ═══
 * The banner is in the normal flow at the very top of the document, so it
 * pushes everything down when it appears — and it can only appear after
 * hydration, because the event it waits for fires after hydration. Layout
 * shift, in a codebase whose loading rule is "nothing moves when data lands".
 * Three ways out were weighed:
 *   - RESERVE THE HEIGHT ALWAYS. Every visitor on every browser pays 52px of
 *     empty bar for a banner most of them will never be shown.
 *   - FIX IT OVER THE CONTENT. No shift, but it then covers the top of the
 *     page on the one viewport where 52px is worth most, and a bar that hides
 *     content is worse than one that moves it.
 *   - LET IT OPEN. Chosen: a height transition (`TRANSITION_MS`) so the
 *     movement reads as something arriving rather than as a jolt, at the TOP of
 *     the document so everything below moves together by the same amount rather
 *     than the page reflowing internally.
 * Under `prefers-reduced-motion` the transition is dropped and it simply is
 * there — the shift is unavoidable, so the animation is what is negotiable.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** How long a dismissal lasts. 90 days is Chrome's own mini-infobar interval;
 *  matching it means a shopper who says no here is not asked again sooner than
 *  their browser would have asked them. */
const DISMISSED_DAYS = 90;
const DISMISS_KEY = "plaspool:install-dismissed";

/**
 * How long the bar takes to open and to close, in ms.
 *
 * ═══ ONE CONSTANT, BECAUSE THE CLASS AND THE TIMEOUT MUST AGREE ═══
 * This was `duration-[240ms]` in the class string and a hardcoded `240` in
 * `setTimeout`, with a comment claiming "they are a pair". They were not: the
 * arbitrary utility produced no CSS at all — no selector containing `240ms`
 * existed in the built stylesheet — so the transition ran at the 150ms that
 * `transition-[grid-template-rows]` supplies by itself, and the collapsed bar
 * then sat mounted for a further ~90ms with both of its buttons still
 * focusable at zero height.
 * `duration-200` is a CORE utility, so it cannot silently fail to compile the
 * way an arbitrary value can, and this constant is what the timeout reads. Two
 * numbers that must match are now one number.
 */
const TRANSITION_MS = 200;

/**
 * The slice of `BeforeInstallPromptEvent` this uses.
 *
 * DECLARED HERE BECAUSE THE DOM LIB DOES NOT HAVE IT — it is a Chromium
 * extension rather than a standard, which is also why every use of it below is
 * guarded. Narrow on purpose: `platforms` and the rest exist and nothing here
 * has any business reading them.
 */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function dismissedRecently(): boolean {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    /* A CORRUPT VALUE IS NOT A DISMISSAL. `Number("")` is 0 and `Number("x")` is
       NaN; both used to be truthy-adjacent traps here. An unreadable stamp means
       we do not know, and the safe answer to "do not know" is to let the banner
       decide for itself rather than to silently suppress it for ever. */
    if (!Number.isFinite(at) || at <= 0) return false;
    return Date.now() - at < DISMISSED_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    /* Private mode, or storage disabled. Not a dismissal, and not a crash. */
    return false;
  }
}

function remember(key: string) {
  try {
    window.localStorage.setItem(key, String(Date.now()));
  } catch {
    /* Nothing to do and nothing to report — the banner still closes for this
       page view, it just cannot promise to stay closed. */
  }
}

export function InstallBanner() {
  /* THE EVENT ITSELF IS THE STATE. Holding a boolean beside it was the first
     cut and it is a bug waiting to happen: the prompt is SINGLE USE — once
     `prompt()` has been called the stashed event is spent — so "we have an
     offer" and "here is the offer" have to be the same fact or the button
     eventually fires a dead event. `null` means no offer, and that is the only
     representation. */
  const [offer, setOffer] = React.useState<InstallPromptEvent | null>(null);
  /* Separate from `offer` so the bar can animate to height 0 before it leaves
     the DOM. Starting `false` also means the FIRST paint after the event is the
     collapsed one, which is what gives the transition something to travel. */
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (dismissedRecently()) return;

    const onPrompt = (event: Event) => {
      /* Stops Chrome's own mini-infobar, which is the whole point of handling
         this: two install prompts on one screen is worse than either alone.
         PREVENTED EVEN WHEN WE ARE NOT GOING TO SHOW A BAR — a shopper who
         dismissed ours should not be handed the browser's instead. */
      event.preventDefault();

      /* ═══ THE GUARD IS RE-READ HERE, NOT ONLY AT MOUNT ═══
         Chrome re-fires `beforeinstallprompt` within the same document — this
         file's own header says so — and the effect below runs once. So the
         90-day dismissal was consulted before the shopper had dismissed
         anything, and the next firing put the bar straight back on a screen
         they had just closed it on. Asking again at the moment the offer
         arrives is the only reading that can be current. */
      if (dismissedRecently()) return;
      setOffer(event as InstallPromptEvent);
      /* ═══ NEXT FRAME, NOT THIS ONE — WITH A FALLBACK THAT CANNOT BE STARVED
         ═══
         Setting both in one go batches into a single render that mounts the bar
         already open, and a transition needs the collapsed frame to have been
         painted first. `requestAnimationFrame` is the right API for "after the
         next paint" and it is the WRONG one to depend on alone: a page that is
         not compositing — a background tab, a throttled renderer, a headless
         browser — never runs it, and the bar then sits mounted at zero height
         with two focusable controls inside it and no way for anyone to open it.
         Observed exactly that: `present: true, height: 0`.
         So whichever of the two fires first opens it. A second `setOpen(true)`
         is a no-op, and `0` is a task rather than a frame, so it still lands
         after the collapsed render has been committed. */
      requestAnimationFrame(() => setOpen(true));
      window.setTimeout(() => setOpen(true), 0);
    };

    /* THE APP CAN BE INSTALLED WITHOUT THIS BANNER — from the browser's own
       menu, while the bar is on screen. `appinstalled` is how we hear about it,
       and a banner still offering to install an app the shopper has just
       installed is the page contradicting the browser. */
    const onInstalled = () => {
      setOpen(false);
      setOffer(null);
      remember(DISMISS_KEY);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const close = React.useCallback(() => {
    setOpen(false);
    remember(DISMISS_KEY);
    /* The event is dropped once the collapse has finished, so the bar is not
       left mounted at zero height with two focusable buttons in it. */
    window.setTimeout(() => setOffer(null), TRANSITION_MS);
  }, []);

  const install = React.useCallback(async () => {
    if (!offer) return;
    /* ═══ THE BAR GOES FIRST, AND THAT ORDERING IS THE FIX ═══
       This used to `await offer.prompt()` and only then clear the state — so a
       `prompt()` that REJECTS (Chrome throws `InvalidStateError` on a spent
       event, and a browser may refuse for its own reasons) skipped both
       setters. The bar stayed on screen holding a dead event, every further
       click called the spent `prompt()` again, and each one threw an unhandled
       rejection. A button that cannot do the thing it offers, on a banner whose
       first line is "never offer an install nobody can perform".
       The event is SPENT the moment `prompt()` is called, however it settles,
       so the honest UI state is "no offer" from that instant — before the
       await, not after it. */
    const prompt = offer.prompt();
    setOpen(false);
    setOffer(null);

    /* MUST HAVE BEEN CALLED INSIDE THE CLICK. `prompt()` requires a user
       gesture, and awaiting anything before it spends the gesture — which is
       why nothing above the call is asynchronous.
       A REJECTION IS NOT AN ERROR TO REPORT. The offer is gone either way and
       the shopper can still install from the browser's own menu; a red box
       about a banner they may not have wanted is worse than silence. */
    await prompt.catch(() => undefined);
    /* Accepted or dismissed, the answer changes nothing here. A dismissal at
       the BROWSER's dialog is deliberately not recorded as a dismissal of this
       banner: Chrome re-fires `beforeinstallprompt` when it judges the moment
       right, and suppressing ourselves for 90 days would override its
       judgement with ours. */
    await offer.userChoice.catch(() => undefined);
  }, [offer]);

  if (!offer) return null;

  return (
    /* `grid-rows-[0fr]` → `[1fr]` IS THE HEIGHT ANIMATION, and it is the only
       one that does not require knowing the bar's height in advance. A
       `max-height` guess would either clip the content at a narrow width — this
       wraps to two lines at 320px — or transition through empty space above it.
       `overflow-hidden` is what makes the collapsed row actually clip. */
    <div
      className={cn(
        "grid bg-brand text-brand-ink transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
      )}
    >
      <div className="overflow-hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
          <Download aria-hidden="true" className="h-5 w-5 shrink-0" />

          <p className="min-w-0 flex-1 font-sans text-xs leading-snug sm:text-sm">
            {/* WHAT IT ACTUALLY DOES, not "get the app". There is no app to get
                — this is the same site, on the home screen, and a shopper who
                expected a download from an app store has been misled by one
                word. */}
            <span className="font-semibold">Put PlaSpool on your home screen</span>
            <span className="hidden sm:inline">
              {" "}
              — opens straight to the store, no browser bar.
            </span>
          </p>

          {/* ═══ A PLAIN CONTROL, NOT THE NEOBRUTALIST ONE ═══
              That treatment is a 2px stroke and a hard offset shadow, and it
              belongs to the one thing a SCREEN wants you to do. This bar sits
              above every screen in the shop, so a raised control here would be
              competing with "Add to basket" on the page underneath it —
              permanently, and on every page. An install is worth offering and
              is never the most important thing on the page it appears over.
              `border-brand-ink` rather than a token: this bar is the one
              surface in the shop painted `bg-brand`, so its own foreground is
              the only stroke with contrast against it. */}
          <button
            type="button"
            onClick={install}
            className="shrink-0 whitespace-nowrap border border-brand-ink px-3 py-1.5 font-sans text-xs font-semibold transition-colors hover:bg-brand-ink hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink focus-visible:ring-offset-2 focus-visible:ring-offset-brand"
          >
            Install
          </button>

          <button
            type="button"
            onClick={close}
            /* THE ONLY VISIBLE LABEL IS A GLYPH, so the accessible name is
               spelled out — and it says what closing DOES, not what the button
               looks like. "Close" alone is what a screen reader user hears on
               half the dialogs on the web and it never says close what. */
            aria-label="Dismiss the install banner"
            className="-mr-1 shrink-0 p-1 transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink focus-visible:ring-offset-2 focus-visible:ring-offset-brand"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
