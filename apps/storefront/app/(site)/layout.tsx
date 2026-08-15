import { Footer, Nav } from "@plaspool/web";

/**
 * Marketing and blog chrome.
 *
 * The nav and footer live here rather than in the root layout because the shop
 * carries its own — `(shop)/layout.tsx` mounts `ShopShell`, which brings a
 * different nav (categories, search, cart, account) and a different footer.
 * With both sets in the root layout every `/store` page rendered two navs and
 * two footers.
 *
 * The root layout keeps only what is genuinely global: html, body, theme,
 * consent, analytics and the skip link. Each route group owns its own
 * `<main id="content">` so the skip link has a target on both sides.
 */
export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Nav />
      {/* tabIndex={-1}: programmatically focusable as the skip link's jump
          target, without joining the normal Tab order. */}
      <main id="content" tabIndex={-1} className="focus:outline-none">
        {children}
      </main>
      <Footer />
    </>
  );
}
