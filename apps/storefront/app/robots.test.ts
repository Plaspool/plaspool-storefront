import { describe, expect, it, vi } from "vitest";

import robots from "./robots";

/**
 * The crawl policy's one catastrophic failure mode, guarded.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * BLOCKING A SEARCH ENGINE HERE WOULD BE SILENT AND EXPENSIVE. Nothing fails,
 * no test goes red, no page changes — the shop simply stops being found, and
 * by the time that is noticed in Search Console the rankings are already gone.
 * A shop whose whole layout metadata, JSON-LD and sitemap exist to be indexed
 * cannot afford to discover that by accident.
 *
 * The subtle version of the mistake is the one worth testing, and it is a
 * PREFIX. robots.txt matches a user-agent group when the declared value is a
 * case-insensitive prefix of the crawler's own token, so `Google-Extended`
 * (training corpus only) is safe next to `Googlebot`, while a well-meaning
 * `Google` would silently swallow Googlebot, Googlebot-Image and
 * Googlebot-News in one line. The prefix assertion below is what catches that,
 * and it is the reason this file exists rather than a snapshot of the output.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Product tokens that must reach the shop, whatever else is blocked. */
const SEARCH_CRAWLERS = [
  "Googlebot",
  "Googlebot-Image",
  "Googlebot-News",
  "Bingbot",
  "Slurp",
  "DuckDuckBot",
  "Applebot",
  "YandexBot",
  "Baiduspider",
  "OAI-SearchBot",
];

const policy = robots();
const rules = Array.isArray(policy.rules) ? policy.rules : [policy.rules];

/** Every user agent named anywhere in the file. */
function agentsIn(rule: (typeof rules)[number]): string[] {
  const ua = rule.userAgent;
  if (!ua) return [];
  return Array.isArray(ua) ? ua : [ua];
}

/** Rules that shut a crawler out of the site entirely. */
const blockingRules = rules.filter((r) => {
  const d = r.disallow;
  const list = d === undefined ? [] : Array.isArray(d) ? d : [d];
  return list.includes("/");
});

const blockedAgents = blockingRules.flatMap(agentsIn);

describe("robots.txt — search engines", () => {
  it("blocks nothing with a bare wildcard user agent", () => {
    expect(blockedAgents).not.toContain("*");
  });

  it.each(SEARCH_CRAWLERS)("never blocks %s, even by prefix", (crawler) => {
    const caught = blockedAgents.filter((blocked) =>
      crawler.toLowerCase().startsWith(blocked.toLowerCase()),
    );
    expect(caught).toEqual([]);
  });

  it("keeps the -Extended training agents blocked, which is not the same thing", () => {
    // The pair that proves the prefix test above is discriminating rather than
    // vacuous: these ARE blocked, and their plain counterparts are NOT.
    expect(blockedAgents).toContain("Google-Extended");
    expect(blockedAgents).toContain("Applebot-Extended");
    expect(blockedAgents).not.toContain("Googlebot");
    expect(blockedAgents).not.toContain("Applebot");
  });
});

describe("robots.txt — the crawlers that cost without returning", () => {
  it.each(["GPTBot", "Bytespider", "CCBot", "AhrefsBot", "SemrushBot", "MJ12bot"])(
    "blocks %s",
    (crawler) => {
      expect(blockedAgents).toContain(crawler);
    },
  );
});

describe("robots.txt — everyone else", () => {
  const wildcard = rules.find((r) => agentsIn(r).includes("*"));

  it("has a wildcard rule that allows the shop", () => {
    expect(wildcard?.allow).toBe("/");
  });

  it.each(["/account", "/api/", "/cart", "/checkout", "/dev/", "/preview/", "/sign-in"])(
    "keeps %s out of the index",
    (path) => {
      const d = wildcard?.disallow;
      const list = d === undefined ? [] : Array.isArray(d) ? d : [d];
      expect(list).toContain(path);
    },
  );

  it("still points at the sitemap", () => {
    expect(policy.sitemap).toMatch(/\/sitemap\.xml$/);
  });
});

/**
 * The development deployment, which must be the exact opposite of everything
 * above.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THIS IS THE ONE PLACE THE FILE'S OWN RULE IS INVERTED, SO IT IS ALSO THE ONE
 * PLACE THE INVERSION HAS TO BE PROVEN.
 *
 * The assertions at the top of this file exist to stop anyone blocking a search
 * engine. `dev.plaspool.com` is the exception: a complete second copy of the
 * shop, pointed at another database, competing with the real store for its own
 * search terms. Blocking it is correct, and the production assertions above
 * still hold because `resolveTarget()` defaults to production under the test
 * runner, where no branch variable is set.
 *
 * Mocked rather than parameterised because `ENV` is a module constant read at
 * import time — which is what makes it a build-time decision the client cannot
 * disagree with, and therefore not something the route can be asked to
 * recompute.
 * ═══════════════════════════════════════════════════════════════════════════
 */
describe("robots.txt — a deployment that must not be indexed", () => {
  async function devPolicy() {
    vi.resetModules();
    vi.doMock("@plaspool/brand", () => ({
      ENV: {
        site: "https://dev.plaspool.com",
        api: "https://admin.dev.plaspool.com",
        indexable: false,
      },
      siteConfig: {
        site_name: "PlaSpool",
        site_description: "",
        site_domain: "https://dev.plaspool.com",
      },
    }));
    const { default: devRobots } = await import("./robots");
    vi.doUnmock("@plaspool/brand");
    return devRobots();
  }

  it("shuts out every crawler with a wildcard rule", async () => {
    const dev = await devPolicy();
    const devRules = Array.isArray(dev.rules) ? dev.rules : [dev.rules];
    const wildcard = devRules.find((r) => agentsIn(r).includes("*"));

    expect(wildcard?.disallow).toBe("/");
  });

  /*
   * A `Sitemap:` line on a host nobody should crawl hands the crawler the full
   * URL list it was just asked not to fetch.
   */
  it("advertises no sitemap", async () => {
    const dev = await devPolicy();
    expect(dev.sitemap).toBeUndefined();
  });

  /*
   * The production policy must be unaffected by the mock above — if resetting
   * modules leaked, the assertions at the top of this file would be testing the
   * development policy without saying so.
   */
  it("leaves the production policy still allowing the shop", () => {
    expect(blockedAgents).not.toContain("*");
  });
});
