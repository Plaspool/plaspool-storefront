"use client";

import * as React from "react";

import { ReturnForm } from "./return-form";
import { GuestPrompt } from "./guest-prompt";
import { readShopSession } from "../data/auth-api";
import type { ShopSession } from "../data/auth-api";
import type { ServiceArea } from "../data/returns-api";
import type { RewardsProgram } from "../data/marketing";

/**
 * `/returns`'s own session gate, in front of the SAME form `ReturnModal`
 * opens.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WITHOUT THIS, `/returns` MOUNTED THE FORM UNCONDITIONALLY. A guest filled
 * in five fields, submitted, and only THEN read a 401 back as "you will need
 * to fill it in again" — paying in full for a question the page could have
 * asked before a single field was typed. `ReturnModal` already asks it,
 * before the form mounts; this gate is the same question asked here.
 *
 * ═══ THE FORM RENDERS ON `"unknown"` — THE ONE PLACE THIS DIFFERS FROM
 * `ReturnModal` ═══
 * `ReturnModal` holds the form back behind a skeleton while a session read is
 * in flight, which is right for a dialog opened FROM an already-loaded page:
 * the wait is short, and a skeleton over a freshly opened dialog reads as
 * normal. `/returns` is the standalone, linkable, no-JS entry point — see
 * `ReturnRequestPage`'s own header for the full list of who lands here — so
 * withholding the form behind a client-only check would cost it exactly the
 * visitors it exists for. `readShopSession()`'s
 * own header states the doctrine every other per-customer screen in this
 * package already follows: "we could not ask" is not "nobody", so `"unknown"`
 * renders the SAME thing `"customer"` does, and only a CONFIRMED `"guest"` is
 * shown the door.
 *
 * ═══ THE SAME `GuestPrompt`, THE SAME REASON ═══
 * A guest who reaches `/returns` directly deserves the message a guest
 * opening the dialog gets, not a second copy of it drifting slowly away from
 * the first — see `guest-prompt.tsx`.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function ReturnFormGate({
  program,
  areas,
}: {
  program: RewardsProgram;
  areas: ServiceArea[];
}) {
  const [session, setSession] = React.useState<ShopSession["kind"]>("unknown");

  React.useEffect(() => {
    let cancelled = false;
    void readShopSession().then((result) => {
      if (!cancelled) setSession(result.kind);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (session === "guest") return <GuestPrompt />;
  // "customer" AND "unknown" both land here — see the file header.
  return <ReturnForm program={program} areas={areas} />;
}
