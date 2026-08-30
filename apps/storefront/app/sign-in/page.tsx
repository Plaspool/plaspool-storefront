import type { Metadata } from "next";
import { SignInPage } from "@plaspool/web";

/**
 * Reads the customer's session on load (Clerk's cookie, then the shop session),
 * so it is opted into dynamic rendering explicitly rather than left to infer
 * it — a client-only page with no server-side `cookies()` or `fetch` call would
 * otherwise be prerendered as a static shell.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  /* Nothing here should ever be indexed: every URL carries a `next`, and some
     carry a one-time `bridge` flag. A crawler following one would index a
     handshake. */
  robots: { index: false, follow: false },
};

/**
 * ═══ THE SEARCH PARAMS ARE READ HERE, ON THE SERVER, AND HANDED DOWN ═══
 *
 * `SignInPage` used to read them from `window.location` in a `useMemo`, which is
 * `undefined` during SSR — so the server rendered the sign-in form and the
 * client, seeing `?bridge=1`, rendered the finishing panel instead. That is a
 * hydration mismatch on every OAuth return, and the shopper saw a sign-in form
 * paint and disappear at the exact moment they were being signed in.
 *
 * Reading them here costs nothing — the route is already `force-dynamic` — and
 * makes both renders agree at first paint. Neither value is trusted: `next` goes
 * through `safeDestination` on the other side.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  /* A repeated `?next=a&next=b` arrives as an array. Refused rather than
     resolved — picking one would be guessing which the shopper meant, and
     `safeDestination(null)` is a safe, documented default. */
  const one = (value: string | string[] | undefined) =>
    typeof value === "string" ? value : null;

  return <SignInPage next={one(params.next)} bridge={one(params.bridge)} />;
}
