import type { Metadata } from "next";

/**
 * Unlike the `/shop` gateway, this page is real content and is indexable —
 * it is the one place someone can act before the shop opens.
 */
export const waitlistMetadata: Metadata = {
  title: "Join the waitlist",
  description:
    "Be told when the Plaspool shop opens. We make 3D printing filament in Nigeria and ship nationwide, with discounts on bulk orders.",
  alternates: { canonical: "/waitlist" },
};
