import { WaitlistEmbed } from "./waitlist-embed";

/**
 * `/waitlist` — where the signup form lives now that `/shop` is the gateway
 * into the store.
 *
 * One page, one action. The form is the only thing on it that does anything,
 * so nothing else competes with it: no hero image, no secondary call to
 * action, and no link out to the shop, which would contradict a page whose
 * premise is that the shop has not opened yet.
 *
 * The page it replaces led with a slate-to-blue gradient and a dark band. Both
 * are gone rather than ported — on this store the only colour on a page comes
 * from a filament, and the chrome is brand navy and the neutral tokens.
 *
 * A `<div>` and not a `<main>`: the app's root layout already wraps every
 * route in `<main id="content">`, which is the skip link's target. A second
 * one here would nest the landmark and give the page two of them.
 */
export function WaitlistPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="font-sans text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Join the waitlist
        </h1>
        <p className="max-w-xl text-base leading-7 text-muted-foreground">
          We make 3D printing filament in Nigeria and ship nationwide and
          worldwide. Add your email and we will tell you the day the shop
          opens.
        </p>
      </div>

      <div className="mt-10">
        <WaitlistEmbed />
      </div>
    </div>
  );
}
