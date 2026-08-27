import { notFound } from "next/navigation"

// TEMPORARILY HIDDEN. The shipping policy page renders as low-contrast body
// text on the dark band and is not legible, so the route is taken out of
// service until it is redesigned. The links into it are commented out in
// `packages/web/src/chrome/footer.tsx`, `packages/shop/src/chrome/shop-footer.tsx`
// and `packages/shop/src/home/rewards-band.tsx`; `ShippingPolicy` itself is
// still exported from `@plaspool/web` and still previewable in the package's
// dev harness at `packages/web/dev/app/shipping`.
//
// import { ShippingPolicy } from "@plaspool/web"
//
// export default function ShippingPage() {
//   return <ShippingPolicy />
// }

export default function ShippingPage() {
  notFound()
}
