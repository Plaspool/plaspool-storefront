"use client";

/**
 * Replaces the root layout when it is the layout itself that failed, so it must
 * render its own <html>/<body> and cannot use any app component, provider, or
 * stylesheet. Everything here is inline on purpose.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          margin: 0,
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 420 }}>
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>
            PlaSpool is having a problem
          </h1>
          <p style={{ color: "#5c584a", marginBottom: 24 }}>
            Something failed while loading the site. Please try again.
          </p>
          {error.digest && (
            <p style={{ color: "#9a9384", fontSize: 12, marginBottom: 24 }}>
              Reference: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              background: "#231c50",
              color: "#fff",
              border: 0,
              borderRadius: 6,
              padding: "10px 18px",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
