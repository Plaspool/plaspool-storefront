import { ReturnRequestPage, returnRequestMetadata } from "@plaspool/shop";

/**
 * `/returns` — the no-JS target of Task 10's intercepting CTA, and a real
 * page in its own right.
 *
 * No `force-dynamic`: see `ReturnRequestPage`'s own header. Both of its reads
 * are public and cacheable, unlike `/account/rewards`'s cookie-identified
 * ones, and the form itself fetches nothing on the server.
 */
export default function Page() {
  return <ReturnRequestPage />;
}

export const metadata = returnRequestMetadata;
