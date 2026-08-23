import { PlaspoolLanding } from "@plaspool/web";

export default function Home() {
  return <PlaspoolLanding />;
}

// Must match MARKETING_REVALIDATE in packages/shop/src/data/config.ts.
// Next.js requires route segment config to be a statically analysable
// literal, so this cannot import the constant.
//
// Without this, `/` built fully static with no revalidate window at all —
// `AnnouncementBar` (mounted in `(site)/layout.tsx`, above `<Nav/>`) is the
// first fetch this route composes. `/store/page.tsx` sets the same literal
// for the same reason: the shell carrying the bar there is `ShopShell`, a
// layout rather than that page either, so the window has to be declared
// explicitly rather than left for Next to infer.
export const revalidate = 300;
