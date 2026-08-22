import Link from "next/link";
import { Recycle } from "lucide-react";

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
 */
export async function RewardsBand() {
  const [program, areas] = await Promise.all([getRewardsProgram(), listServiceAreas()]);
  if (!program) return null;

  const { minUnitsPerReturn, pointsPerUnit } = program;
  const perReturn = minUnitsPerReturn * pointsPerUnit;

  return (
    <section aria-labelledby="shop-rewards" className="border-b border-brand-line">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-14 lg:px-8">
        <div className="flex items-start gap-4">
          <Recycle
            aria-hidden="true"
            className="mt-0.5 h-6 w-6 shrink-0 text-muted-foreground"
          />
          <div className="min-w-0">
            <h2
              id="shop-rewards"
              className="font-sans text-xl font-semibold text-foreground sm:text-2xl"
            >
              {program.name}
            </h2>

            <p className="mt-3 max-w-prose text-base leading-7 text-muted-foreground">
              {"Send back your empty "}
              {unitLabel(2, program).toLowerCase()}
              {" and earn "}
              {/* The two figures the programme is actually defined by. Mono,
                  because they are quantities — the design system's rule that a
                  measurement is never set in the body face. */}
              <span className="font-mono tabular-nums text-foreground">{pointsPerUnit}</span>
              {` ${pointsLabel(pointsPerUnit, program).toLowerCase()} each. `}
              {"A return starts at "}
              <span className="font-mono tabular-nums text-foreground">
                {minUnitsPerReturn}
              </span>
              {` ${unitLabel(minUnitsPerReturn, program).toLowerCase()}, which is `}
              <span className="font-mono tabular-nums text-foreground">{perReturn}</span>
              {` ${pointsLabel(perReturn, program).toLowerCase()}.`}
            </p>

            {/* TWO LINKS, NOT A BUTTON. `NEO_SURFACE` marks the one thing a
                screen most wants — this page's is the product cards' own "Add
                to cart" — and no section of the home page raises a second one
                over it. `ReturnsCta` is styled identically to the policy link
                beside it: same underline, same weight, same restrained
                register the rest of this band already keeps. */}
            <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <Link
                href="/shipping"
                className="underline decoration-brand-line underline-offset-4 hover:decoration-foreground"
              >
                How returns work
              </Link>
              <ReturnsCta
                program={program}
                areas={areas ?? []}
                label="Request a pickup"
                className="underline decoration-brand-line underline-offset-4 hover:decoration-foreground"
              />
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
