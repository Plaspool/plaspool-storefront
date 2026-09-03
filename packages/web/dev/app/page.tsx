import { getRewardsProgram } from "@plaspool/shop";

import { PlaspoolLanding } from "../../src";

/* Was `export default PlaspoolLanding`. The landing page now takes the rewards
   programme as a prop — it is `"use client"` and the programme is a server
   read — so the harness has to fetch it the way the real route does, or the
   rewards card is the one section of the page that never renders here. */
export default async function Page() {
  return <PlaspoolLanding program={await getRewardsProgram()} />;
}
