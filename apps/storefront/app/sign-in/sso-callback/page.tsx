import type { Metadata } from "next";
import { SsoCallback } from "@plaspool/web";

/**
 * Where Google returns the shopper, and the only thing that happens here.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THIS PAGE IS NOT THE DESTINATION AND NOT THE BRIDGE.
 *
 * Clerk's `AuthenticateWithRedirectCallback` reads the OAuth result off the
 * URL, activates the session, and then navigates to the force-redirect URL the
 * component is given — which is `/sign-in?next=…&bridge=1`. So the shopper
 * passes through here for a fraction of a second and lands back on the page
 * that owns the Clerk → shop handshake.
 *
 * IT MUST EXIST AS A REAL ROUTE. `redirectCallbackUrl` names a path Clerk will
 * send a browser to; if nothing is mounted there, the round trip ends on a 404
 * with a live Clerk session and no shop session — the exact split-brain state
 * `sign-in-destination.ts` documents at length, reached by a different road.
 *
 * `next` is read HERE rather than from `window` in the client component, for
 * the same reason `/sign-in` does it: so the server and client render the same
 * tree and the shopper does not watch the page change its mind on hydration.
 *
 * `force-dynamic` because there is nothing here to prerender: the entire
 * content of this page is a query string that only exists at request time.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Signing you in",
  /* A one-time OAuth result. Indexing it would index somebody's handshake. */
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : null;

  return <SsoCallback next={next} />;
}
