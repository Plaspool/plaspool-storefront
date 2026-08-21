import { describe, expect, it } from "vitest";

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

  it.each(["/account", "/api/", "/cart", "/checkout", "/dev/", "/sign-in"])(
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
