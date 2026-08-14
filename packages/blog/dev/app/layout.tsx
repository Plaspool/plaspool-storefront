import "./globals.css";

export const metadata = { title: "@plaspool/blog — dev harness" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <p style={{ background: "#231c50", color: "#fff", margin: 0, padding: "6px 12px", fontSize: 12 }}>
          @plaspool/blog dev harness — not the real site chrome
        </p>
        {children}
      </body>
    </html>
  );
}
