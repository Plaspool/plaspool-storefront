"use client";

import * as CookieConsent from "vanilla-cookieconsent";

/**
 * Extracted as its own client component so the footer can stay a server
 * component — it is otherwise entirely static.
 */
export function CookiePreferencesButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => CookieConsent.showPreferences()}
      className={className}
    >
      Cookie preferences
    </button>
  );
}
