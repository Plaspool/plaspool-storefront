import { describe, expect, it } from "vitest";
import {
  AVATAR_COLOURS,
  AVATAR_FOREGROUND,
  avatarColourFor,
  avatarInitial,
} from "./avatar";

/**
 * The two properties an initial-avatar has to have, and one of them is the kind
 * of thing that rots quietly.
 *
 * STABILITY, because the colour is the shorthand for "this is your account". A
 * colour that changed between devices, or between reloads, would be worse than
 * no colour: it would actively suggest a different account.
 *
 * CONTRAST, because an avatar is text on a coloured field. Left to taste, one of
 * these eventually gets added at a lightness nobody checks and becomes
 * unreadable for exactly the people who most need it not to be. The ratios are
 * computed here so the build fails rather than a person having to notice.
 */

function relativeLuminance(hex: string): number {
  const channel = (pair: string) => {
    const v = parseInt(pair, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const r = channel(hex.slice(1, 3));
  const g = channel(hex.slice(3, 5));
  const b = channel(hex.slice(5, 7));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [l1, l2] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

describe("the palette", () => {
  it.each(AVATAR_COLOURS)("%s clears WCAG AA against the foreground", (colour) => {
    // 4.5:1 — normal-size text. The initial is 12px semibold, which is not
    // "large text" under WCAG (that starts at 18.66px bold / 24px regular), so
    // the stricter threshold is the applicable one rather than the cautious one.
    expect(contrast(colour, AVATAR_FOREGROUND)).toBeGreaterThanOrEqual(4.5);
  });

  it("is all well-formed six-digit hex, since the ratio maths assumes it", () => {
    for (const colour of AVATAR_COLOURS) expect(colour).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(AVATAR_FOREGROUND).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});

describe("avatarColourFor", () => {
  it("gives one person the same colour every time", () => {
    const key = "cus_msztixfxf6c90c5b787c4fcf";
    expect(avatarColourFor(key)).toBe(avatarColourFor(key));
  });

  it("always lands inside the palette, including for empty input", () => {
    for (const key of ["", "a", "cus_1", "shopper@example.test", "🙂"]) {
      expect(AVATAR_COLOURS).toContain(avatarColourFor(key));
    }
  });

  it("separates keys that differ in one character", () => {
    /*
     * The realistic input is ids from one generator and emails at one domain —
     * strings that are nearly identical. A hash that ignored the tail would put
     * a whole shop on one colour, which is the failure mode worth guarding.
     */
    const spread = new Set(
      ["cus_00001", "cus_00002", "cus_00003", "cus_00004", "cus_00005", "cus_00006"].map(
        avatarColourFor,
      ),
    );
    expect(spread.size).toBeGreaterThan(1);
  });
});

describe("avatarInitial", () => {
  it("prefers the name", () => {
    expect(avatarInitial("Adaeze Okonkwo", "someone@example.test")).toBe("A");
  });

  it("falls back to the email when there is no name", () => {
    expect(avatarInitial(null, "zoe@example.test")).toBe("Z");
    expect(avatarInitial("   ", "zoe@example.test")).toBe("Z");
  });

  it("never renders empty", () => {
    // A person with neither is a data state, not an excuse for a blank circle.
    expect(avatarInitial(null, "")).toBe("·");
  });

  it("takes one whole grapheme, not half a surrogate pair", () => {
    // `"🙂"[0]` is a lone high surrogate, which renders as a replacement glyph.
    expect(avatarInitial("🙂 Zoe", "z@example.test")).toBe("🙂");
  });

  it("uppercases", () => {
    expect(avatarInitial("adaeze", "a@example.test")).toBe("A");
  });
});
