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

/**
 * CIEDE2000 — perceptual difference, not Euclidean distance in sRGB.
 *
 * The naive version calls two dark blues far apart and two mid greens close
 * together, which is the opposite of what an eye does. This is the standard
 * formula; it is long, and it is the reason the assertion below means anything.
 */
function toLab(hex: string): [number, number, number] {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const r = lin(parseInt(hex.slice(1, 3), 16));
  const g = lin(parseInt(hex.slice(3, 5), 16));
  const b = lin(parseInt(hex.slice(5, 7), 16));
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function deltaE2000(hexA: string, hexB: string): number {
  const [l1, a1, b1] = toLab(hexA);
  const [l2, a2, b2] = toLab(hexB);
  const rad = (d: number) => (d * Math.PI) / 180;
  const deg = (r: number) => (r * 180) / Math.PI;
  const c1 = Math.hypot(a1, b1);
  const c2 = Math.hypot(a2, b2);
  const cBar = (c1 + c2) / 2;
  const g = 0.5 * (1 - Math.sqrt(cBar ** 7 / (cBar ** 7 + 25 ** 7)));
  const a1p = (1 + g) * a1;
  const a2p = (1 + g) * a2;
  const c1p = Math.hypot(a1p, b1);
  const c2p = Math.hypot(a2p, b2);
  const h1p = (deg(Math.atan2(b1, a1p)) + 360) % 360;
  const h2p = (deg(Math.atan2(b2, a2p)) + 360) % 360;
  const dLp = l2 - l1;
  const dCp = c2p - c1p;
  const dhp = c1p * c2p === 0 ? 0 : (((h2p - h1p + 180) % 360) - 180);
  const dHp = 2 * Math.sqrt(c1p * c2p) * Math.sin(rad(dhp) / 2);
  const lBar = (l1 + l2) / 2;
  const cBarP = (c1p + c2p) / 2;
  let hBarP = c1p * c2p === 0 ? h1p + h2p : (h1p + h2p) / 2;
  if (c1p * c2p !== 0 && Math.abs(h1p - h2p) > 180) hBarP += 180;
  const t =
    1 -
    0.17 * Math.cos(rad(hBarP - 30)) +
    0.24 * Math.cos(rad(2 * hBarP)) +
    0.32 * Math.cos(rad(3 * hBarP + 6)) -
    0.2 * Math.cos(rad(4 * hBarP - 63));
  const sL = 1 + (0.015 * (lBar - 50) ** 2) / Math.sqrt(20 + (lBar - 50) ** 2);
  const sC = 1 + 0.045 * cBarP;
  const sH = 1 + 0.015 * cBarP * t;
  const rT =
    -2 *
    Math.sqrt(cBarP ** 7 / (cBarP ** 7 + 25 ** 7)) *
    Math.sin(rad(60 * Math.exp(-(((hBarP - 275) / 25) ** 2))));
  return Math.sqrt(
    (dLp / sL) ** 2 + (dCp / sC) ** 2 + (dHp / sH) ** 2 + rT * (dCp / sC) * (dHp / sH),
  );
}

describe("the palette", () => {
  it.each(AVATAR_COLOURS)("%s clears WCAG AA against the foreground", (colour) => {
    // 4.5:1 — normal-size text. The initial is 12px semibold, which is not
    // "large text" under WCAG (that starts at 18.66px bold / 24px regular), so
    // the stricter threshold is the applicable one rather than the cautious one.
    expect(contrast(colour, AVATAR_FOREGROUND)).toBeGreaterThanOrEqual(4.5);
  });

  it("is colours a person can actually tell apart", () => {
    /*
     * ═══ THE PROPERTY THE FIRST CUT FORGOT ═══
     * Contrast against white was tested; mutual separation was not. Two of the
     * eight — "deep teal" #12626B and "pine" #0F5257 — were ΔE 5.5 apart, which
     * at 28px is not a difference anybody can see. A colour that cannot be told
     * from another colour identifies nothing, which is the entire job.
     *
     * ΔE 10 is the conventional "clearly different at a glance" line. This
     * palette's tightest pair is comfortably past it, so the assertion has room
     * before it starts failing on a rounding change — and it fails immediately
     * if somebody adds a near-duplicate.
     */
    const pairs: { a: string; b: string; de: number }[] = [];
    for (let i = 0; i < AVATAR_COLOURS.length; i += 1) {
      for (let j = i + 1; j < AVATAR_COLOURS.length; j += 1) {
        pairs.push({
          a: AVATAR_COLOURS[i],
          b: AVATAR_COLOURS[j],
          de: deltaE2000(AVATAR_COLOURS[i], AVATAR_COLOURS[j]),
        });
      }
    }
    const tightest = pairs.reduce((min, p) => (p.de < min.de ? p : min));
    expect(
      tightest.de,
      `${tightest.a} and ${tightest.b} are only ΔE ${tightest.de.toFixed(1)} apart`,
    ).toBeGreaterThan(10);
  });

  it("does not include the brand accent, which is also the focus ring", () => {
    // One shopper in eight would carry an avatar the same colour as the chrome.
    expect(AVATAR_COLOURS).not.toContain("#231C50");
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
