import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { apiBaseForHost, ENV, ENVIRONMENTS, resolveTarget, type Target } from "./environment";

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
   * `NEXT_PUBLIC_PLASPOOL_TARGET` is what `next.config.ts` inlines into BOTH bundles so the
   * browser is told the answer rather than deriving it. The branch variable
   * does not exist in the browser, so if it were read first the client would
   * always resolve to production — and `cart-api.ts` runs in the browser. See
   * the long note in `environment.ts`.
   */
  it("prefers the inlined target over the branch", () => {
    expect(
      resolveTarget({ NEXT_PUBLIC_PLASPOOL_TARGET: "development", WORKERS_CI_BRANCH: "master" }),
    ).toBe("development");
  });

  it("lets the inlined target pin production even on develop", () => {
    expect(
      resolveTarget({ NEXT_PUBLIC_PLASPOOL_TARGET: "production", WORKERS_CI_BRANCH: "develop" }),
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
      resolveTarget({ NEXT_PUBLIC_PLASPOOL_TARGET: "staging", WORKERS_CI_BRANCH: "develop" }),
    ).toBe("development");
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE SOURCE-TEXT GUARD, BECAUSE THE BUG THIS CATCHES IS INVISIBLE TO EVERY
 * BEHAVIOURAL TEST ABOVE.
 *
 * `resolveTarget()` was correct the whole time it was broken. Every assertion
 * in this file passed while `dev.plaspool.com` was calling the PRODUCTION API
 * from the browser, because the defect was not in the logic — it was that the
 * logic ran at all. A bundler inlines by replacing the exact source text
 * `process.env.NEXT_PUBLIC_PLASPOOL_TARGET`; route the read through a function
 * parameter and there is nothing to replace, so the client shipped a live
 * lookup against a `process.env` shim that only carries `NEXT_PUBLIC_*`, got
 * `undefined`, and fell to production.
 *
 * A unit test cannot see that. It calls the function directly and passes an
 * object, which is precisely the shape that defeats the bundler. So this reads
 * the FILE, and asserts the one line that has to survive refactoring.
 * ═══════════════════════════════════════════════════════════════════════════
 */
describe("the inlined literal", () => {
  const source = readFileSync(new URL("./environment.ts", import.meta.url), "utf8");

  it("reads process.env.NEXT_PUBLIC_PLASPOOL_TARGET as literal source text", () => {
    expect(source).toContain("process.env.NEXT_PUBLIC_PLASPOOL_TARGET");
  });

  /*
   * `TARGET` must not be a bare `resolveTarget()` call. That was the shipped
   * bug: correct on the server, silently production in the browser.
   */
  it("does not derive TARGET from a call alone", () => {
    expect(source).not.toMatch(/export const TARGET:\s*Target\s*=\s*resolveTarget\(\)/);
  });

  /*
   * The prefix is what makes it reach the client under Turbopack. An
   * unprefixed name is replaced with `undefined` in client code rather than
   * with its value — the same silent fallback, one rename away.
   */
  it("keeps the NEXT_PUBLIC_ prefix that makes it reach the browser", () => {
    expect(source).not.toMatch(/process\.env\.PLASPOOL_TARGET\b/);
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE HOSTNAME CROSS-CHECK — the layer that does not depend on the bundler.
 *
 * Every other mechanism here is a build-time decision, and a build-time
 * decision shipped wrong once: the browser fell back to `production` on
 * `dev.plaspool.com` and posted carts to the live API. These assertions are
 * about the property that made that possible being gone — the answer now comes
 * from the host serving the page, which cannot disagree with itself.
 * ═══════════════════════════════════════════════════════════════════════════
 */
describe("apiBaseForHost", () => {
  it.each([
    ["plaspool.com", ENVIRONMENTS.production.api],
    ["www.plaspool.com", ENVIRONMENTS.production.api],
    ["dev.plaspool.com", ENVIRONMENTS.development.api],
  ])("serves %s from %s", (hostname, expected) => {
    expect(apiBaseForHost(hostname)).toBe(expected);
  });

  /*
   * ⚠  THE ASSERTION THE SHIPPED BUG WOULD HAVE FAILED. Whatever the build
   * decided, a page on dev.plaspool.com must never talk to the production API.
   */
  it("never sends the development host to the production API", () => {
    expect(apiBaseForHost("dev.plaspool.com")).not.toBe(ENVIRONMENTS.production.api);
  });

  /*
   * An unknown host keeps the build's answer rather than guessing. Mapping it
   * to production "because most hosts are" would reintroduce a silent wrong
   * answer through the back door.
   */
  it.each([
    "localhost",
    "plaspool-storefront-dev.uririnathaniel.workers.dev",
    "some-preview.example",
  ])("falls back to the build's answer on %s", (hostname) => {
    expect(apiBaseForHost(hostname)).toBe(ENV.api);
  });

  it.each([null, undefined, ""])("falls back when there is no hostname (%s)", (hostname) => {
    expect(apiBaseForHost(hostname)).toBe(ENV.api);
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
