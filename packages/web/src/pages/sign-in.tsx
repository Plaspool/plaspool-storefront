"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, useSignIn, useSignUp } from "@clerk/nextjs";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { BrandLogo } from "@plaspool/brand";
import { Button, Input, Label, Separator, cn, NEO_SURFACE } from "@plaspool/ui";
import {
  completeSignIn,
  getShopCustomer,
  readShopSession,
  type ShopCustomer,
  type SignInFailureReason,
} from "@plaspool/shop";

import { SignInShowcase } from "./sign-in-showcase";
import {
  BRIDGE_FLAG,
  bridgeCallbackUrl,
  isBridgeReturn,
  safeDestination,
} from "./sign-in-destination";

/**
 * `/sign-in` — the one page a customer uses to keep their basket, addresses
 * and order history across devices. It is a DOORWAY, never a destination.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THE BRIDGE RUNS FROM HERE, AND WHY THE CALLBACK COMES BACK HERE.
 *
 * The Clerk → shop handshake exists in exactly one place: the `useEffect`
 * below. It can only live in one place, because the assertion it exchanges is
 * single-use. So this page has to be on the return path of BOTH flows that
 * grant a Clerk session — the Google OAuth callback and the email-code flow.
 *
 * IT ONCE WAS, AND THEN QUIETLY STOPPED BEING. When `next` was added so a
 * shopper bounced here from `/account/settings` would be returned there, the
 * destination was handed to the provider as its redirect directly. It obeyed:
 * Google returned the shopper to `/returns`, a page that does not bridge. They
 * arrived holding a live provider session and no `__Host-shop_session`, so
 * every `readShopSession()` in the shop called them a guest — the header
 * offered "Sign in", the returns form offered `GuestPrompt` — and signing in
 * again just repeated the loop. Nothing logged an error; both halves were
 * behaving exactly as written.
 *
 * `bridgeCallbackUrl` is the repair. Clerk is always sent back HERE, with the
 * real destination riding along as `next`, and this page forwards on once the
 * shop session it just minted actually exists.
 *
 * ═══ AND A RESOLVED SESSION IS A DEPARTURE, NOT A PAGE ═══
 * This used to render a "You're signed in" panel — a heading, an email, and a
 * "Sign out" button. `/sign-in` sits outside both `(shop)` and `(site)`, so it
 * carries no nav and no footer: a shopper who signed in from the header landed
 * in a room with one door, and that door logged them out. There is no signed-in
 * state of this page any more. Resolving a session means leaving.
 *
 * ONE ATTEMPT PER MOUNT. `attempted` is a ref, not state, because it must
 * survive without triggering a re-render, and it is never reset — a genuine
 * retry needs a fresh Clerk session, which only a full navigation back here
 * (a new OAuth round trip, a new code entry) can mint. Re-running the same
 * assertion would just burn a 400, because it is single-use.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY CLERK'S HOOKS AND NOT `<SignIn />`.
 *
 * Clerk's prebuilt component owns its own layout, its own copy and its own
 * routing. Mounting it here would mean either accepting a second visual
 * language on the one page a shopper is asked to trust, or fighting it with
 * appearance overrides. `useSignIn`/`useSignUp` give the same flows — Google
 * OAuth and an emailed code — while the markup below stays this site's own.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const FAILURE_COPY: Record<SignInFailureReason, string> = {
  /* NOT "could not reach the server". A 401 from the bridge means the provider
     session is gone — expired, or revoked by a sign-out in another tab — and
     the shopper's remedy is to sign in again, which is the form they are
     already looking at. Telling them to check their connection sends them to
     debug a network that is working. */
  no_session: "That sign-in session expired. Please sign in again.",
  email_unverified:
    "Verify your email address first — check your inbox for the code we sent.",
  not_configured: "Sign-in is not available yet. You can still check out as a guest.",
  assertion: "That sign-in link has already been used. Request a new one.",
  assertion_expired: "That took a little too long. Please sign in again.",
  network: "Could not reach the server. Check your connection and try again.",
};

/**
 * Which of Clerk's two objects is mid-flight.
 *
 * ═══ WHY THIS IS TRACKED AND NOT INFERRED ═══
 * Clerk models "sign in an existing account" and "create a new one" as separate
 * resources with separate verification calls, and a six-digit code looks
 * identical in both. Reading `signIn.status` at verify time to work out which
 * one issued the code means depending on a field the SDK also mutates for its
 * own reasons; recording it at the moment the code was SENT is a fact this page
 * owns. It is in the state rather than a ref because the two are always set
 * together and must never disagree.
 */
type Flow = "sign_in" | "sign_up";

/**
 * How long to wait for Clerk's script before telling the shopper it is not
 * coming. Long enough to clear a slow mobile connection, short enough that
 * nobody stares at two disabled buttons wondering what they did wrong.
 */
const CLERK_LOAD_DEADLINE_MS = 10_000;

type FormState =
  | { kind: "idle" }
  | { kind: "bridging" }
  | { kind: "sending_code" }
  /* `error` is what keeps a mistyped digit INSIDE this step. Without it the
     only way to show a message was `provider_error`, which is not part of
     `codeStage` — so a wrong code unmounted the code field, threw away the
     address and the flow, and cost a whole fresh round trip. */
  | { kind: "code_sent"; email: string; flow: Flow; error?: string }
  | { kind: "verifying"; email: string; flow: Flow }
  | { kind: "failed"; reason: SignInFailureReason }
  /* Clerk's own errors are already written for shoppers, so they are carried
     through verbatim rather than mapped onto `SignInFailureReason` — which
     names failures of OUR bridge, not of the provider's flow. */
  | { kind: "provider_error"; message: string };

/**
 * A `ClerkError` reduced to one sentence a shopper can act on.
 *
 * `longMessage` is Clerk's shopper-facing wording ("Couldn't find your account.")
 * and `message` its terser developer one; either beats a generic fallback, and
 * the fallback exists because an error object is not guaranteed to carry text
 * at all.
 */
function clerkMessage(error: { longMessage?: string; message?: string } | null): string {
  return (
    error?.longMessage ?? error?.message ?? "Something went wrong. Please try again."
  );
}

/**
 * Whether Clerk is saying "there is no account with that address".
 *
 * ═══ WHY NOT `error.code === "form_identifier_not_found"` ═══
 * Because that is never true. Every API rejection arrives as a
 * `ClerkAPIResponseError`, whose constructor hard-codes the base `code` to the
 * literal `"api_response_error"`; the per-FIELD code lives one level down, in
 * `.errors[]`. Testing the outer `code` therefore compiles, type-checks, reads
 * correctly — and silently never matches, which made the entire email sign-up
 * path unreachable: a new shopper got "Couldn't find your account." and no code,
 * forever, with Google as the only way to ever create an account.
 *
 * `isClerkAPIResponseError` is the guard Clerk exports for exactly this; a
 * runtime/offline error is not an API response and correctly answers `false`.
 */
/**
 * Whether Clerk is refusing the SOCIAL PROVIDER itself, rather than refusing
 * this shopper.
 *
 * ═══ THE STRING THIS EXISTS TO KEEP OFF THE PAGE ═══
 * A Clerk instance can have Google switched on but not `authenticatable` —
 * enabled as a connection, yet not accepted as a sign-in strategy, which is
 * what happens on a production instance until Google credentials are supplied.
 * The API then rejects the attempt with:
 *
 *     oauth_google does not match one of the allowed values for parameter
 *     strategy
 *
 * `clerkMessage` passes Clerk's wording straight through, which is right for
 * "Couldn't find your account." and very wrong for that — it is a validation
 * message written for whoever configured the instance, and it appeared in a
 * red box in front of customers who can do nothing about it. Matched on
 * `meta.paramName === 'strategy'` rather than on the text, so it does not
 * depend on Clerk's copy staying the same.
 */
function isProviderUnavailable(error: unknown): boolean {
  return (
    isClerkAPIResponseError(error) &&
    error.errors.some((e) => e.meta?.paramName === "strategy")
  );
}

function isUnknownAccount(error: unknown): boolean {
  return (
    isClerkAPIResponseError(error) &&
    error.errors.some((e) => e.code === "form_identifier_not_found")
  );
}

/**
 * The URL, as the SERVER already read it.
 *
 * ═══ WHY THESE ARE PROPS AND NOT `window.location` ═══
 * They used to be `useMemo`s over `window.location.search`, which is `undefined`
 * during SSR. So the server rendered the sign-in FORM for every request, and the
 * client — seeing `?bridge=1` — immediately rendered the finishing panel
 * instead. Two different trees for the same URL: a hydration mismatch on every
 * single OAuth return, React discarding the server tree, and the shopper
 * watching a sign-in form paint and vanish one frame later. Which is exactly
 * the "did that even work?" flicker `BRIDGE_FLAG` was introduced to remove.
 *
 * The route is `force-dynamic` and already reads `searchParams`, so handing
 * them down costs nothing and both renders now agree at first paint.
 */
export interface SignInPageProps {
  /** Raw `?next=`, straight off the URL. Sanitised here, never trusted. */
  next?: string | null;
  /** Raw `?bridge=`. See `BRIDGE_FLAG`. */
  bridge?: string | null;
}

export default function SignInPage({ next = null, bridge = null }: SignInPageProps) {
  const router = useRouter();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();

  /**
   * Whether Clerk's script has actually loaded.
   *
   * ═══ NOT `Boolean(signIn)` ═══
   * That was the previous test and it is a constant `true`: v7's `useSignIn`
   * returns a non-nullable `SignInFutureResource`, backed by a proxy object that
   * exists before Clerk loads. So the guard never guarded anything, and every
   * `disabled={… || !ready}` was dead. `useAuth().isLoaded` is the real signal.
   */
  const ready = authLoaded;

  /**
   * Clerk never finished loading, and somebody is looking at dead controls.
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * THIS IS NOT A HYPOTHETICAL, AND IT FAILS SILENTLY IN THREE WAYS.
   *
   * `useAuth().isLoaded` only ever flips on a SUCCESSFUL load. There is no
   * failure callback, so each of these leaves it `false` for ever:
   *
   *   1. `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` missing from the BUILD — the trap
   *      `lib/auth/config.ts` documents, which `next build` does not catch.
   *   2. An extension or a corporate proxy blocking `*.clerk.accounts.dev`.
   *   3. Any network failure fetching Clerk's script.
   *
   * Without a deadline the page just sits there: both buttons disabled, no
   * message, nothing in the UI admitting anything is wrong — and on the
   * `?bridge=1` return path it reads "Signing you in…" for ever, because
   * `noSessionAnywhere` cannot become true while `authLoaded` is false.
   *
   * So: after `CLERK_LOAD_DEADLINE_MS`, say so, using the same sentence an
   * unconfigured bridge already uses. Guest checkout still works, and that is
   * the thing worth telling them.
   * ═══════════════════════════════════════════════════════════════════════════
   */
  const [deadlinePassed, setDeadlinePassed] = React.useState(false);
  React.useEffect(() => {
    if (authLoaded) return;
    const timer = window.setTimeout(() => setDeadlinePassed(true), CLERK_LOAD_DEADLINE_MS);
    return () => window.clearTimeout(timer);
  }, [authLoaded]);

  /*
   * DERIVED, not stored — the deadline having passed is permanent, but being
   * STALLED is not. A slow-but-working Clerk that arrives at 12s would
   * otherwise leave "Sign-in is not available yet" on screen for the rest of
   * the visit, covering the wrong-code message on the very next step, because
   * nothing unset it. Recomputing from `authLoaded` means it clears itself the
   * moment Clerk turns up.
   */
  const clerkStalled = deadlinePassed && !authLoaded;

  /**
   * Where to go back to after signing in.
   *
   * ═══ A DESTINATION THAT SURVIVES THE DETOUR ═══
   * Both callbacks used to be the literal string `/sign-in`, so a shopper
   * bounced here from `/account/settings` by an expired session signed in and
   * landed... back on `/sign-in`. The page they asked for was forgotten at the
   * moment they were redirected, and nothing carried it.
   *
   * The validation — same-site only, and never back to this page — lives in
   * `safeDestination`, where it is unit-testable without a DOM; see that module
   * for the open redirect and the redirect loop it is holding shut.
   */
  const returnTo = React.useMemo(() => safeDestination(next), [next]);

  /**
   * Whether this page load is the TAIL of a sign-in round trip rather than the
   * head of one — the difference between showing a form and finishing a
   * handshake, which has to be decided at first paint. See `BRIDGE_FLAG`.
   */
  const returning = React.useMemo(
    () => isBridgeReturn(bridge ? `?${BRIDGE_FLAG}=${bridge}` : ""),
    [bridge],
  );

  const [customer, setCustomer] = React.useState<ShopCustomer | null | undefined>(undefined);
  const [form, setForm] = React.useState<FormState>({ kind: "idle" });
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const attempted = React.useRef(false);
  const alertRef = React.useRef<HTMLParagraphElement>(null);

  /**
   * Move focus onto the error when one appears.
   *
   * ═══ THE DEAD END THIS CLOSES ═══
   * Every submit button disables itself while working. A browser BLURS a
   * focused element the moment it becomes disabled, so a keyboard-only shopper
   * who submitted and was rejected had focus reset to `<body>`: pressing Tab
   * sent them to the skip link at the very top of the document, and nothing had
   * announced the failure or where it was. `tabIndex={-1}` makes the alert
   * focusable without adding it to the tab order, so the next Tab continues
   * from the message rather than from the top of the page.
   */
  const errorText =
    /* A stalled Clerk outranks whatever the form last said: nothing the shopper
       does on this page can succeed until it loads, so that is the fact to put
       in front of them. */
    clerkStalled && !customer
      ? FAILURE_COPY.not_configured
      : form.kind === "failed"
      ? FAILURE_COPY[form.reason]
      : form.kind === "provider_error"
        ? form.message
        : form.kind === "code_sent"
          ? form.error
          : undefined;

  React.useEffect(() => {
    if (errorText) alertRef.current?.focus();
  }, [errorText]);

  React.useEffect(() => {
    let cancelled = false;
    getShopCustomer().then((c) => {
      if (!cancelled) setCustomer(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (customer === undefined) return; // shop session check still in flight
    if (customer) return; // already have a shop session
    if (!authLoaded) return; // clerk session still resolving
    if (!isSignedIn) return; // no clerk session to bridge from
    if (attempted.current) return;
    attempted.current = true;

    setForm({ kind: "bridging" });
    completeSignIn().then(async (result) => {
      if (!result.ok) {
        setForm({ kind: "failed", reason: result.reason });
        return;
      }

      /*
       * ═══ STAYS ON `bridging` UNTIL THE REDIRECT ACTUALLY HAPPENS ═══
       * This used to drop to `idle` here. On the OAuth path that was masked by
       * `returning`, which holds `finishing` true on its own — but the in-page
       * email-code flow has no `?bridge=1`, so `idle` with `customer` still
       * null re-rendered the whole sign-in FORM, address still in the field,
       * for the length of a cross-origin credentialed round trip, and then
       * jumped away. A successful sign-in flashing the sign-in form at you is
       * precisely the "did that even work?" moment this page is built to avoid.
       */
      const session = await readShopSession();

      if (session.kind === "customer") {
        setCustomer(session.customer);
        return;
      }

      /*
       * ═══ `unknown` IS NOT `guest`, AND THE DIFFERENCE IS A DEAD END ═══
       * The exchange succeeded, so `__Host-shop_session` exists and the
       * assertion is spent. If this follow-up probe merely FAILED to answer,
       * treating it as "no customer" left the shopper on a bare form, signed in
       * but told nothing, with `attempted` latched so the bridge could never
       * retry. Releasing the latch lets the next render try the probe again;
       * `completeSignIn` is not re-run, because `customer` is what gates it.
       */
      if (session.kind === "unknown") {
        attempted.current = false;
        setForm({ kind: "failed", reason: "network" });
        return;
      }

      setForm({ kind: "failed", reason: "network" });
    });
  }, [customer, authLoaded, isSignedIn]);

  /**
   * A SESSION IS A DEPARTURE. The moment one resolves — bridged just now, or
   * already live when the page mounted — the shopper leaves for wherever they
   * were headed. `replace` and not `push`, so Back goes to the page they came
   * from rather than to a sign-in page that would immediately bounce them
   * forward again.
   */
  React.useEffect(() => {
    if (!customer) return;
    router.replace(returnTo);
  }, [customer, returnTo, router]);

  const handleGoogle = React.useCallback(async () => {
    /*
     * ═══ BOTH URLS LEAD BACK TO THE BRIDGE, AND THAT IS DELIBERATE ═══
     *
     * `redirectUrl` is where Clerk sends a shopper whose session completed;
     * `redirectCallbackUrl` is where it sends one whose sign-in needs another
     * step (a brand-new account being transferred to a sign-up, most often).
     *
     * The second lands on `/sign-in/sso-callback`, which finishes the handshake
     * and then forwards to this same bridge URL — so BOTH paths end at
     * `/sign-in?next=…&bridge=1`, the one page that owns the Clerk → shop
     * exchange. Sending either straight to the shopper's destination is the
     * bug `sign-in-destination.ts` documents: they arrive holding a Clerk
     * session, no `__Host-shop_session`, and every surface in the shop calls
     * them a guest.
     *
     * `next` rides along on the callback URL too, so the intermediate page can
     * rebuild the same destination rather than defaulting to `/store`.
     */
    const { error } = await signIn.sso({
      strategy: "oauth_google",
      redirectUrl: bridgeCallbackUrl(returnTo),
      redirectCallbackUrl: `/sign-in/sso-callback?next=${encodeURIComponent(returnTo)}`,
    });
    /* A failure here is Clerk refusing before the browser ever leaves — a
       misconfigured provider, usually. Without this the button looks dead. */
    if (error) {
      setForm({
        kind: "provider_error",
        message: isProviderUnavailable(error)
          ? /* Names the thing the shopper CAN do. The email field below is
               configured and working even when the social provider is not, so
               this is a detour rather than a dead end. */
            "Google sign-in isn't available right now. Use your email address below instead."
          : clerkMessage(error),
      });
    }
  }, [signIn, returnTo]);

  /**
   * ONE FIELD, EITHER OUTCOME.
   *
   * The shopper types an address and gets a code — whether or not they already
   * have an account. Clerk models those as two different objects (`signIn` for
   * a known address, `signUp` for a new one), and asking the shopper to pick
   * first would be asking them to remember something they came here to avoid
   * remembering. So this tries sign-in, and falls back to sign-up on the one
   * error that means "no such account".
   */
  const handleSendCode = React.useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const address = email.trim();
      if (!address) return;

      setForm({ kind: "sending_code" });

      const created = await signIn.create({ identifier: address });
      if (created.error) {
        /* `form_identifier_not_found` is Clerk saying "no account with that
           address" — which here is not an error but the sign-up path. Any
           other code is a real failure and is shown as one. */
        if (!isUnknownAccount(created.error)) {
          setForm({ kind: "provider_error", message: clerkMessage(created.error) });
          return;
        }
        const signedUp = await signUp.create({ emailAddress: address });
        if (signedUp.error) {
          setForm({ kind: "provider_error", message: clerkMessage(signedUp.error) });
          return;
        }
        const sent = await signUp.verifications.sendEmailCode();
        if (sent.error) {
          setForm({ kind: "provider_error", message: clerkMessage(sent.error) });
          return;
        }
        setForm({ kind: "code_sent", email: address, flow: "sign_up" });
        return;
      }

      const sent = await signIn.emailCode.sendCode();
      if (sent.error) {
        setForm({ kind: "provider_error", message: clerkMessage(sent.error) });
        return;
      }
      setForm({ kind: "code_sent", email: address, flow: "sign_in" });
    },
    [email, signIn, signUp],
  );

  /**
   * The code, against whichever object issued it.
   *
   * WHICH OBJECT TO VERIFY AGAINST comes from `form.flow`, recorded when the
   * code was sent — not from `signIn.status`. See the `Flow` type above for why
   * reading the SDK's status back at this point is the wrong source of truth.
   */
  const handleVerify = React.useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (form.kind !== "code_sent") return;
      const value = code.trim();
      if (!value) return;

      const { email: address, flow } = form;
      setForm({ kind: "verifying", email: address, flow });

      const verified =
        flow === "sign_in"
          ? await signIn.emailCode.verifyCode({ code: value })
          : await signUp.verifications.verifyEmailCode({ code: value });

      if (verified.error) {
        /* Back to `code_sent`, not to `idle`: the code they were sent is still
           valid, and dropping them to the email field would make a mistyped
           digit cost a whole new round trip. */
        /* Clear the field too: focus moves to the alert, so a shopper tabbing
           back would otherwise meet a full box that silently ignores typing. */
        setCode("");
        setForm({
          kind: "code_sent",
          email: address,
          flow,
          error: clerkMessage(verified.error),
        });
        return;
      }

      /*
       * ═══ `navigate` IS A NO-OP ON PURPOSE ═══
       * `finalize()` activates the session and then, by default, navigates to
       * Clerk's configured redirect URL — which would carry the shopper off
       * this page before the bridging effect below ever runs, leaving them with
       * a Clerk session and no `__Host-shop_session`. Supplying a `navigate`
       * that does nothing keeps them here; activating the session flips
       * `isSignedIn`, the effect wakes, bridges, and only then does the shopper
       * leave — for the destination THEY asked for.
       */
      const finalized =
        flow === "sign_in"
          ? await signIn.finalize({ navigate: async () => {} })
          : await signUp.finalize({ navigate: async () => {} });

      if (finalized.error) {
        /*
         * BACK TO THE EMAIL STEP, NOT THE CODE STEP — the opposite of what a
         * verify failure does, and deliberately. By the time `finalize()` runs,
         * the code has already been VERIFIED and is therefore spent: leaving
         * the shopper on the code screen gives them one button that re-submits
         * a dead code and another that makes them retype their address. The
         * email step is the only place they can actually start a new attempt.
         */
        setCode("");
        setForm({ kind: "provider_error", message: clerkMessage(finalized.error) });
      }
    },
    [code, form, signIn, signUp],
  );

  const working =
    form.kind === "bridging" ||
    form.kind === "sending_code" ||
    form.kind === "verifying";

  /**
   * The second step of the email flow — a code has been sent and is either
   * being typed or being checked.
   *
   * BOTH STATES, because the heading and the form must not change while the
   * code is in flight: flipping back to "Sign in to PlaSpool" for the second a
   * request is open reads as the app having forgotten what the shopper just did.
   */
  const codeStage = form.kind === "code_sent" || form.kind === "verifying";

  /**
   * Nobody is signed in anywhere, and both probes have said so.
   *
   * THE HANG THIS PREVENTS. `returning` is read off the URL, so a hand-typed
   * or stale `?bridge=1` claims a handshake that is not happening. Without
   * this, such a visit would sit on "Signing you in…" forever, because the
   * effect above returns early when there is no Clerk session to bridge FROM
   * and nothing else would ever move `form` off `idle`.
   */
  const noSessionAnywhere =
    customer === null && ((authLoaded && !isSignedIn) || clerkStalled);

  /**
   * The handshake is the whole page: either it is running, or it finished and
   * the redirect above is on its way. A failure is NOT one of these — that
   * falls back to the form with its reason, which is the only state a shopper
   * can actually act on.
   */
  const finishing =
    form.kind !== "failed" &&
    form.kind !== "provider_error" &&
    !noSessionAnywhere &&
    (Boolean(customer) || form.kind === "bridging" || returning);

  return (
    /*
     * THE SPLIT IS `lg:` AND NOT `md:`. The showcase needs roughly a square to
     * read as an image rather than a letterbox, and at `md` the two columns are
     * each ~360px — narrow enough that the form's inputs start wrapping their
     * labels. Below `lg` the panel is dropped entirely rather than stacked
     * under the form: it is reassurance, and reassurance below the fold on a
     * phone is weight with no job.
     */
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-5 py-8 sm:px-10 lg:px-14">
        {/* `mx-auto max-w-sm` MATCHES `<main>` AND `<footer>`. Without it the
            header spanned the full padded column, so at 1440px the wordmark
            started 112px left of the <h1> it belongs to, and at 1920px 232px —
            the only element on the page that did not line up with the form. */}
        <header className="mx-auto flex w-full max-w-sm items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">
            {/* THE REAL LOCKUP. This was a hand-drawn SVG spool plus the
                wordmark set in the body face — close enough to look deliberate
                and wrong enough that the sign-in page was the one screen not
                wearing the actual brand. `BrandLogo` is the same component the
                nav and footer use, reading the same artwork; `h-7 w-auto`
                keeps its 4800x980 ratio. */}
            <BrandLogo variant="lockup" className="h-7" alt="PlaSpool" />
          </Link>
          <Link
            href={returnTo}
            className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 3 5 8l5 5" />
            </svg>
            Back to shop
          </Link>
        </header>

        <main
          id="content"
          className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12"
        >
          {finishing ? (
            <FinishingPanel arrived={Boolean(customer)} />
          ) : (
            <>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                {codeStage ? "Check your email" : "Sign in to PlaSpool"}
              </h1>
              <p className="mt-2.5 text-sm leading-6 text-muted-foreground">
                {codeStage && "email" in form ? (
                  <>
                    We sent a code to{" "}
                    <span className="font-medium text-foreground break-all">
                      {form.email}
                    </span>
                    .
                    Enter it below to finish.
                  </>
                ) : (
                  "Keep your basket, addresses and order history on every device."
                )}
              </p>

              {errorText && (
                <p
                  role="alert"
                  ref={alertRef}
                  tabIndex={-1}
                  /* `destructive-strong`, matching every other role="alert" in
                     the shop. The previous `bg-brand-soft` was byte-identical
                     to the Google button's hover fill and the showcase's
                     ground, so nothing but the words said "this failed". */
                  className="mt-6 rounded-md border-2 border-destructive-strong bg-background px-4 py-3 text-sm leading-6 text-destructive-strong"
                >
                  {errorText}
                </p>
              )}

              {codeStage ? (
                <form onSubmit={handleVerify} className="mt-8 flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="sign-in-code" className="text-foreground">
                      Verification code
                    </Label>
                    <Input
                      id="sign-in-code"
                      name="code"
                      /* `inputMode` and `autoComplete` together are what make a
                         phone offer the code from the SMS/mail app rather than
                         a keyboard the shopper has to type six digits on. */
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      autoFocus
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      disabled={working}
                      maxLength={6}
                      /* `md:text-lg` is NOT redundant. The `Input` base carries
                         shadcn's `text-base md:text-sm`, and tailwind-merge
                         keeps a responsive variant alongside an unprefixed one
                         — so a bare `text-lg` lost to `md:text-sm` on every
                         desktop and the six-digit code rendered at 14px.
                         `pr-[0.4em]` gives back the trailing letter-space that
                         `tracking` adds inside the measured width, which
                         otherwise pushes the digits left of true centre. */
                      className="h-12 border-muted-foreground pr-[0.4em] text-center text-lg tracking-[0.4em] md:text-lg"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={working}
                    className={cn(
                      "h-12 w-full justify-center border-2 border-foreground bg-brand text-base text-brand-ink hover:bg-brand-hover",
                      NEO_SURFACE,
                    )}
                  >
                    {form.kind === "verifying" ? "Checking…" : "Continue"}
                  </Button>
                  <Button
                    type="button"
                    variant="link"
                    disabled={working}
                    onClick={() => {
                      setCode("");
                      /* CLEARS THE ADDRESS TOO. It did not, so the button
                         labelled "Use a different email" handed back the same
                         one, pre-filled. */
                      setEmail("");
                      setForm({ kind: "idle" });
                    }}
                    className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
                  >
                    Use a different email
                  </Button>
                </form>
              ) : (
                <>
                  <Button
                    type="button"
                    onClick={handleGoogle}
                    disabled={working || !ready}
                    className={cn(
                      "mt-8 h-12 w-full justify-center gap-3 border-2 border-foreground bg-background text-base text-foreground hover:bg-brand-soft",
                      NEO_SURFACE,
                    )}
                  >
                    <GoogleMark />
                    Continue with Google
                  </Button>

                  <div className="my-6 flex items-center gap-4">
                    <Separator className="flex-1" />
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      or
                    </span>
                    <Separator className="flex-1" />
                  </div>

                  <form onSubmit={handleSendCode} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="sign-in-email" className="text-foreground">
                        Email address
                      </Label>
                      <Input
                        id="sign-in-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={working}
                        /* ONE PIXEL, MID-GREY — not the 2px black rule this
                           briefly had. The shadcn default `border-input` is
                           #E5E5E5 on white, which measures 1.26:1 and fails
                           SC 1.4.11's 3:1 for a control boundary on the only
                           field on the page; `border-muted-foreground` is
                           #686868, about 5.9:1, and reads as a quiet field
                           rather than a heavy outline. */
                        className="h-12 border-muted-foreground"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={working || !ready}
                      className={cn(
                        "h-12 w-full justify-center border-2 border-foreground bg-brand text-base text-brand-ink hover:bg-brand-hover",
                        NEO_SURFACE,
                      )}
                    >
                      {form.kind === "sending_code" ? "Sending…" : "Continue"}
                    </Button>
                  </form>
                </>
              )}
            </>
          )}
        </main>

        <footer className="mx-auto w-full max-w-sm text-sm leading-6 text-muted-foreground">
          <p>
            You don&apos;t need an account to check out.{" "}
            <Link
              href="/store"
              className="text-foreground underline underline-offset-4 hover:no-underline"
            >
              Keep shopping
            </Link>
            .
          </p>
          <p className="mt-2 text-xs leading-5">
            By continuing you agree to PlaSpool&apos;s{" "}
            <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
              Privacy Policy
            </Link>
            .
          </p>
        </footer>
      </div>

      {/* The showcase, running to the edges of its column — no gutter and no
          tinted ground behind it, so the photograph IS the right half of the
          page rather than a framed picture sitting on one. `hidden lg:block`
          rather than a responsive height, so a phone never downloads or paints
          it at all. */}
      <div className="hidden lg:block">
        <SignInShowcase />
      </div>
    </div>
  );
}

/**
 * The only thing this page shows once a session is in play: the handshake
 * running, and then the shopper leaving.
 *
 * ═══ TEXT RATHER THAN A SKELETON, DELIBERATELY ═══
 * The house rule is that a known layout loads as its own shape, never as a
 * line of prose. This is the documented exception: nothing is arriving to be
 * drawn here. The wait is a PROCESS the shopper is watching — two round trips
 * between Clerk and the commerce API — and the page they are waiting for is a
 * different page. A skeleton of a form nobody is going to fill in would be a
 * shape that never resolves.
 *
 * `role="status"` so a screen reader is told the same thing the sighted
 * shopper is, without stealing focus mid-navigation.
 */
function FinishingPanel({ arrived }: { arrived: boolean }) {
  return (
    <div role="status" className="flex flex-col gap-2">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        {arrived ? "You're signed in" : "Signing you in…"}
      </h1>
      <p className="text-sm leading-6 text-muted-foreground">
        {arrived
          ? "Taking you back to the shop."
          : "One moment while we finish setting up your account."}
      </p>
    </div>
  );
}

/** Google's mark, inline so the button needs no extra request. */
function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 18 18" className="h-4 w-4 shrink-0">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.56 2.7-3.87 2.7-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.94v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.94A9 9 0 0 0 0 9c0 1.45.35 2.83.94 4.03l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .94 4.97l3.01 2.33C4.66 5.17 6.65 3.58 9 3.58Z"
      />
    </svg>
  );
}
