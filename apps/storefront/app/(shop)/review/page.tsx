import { ReviewLinkPage, reviewLinkMetadata } from "@plaspool/shop";

/**
 * `/review?token=…` — the review link the admin copies from an order. The
 * admin builds this exact URL, so the path and the parameter name are fixed.
 *
 * `force-dynamic`: the answer is one customer's order behind a bearer token,
 * and must never be prerendered or served from the incremental cache.
 */
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  return <ReviewLinkPage token={Array.isArray(token) ? token[0] : token} />;
}

export const metadata = reviewLinkMetadata;
