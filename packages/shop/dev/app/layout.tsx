import "./globals.css";
import { ShopShell } from "@plaspool/shop";

export const metadata = { title: "@plaspool/shop — dev harness" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* `font-mono`, matching the storefront's root layout. A harness that
          renders the shop's components in a face the shop does not use is a
          harness you cannot review a component in. The heading labels in
          `kit/page.tsx` deliberately stay `font-sans` — that is the harness's
          own furniture, and it now reads as distinct from the components
          under test rather than the same as them. */}
      <body className="min-h-screen bg-background font-mono text-foreground antialiased">
        <p className="m-0 bg-brand px-3 py-1.5 text-xs text-brand-ink">
          @plaspool/shop dev harness — not the real site chrome
        </p>
        <ShopShell>{children}</ShopShell>
      </body>
    </html>
  );
}
