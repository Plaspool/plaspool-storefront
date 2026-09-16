"use client";

import { Analytics } from "@vercel/analytics/react";
import { scrubTokenParam } from "@plaspool/web";

/**
 * Vercel Analytics with the review link's `?token=` stripped from every event.
 * A client component only because `beforeSend` is a function, which a server
 * layout cannot pass as a prop.
 */
export function VercelAnalytics() {
  return <Analytics beforeSend={(event) => ({ ...event, url: scrubTokenParam(event.url) })} />;
}
