// The chrome components are default exports, so they are re-exported by name —
// `export *` does not carry a module's default binding.
export { default as Nav } from "./chrome/nav";
export { default as Footer } from "./chrome/footer";
export * from "./chrome/mobile-nav";
export { default as BackButton } from "./chrome/back";
export { default as ContactPage } from "./pages/contact";
export { default as ShippingPolicy } from "./pages/shipping";
export { default as PlaspoolLanding } from "./pages/landing";
export * from "./menu";
export * from "./consent";
// `./mail` is deliberately NOT re-exported here. The sendmail route handler is
// server-only; pulling it through this barrel would drag every client component
// and the consent stylesheet into that bundle. Import "@plaspool/web/mail".
