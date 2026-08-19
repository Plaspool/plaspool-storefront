import { SignInPage } from "@plaspool/web";

/**
 * Reads the customer's session on load (Neon Auth's cookie, then the shop
 * session), so it is opted into dynamic rendering explicitly rather than
 * left to infer it — a client-only page with no server-side `cookies()` or
 * `fetch` call would otherwise be prerendered as a static shell.
 */
export const dynamic = "force-dynamic";

export default function Page() {
  return <SignInPage />;
}
