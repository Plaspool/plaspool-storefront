/**
 * THE LIVE WAITLISTER EMBED. IT COLLECTS REAL SIGNUPS.
 *
 * Every string below was carried across unchanged from the page this replaces
 * (`apps/storefront/app/shop/page.tsx` at 3ea55e7). The key and the iframe URL
 * are the whole of the integration — a typo in either does not throw, it just
 * silently stops capturing leads, and nothing on this page would look wrong.
 * If you are changing this file, change the layout around it, not these two
 * values.
 *
 * BOTH the container and the iframe are deliberate, and the duplication is
 * inherited rather than introduced. `embed.js` is loaded site-wide from the
 * app's root layout and binds to `.waitlister-form[data-waitlist-key]`; the
 * hardcoded iframe is a second, independent path to the same form. Dropping
 * either one is a change to live lead capture, so both were relocated as they
 * stood. Worth an owner's decision, not an agent's.
 *
 * A server component: `embed.js` is `strategy="afterInteractive"`, so it runs
 * after hydration and cannot race it. The page this replaces rendered `null`
 * on the server and mounted the form only after an effect, which put a live
 * signup form behind an extra round trip for no benefit.
 */

const WAITLIST_KEY = "YCgl6I7iKc9n";
const WAITLIST_FORM_URL = `https://waitlister.me/form/${WAITLIST_KEY}`;

export function WaitlistEmbed() {
  return (
    <div
      className="waitlister-form flex w-full justify-center rounded-lg border border-brand-line bg-brand-soft p-4 sm:p-6"
      data-waitlist-key={WAITLIST_KEY}
      data-height="300px"
      /* The third-party script rewrites this subtree once it loads. */
      suppressHydrationWarning
      style={{ overflowX: "hidden", overflowY: "hidden" }}
    >
      <iframe
        src={WAITLIST_FORM_URL}
        /* An iframe with no accessible name is announced as "frame" and
           nothing else. The embed shipped without one; this is the one
           addition to it. */
        title="Waitlist signup form"
        scrolling="no"
        style={{
          width: "100%",
          maxWidth: "40rem",
          height: "300px",
          border: "none",
        }}
      />
    </div>
  );
}
