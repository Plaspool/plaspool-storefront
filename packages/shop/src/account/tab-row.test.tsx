import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { TabRow } from "./tab-row";

/**
 * THE TAB ROW'S TWO REGRESSIONS, PINNED.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * BOTH OF THESE SHIPPED, IN TWO HAND-COPIED CLASS STRINGS, AND WERE ONLY
 * REACHABLE ON ONE OF THE TWO PAGES. That is why the row is one component now,
 * and why these assertions are on the component rather than on either caller.
 *
 *   1. `first:pl-0` MATCHED EVERY TAB. Tailwind's `first:` compiles to
 *      `:first-child`, and each tab's `<a>` is the only child of its own
 *      `<li>` — so every anchor is a first child. Both tabs lost their left
 *      padding and butted together into what read as one control. Measured
 *      `padding-left: 0px` on both in a browser; asserted here as "exactly one
 *      tab omits the left padding, and it is the first".
 *
 *   2. THE LABELS ELLIPSISED AT 320px. "Ongoing & delivered" needs 137px of
 *      text at `text-sm`; 320px leaves 288px for the pair and the padding put
 *      them 4px over each, so `truncate` did what it was told. The type steps
 *      down instead. A test cannot measure that — the width check lives on
 *      `/dev/account` — but it CAN pin the thing that made the fix safe: the
 *      label a screen reader announces is the same string at every width. The
 *      obvious alternative fix was a `sm:`-hidden suffix, which would have made
 *      the accessible name depend on the viewport.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const ITEMS = [
  { key: "ongoing", label: "Ongoing & delivered", href: "/account/orders" },
  { key: "stopped", label: "Cancelled & refunded", href: "/account/orders?show=stopped" },
];

const render = (current: string) =>
  renderToStaticMarkup(<TabRow label="Which orders" items={ITEMS} current={current} />);

/** Every tab's class attribute, in document order. */
function tabClasses(html: string): string[] {
  return [...html.matchAll(/<a[^>]*class="([^"]*)"/g)].map((m) => m[1]!);
}

/**
 * Every tab as `{ attrs, text }`, in document order.
 *
 * A PARSER RATHER THAN `indexOf`, because the first cut of this file asserted
 * "no `aria-current` before the second tab's `href`" and failed on correct
 * markup: React emits `aria-current` BEFORE `href`, so the mark on the second
 * tab sits earlier in the string than the href used to locate it. A positional
 * assertion over generated markup is testing the renderer's attribute order.
 */
function tabs(html: string): { attrs: string; text: string }[] {
  return [...html.matchAll(/<a([^>]*)>(.*?)<\/a>/g)].map((m) => ({
    attrs: m[1]!,
    text: unescape(m[2]!),
  }));
}

/** `&` reaches the markup as `&amp;`, and both tab labels contain one. */
function unescape(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&quot;/g, '"');
}

describe("the tab row's spacing", () => {
  it("omits the left padding on the first tab and on no other", () => {
    const classes = tabClasses(render("ongoing"));
    expect(classes).toHaveLength(ITEMS.length);
    /* The first tab's text starts on the page's own left margin. */
    expect(classes[0]).toMatch(/(^|\s)pr-3\b/);
    expect(classes[0]).not.toMatch(/(^|\s)px-3\b/);
    expect(classes[0]).not.toMatch(/(^|\s)pl-\d/);
    /* Every other tab is spaced from its neighbour on BOTH sides. */
    for (const cls of classes.slice(1)) expect(cls).toMatch(/(^|\s)px-3\b/);
  });

  it("does not decide spacing with `:first-child`", () => {
    /* THE ACTUAL BUG, ASSERTED DIRECTLY. Each anchor is the only child of its
       own `<li>`, so any `first:` variant applies to all of them. A
       reimplementation that reintroduces one passes every other check in this
       file and fails this one. */
    expect(render("ongoing")).not.toContain("first:");
  });

  it("puts the selected tab's underline on the row's own rule", () => {
    /* `-mb-px` pulls the 2px mark over the 1px hairline so the two occupy one
       edge; without it the selected tab sits on a 3px band and the row looks
       like it has two rules of different weights. */
    for (const cls of tabClasses(render("ongoing"))) expect(cls).toContain("-mb-px");
  });
});

describe("the tab row's labels", () => {
  it("announces the same label at every width", () => {
    /* No `sm:hidden`/`sm:inline` inside a tab: a label that changes with the
       viewport changes the accessible name with it. The type may step; the
       words may not. */
    const rendered = tabs(render("ongoing"));
    expect(rendered.map((t) => t.text)).toEqual(ITEMS.map((i) => i.label));
    /* No breakpoint-hidden fragment inside a label — that is the fix that was
       rejected, and this is what stops it coming back. */
    expect(render("ongoing")).not.toMatch(/<a[^>]*>[^<]*<span[^>]*class="[^"]*hidden/);
  });

  it("steps the type down rather than shortening the words", () => {
    for (const cls of tabClasses(render("ongoing"))) {
      expect(cls).toContain("text-xs");
      expect(cls).toContain("sm:text-sm");
    }
  });

  it("clips rather than wraps if it ever runs out of room", () => {
    /* `truncate` is unreachable at every width this shop renders at, and it
       stays: a tab that wrapped to two lines would make the row taller than the
       rule under it. */
    for (const cls of tabClasses(render("ongoing"))) expect(cls).toContain("truncate");
  });
});

describe("the tab row's semantics", () => {
  it("marks exactly one tab as the current page", () => {
    const rendered = tabs(render("stopped"));
    const marked = rendered.filter((t) => t.attrs.includes('aria-current="page"'));
    expect(marked).toHaveLength(1);
    /* And it is the RIGHT one — the mark has to follow `current`, not the first
       tab, which is the bug a hardcoded index would produce. */
    expect(marked[0]!.text).toBe(ITEMS[1]!.label);
    expect(marked[0]!.attrs).toContain(ITEMS[1]!.href);
  });

  it("names the row for assistive tech", () => {
    /* "Which orders", not "Tabs" — a landmark whose label describes the widget
       rather than the choice tells a screen-reader user nothing. */
    expect(render("ongoing")).toContain('aria-label="Which orders"');
  });

  it("is links, not an ARIA tablist", () => {
    /* The tabs pattern describes panels swapped by script and obliges roving
       arrow-key focus and a labelled `tabpanel`. These are navigations, so they
       are links; claiming the role without the keyboard contract is worse than
       not claiming it. */
    const html = render("ongoing");
    expect(html).not.toContain('role="tab"');
    expect(html).not.toContain('role="tablist"');
    expect((html.match(/<a\b/g) ?? []).length).toBe(ITEMS.length);
  });

  it("gives every tab a visible focus ring", () => {
    for (const cls of tabClasses(render("ongoing"))) {
      expect(cls).toContain("focus-visible:ring-2");
    }
  });
});
