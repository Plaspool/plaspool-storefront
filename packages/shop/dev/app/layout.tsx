import "./globals.css";

export const metadata = { title: "@plaspool/shop — dev harness" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <p className="m-0 bg-brand px-3 py-1.5 text-xs text-brand-ink">
          @plaspool/shop dev harness — not the real site chrome
        </p>
        {children}
      </body>
    </html>
  );
}
