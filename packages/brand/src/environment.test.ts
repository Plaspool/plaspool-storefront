import { describe, expect, it } from "vitest";

import { ENVIRONMENTS, resolveTarget, type Target } from "./environment";

/**
 * The environment switch, which decides which database the shop talks to.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS IS TESTED AT ALL, WHEN IT IS SIX LINES OF STRING COMPARISON.
 *
 * Every failure mode here is silent. Getting the default backwards, or reading
 * the wrong variable first, produces a build that compiles, deploys and renders
 * — and serves the wrong catalogue at the wrong prices to real shoppers, or
 * posts real orders into a development database. Nothing goes red. The only
 * signal is somebody noticing that the numbers on the page are wrong.
 *
 * So the assertions below are about DIRECTION, not arithmetic: which way an
 * unknown input falls, and which variable wins when the two disagree.
 * ═══════════════════════════════════════════════════════════════════════════
 */

describe("resolveTarget — the default direction", () => {
  /*
   * The single most important assertion in this file.
   *
   * A local `next build`, a `wrangler deploy` from a laptop, and a CI run whose
   * branch variable never arrived all land here. Falling to `production` means
   * they behave exactly as this app did before the environment switch existed.
   * Falling the other way would mean a production build with a broken variable
   * quietly points the live store at the development API.
   */
  it("is production when nothing at all is set", () => {
    expect(resolveTarget({})).toBe("production");
  });

  it("is production on master", () => {
    expect(resolveTarget({ WORKERS_CI_BRANCH: "master" })).toBe("production");
  });

  /*
   * A feature branch is NOT the development environment. Only `develop`
   * deploys there; anything else building for some other reason must not
   * silently acquire development hosts.
   */
  it("is production on an arbitrary feature branch", () => {
    expect(resolveTarget({ WORKERS_CI_BRANCH: "feat/some-work" })).toBe("production");
  });

  it("is development only on the develop branch", () => {
    expect(resolveTarget({ WORKERS_CI_BRANCH: "develop" })).toBe("development");
  });
});

describe("resolveTarget — the client/server boundary", () => {
  /*
   * `PLASPOOL_TARGET` is what `next.config.ts` inlines into BOTH bundles so the
   * browser is told the answer rather than deriving it. The branch variable
   * does not exist in the browser, so if it were read first the client would
   * always resolve to production — and `cart-api.ts` runs in the browser. See
   * the long note in `environment.ts`.
   */
  it("prefers the inlined target over the branch", () => {
    expect(
      resolveTarget({ PLASPOOL_TARGET: "development", WORKERS_CI_BRANCH: "master" }),
    ).toBe("development");
  });

  it("lets the inlined target pin production even on develop", () => {
    expect(
      resolveTarget({ PLASPOOL_TARGET: "production", WORKERS_CI_BRANCH: "develop" }),
    ).toBe("production");
  });

  /*
   * A garbled value must not be trusted as a target. It falls through to the
   * branch, which on a real build is the value that computed it in the first
   * place — so a corrupted inline degrades to the correct answer rather than to
   * an undefined one.
   */
  it("ignores an unrecognised inlined value and falls back to the branch", () => {
    expect(
      resolveTarget({ PLASPOOL_TARGET: "staging", WORKERS_CI_BRANCH: "develop" }),
    ).toBe("development");
  });
});

describe("the environment table", () => {
  const targets: Target[] = ["production", "development"];

  /*
   * The two deployments must never share an API host. If they did, "development"
   * would be a second front end onto the live database — which is the single
   * outcome this whole mechanism exists to prevent.
   */
  it("gives each environment a distinct API host", () => {
    expect(ENVIRONMENTS.production.api).not.toBe(ENVIRONMENTS.development.api);
  });

  it("gives each environment a distinct site origin", () => {
    expect(ENVIRONMENTS.production.site).not.toBe(ENVIRONMENTS.development.site);
  });

  /*
   * ⚠  THE SAME-SITE REQUIREMENT, ASSERTED RATHER THAN TRUSTED.
   *
   * The cart's `__Host-` cookies are only same-site because the storefront and
   * its admin share the registrable domain `plaspool.com`. Move either onto
   * another domain and the cookies become third-party: Safari's tracking
   * prevention drops them, the session exchange 200s, and the shopper is signed
   * in according to Clerk and a guest according to the shop. That failure is
   * invisible in Chrome, which is where it would be tested.
   */
  it.each(targets)("keeps %s on the plaspool.com registrable domain", (target) => {
    const { site, api } = ENVIRONMENTS[target];
    for (const origin of [site, api]) {
      expect(new URL(origin).hostname.endsWith(".plaspool.com") ||
        new URL(origin).hostname === "plaspool.com").toBe(true);
    }
  });

  it.each(targets)("serves %s over https", (target) => {
    const { site, api } = ENVIRONMENTS[target];
    expect(new URL(site).protocol).toBe("https:");
    expect(new URL(api).protocol).toBe("https:");
  });

  /*
   * Exactly one environment may be indexed. Two indexable deployments means
   * `dev.plaspool.com` competing with the real shop for its own search terms
   * with duplicate content — see `app/robots.ts`.
   */
  it("marks exactly one environment indexable", () => {
    const indexable = targets.filter((t) => ENVIRONMENTS[t].indexable);
    expect(indexable).toEqual(["production"]);
  });
});
