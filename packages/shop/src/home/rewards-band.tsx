import { Recycle } from "lucide-react";
import { cn, controlSurface } from "@plaspool/ui";

import { getRewardsProgram, pointsLabel, unitLabel } from "../data/marketing";
import { listServiceAreas } from "../data/returns-api";
import { ReturnsCta } from "../returns/returns-cta";

/**
 * The returns programme, in the operator's own words.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * NOT ONE NOUN IN THIS FILE IS SPELLED BY THIS FILE.
 *
 * The programme's name, what a point is called, and what a unit is called all
 * come from `GET /api/public/marketing/rewards`. The admin lets an operator
 * rename any of them and enforces on its own side that no screen hardcodes them
 * (`server/marketing/no-hardcoded-labels.test.ts`); a storefront that spelled
 * "Spool Points" itself would be the one surface still using the old name after
 * a rename, so the store and the returns desk would describe different
 * programmes to the same customer.
 *
 * The consequence is that the prose here is built from fragments rather than
 * written as sentences, which reads slightly stiffer than hand-written copy. That
 * is the correct trade: a sentence that cannot go stale beats a better sentence
 * that can.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * RENDERS NOTHING WHEN NO PROGRAMME IS CONFIGURED, the rule `BlogStrip` and
 * `BulkPromo` already follow on this page. A band explaining a scheme that does
 * not exist is worse than a shorter home page, and `getRewardsProgram` answers
 * null rather than throwing when the API is unreachable — so a marketing outage
 * costs this section and nothing else.
 *
 * THE BAND CARRIES A CTA INTO THE RETURN FORM, not just a policy link. Task 11
 * put `ReturnsCta` here for the same reason the top bar carries one: this
 * section is the shop's own explanation of the arithmetic, so it is also
 * where somebody reads it and might want to act on it in the same breath.
 * `ReturnsCta` opens the request dialog for a signed-in shopper and asks a
 * guest to sign in FROM THE DIALOG rather than being refused here — this
 * component still does not read the session itself, and does not need to.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * PAINTED, AND EVERY CLASS BELOW IS COPIED FROM `BulkPromo` RATHER THAN
 * INVENTED HERE.
 *
 * This was a hairline-ruled section like `WhyShop` and `CategoryTiles`, which
 * is the right register for a page of them and the wrong one for the section
 * that has moved up to fourth precisely because it is the only offer on this
 * page a shopper cannot get from another filament shop. `bg-brand
 * text-brand-ink` is the footer's ground and `BulkPromo`'s — the store already
 * had exactly one inverted band, so this is a second instance of an existing
 * treatment rather than a new one. The eyebrow, heading, `/70` body,
 * `text-brand-ink` figures and white key are that band's, class for class, so
 * the two read as siblings.
 *
 * NO `border-b`. The ground change IS the section boundary; a `brand-line`
 * hairline on navy is a pale scratch across the bottom of a painted band.
 *
 * ═══ THE CTA IS A BUTTON NOW, AND THE COMMENT THAT ARGUED OTHERWISE WAS
 * ARGUING ABOUT AN UNPAINTED BAND ═══
 * It was an underlined link, on the rule that no home-page section raises a
 * second call to action over the product cards' own "Add to cart". That rule
 * is about `NEO_SURFACE`, the neobrutalist primary — this is
 * `controlSurface("default")`, the machined WHITE key, which is what both
 * `BulkPromo` and the marketing hero already use on brand-painted ground. It
 * is not competing with the primary; it is the only tone that clears SC
 * 1.4.11's 3:1 for a control boundary against #231c50, where the ink key
 * measures about 1.1:1. An underlined `brand-line` link on this ground was
 * the same failure in text form.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export async function RewardsBand() {
  const [program, areas] = await Promise.all([getRewardsProgram(), listServiceAreas()]);
  if (!program) return null;

  const { minUnitsPerReturn, pointsPerUnit } = program;
  const perReturn = minUnitsPerReturn * pointsPerUnit;

  return (
    <section aria-labelledby="shop-rewards" className="bg-brand text-brand-ink">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-16 lg:px-8">
        <div className="flex items-start gap-4 sm:gap-5">
          {/* `text-brand-ink`, not `text-muted-foreground`. That grey was tuned
              for a white page and on this ground is very nearly the ground
              itself. One step larger than it was, because it is now the only
              mark in the band's left margin. */}
          <Recycle
            aria-hidden="true"
            className="mt-1 h-7 w-7 shrink-0 text-brand-ink sm:h-8 sm:w-8"
          />
          <div className="min-w-0">
            {/* `BulkPromo`'s eyebrow, and the one line on this band NOT taken
                from the programme — it names the kind of offer, which
                `program.name` deliberately does not. Safe to spell here for
                exactly that reason: it is not a programme noun, so a rename in
                the admin does not strand it. */}
            <p className="font-mono text-xs uppercase tracking-widest text-brand-ink/60">
              Send spools back
            </p>
            <h2
              id="shop-rewards"
              className="mt-3 text-2xl font-bold leading-tight text-brand-ink sm:text-3xl"
            >
              {program.name}
            </h2>

            <p className="mt-4 max-w-prose text-base leading-7 text-brand-ink/70">
              {"Send back your empty "}
              {unitLabel(2, program).toLowerCase()}
              {" and earn "}
              {/* The two figures the programme is actually defined by. Mono,
                  because they are quantities — the design system's rule that a
                  measurement is never set in the body face. Full-strength
                  `text-brand-ink` against the `/70` sentence around them is
                  how `BulkPromo` picks its own figures out. */}
              <span className="font-mono font-bold tabular-nums text-brand-ink">
                {pointsPerUnit}
              </span>
              {` ${pointsLabel(pointsPerUnit, program).toLowerCase()} each. `}
              {"A return starts at "}
              <span className="font-mono font-bold tabular-nums text-brand-ink">
                {minUnitsPerReturn}
              </span>
              {` ${unitLabel(minUnitsPerReturn, program).toLowerCase()}, which is `}
              <span className="font-mono font-bold tabular-nums text-brand-ink">
                {perReturn}
              </span>
              {` ${pointsLabel(perReturn, program).toLowerCase()}.`}
            </p>

            {/* ONE CONTROL, TEMPORARILY. A "How returns work" link to
                `/shipping` sat beside this one and had been commented out
                since that page stopped being legible — see
                `apps/storefront/app/(site)/shipping/page.tsx`. The dead block
                is gone now rather than carried across the repaint, since every
                class in it described the unpainted band. When `/shipping` is
                redesigned the link comes back HERE, as a plain
                `text-brand-ink/70` underline — NOT as a second key; the
                `flex flex-wrap` row is left in place for it. */}
            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
              <ReturnsCta
                program={program}
                areas={areas ?? []}
                label="Request a pickup"
                className={cn(
                  "inline-flex h-11 items-center justify-center rounded-md px-6 text-sm font-medium",
                  /* `default` — the white key. See the header for why the ink
                     key cannot be used on this ground. */
                  controlSurface("default"),
                )}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
