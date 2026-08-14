import "./globals.css";

import { Nav, Footer } from "../../src";

export const metadata = { title: "@plaspool/web — dev harness" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <p style={{ background: "#231c50", color: "#fff", margin: 0, padding: "6px 12px", fontSize: 12 }}>
          @plaspool/web dev harness — not the real site chrome
        </p>
        <Nav />
        {children}
        <Footer />
      </body>
    </html>
  );
}
