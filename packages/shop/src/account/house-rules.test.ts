import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * THE RULES THAT ARE ONLY ENFORCEABLE BY GREP.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Every check here guards a defect that ALREADY SHIPPED, was found by
 * measurement rather than by reading, and would come back the moment somebody
 * writes a plausible-looking line in a new file. None of them is reachable from
 * a rendered assertion, because the thing that is wrong is a CHOICE OF TOKEN or
 * a CHOICE OF CHARACTER — the markup renders, the types check, the lint passes,
 * and the pixels are wrong.
 *
 * The admin repo enforces its own no-hardcoded-labels rule exactly this way
 * (`server/marketing/no-hardcoded-labels.test.ts`), and for the same reason.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const HERE = join(__dirname);
const SHOP = join(__dirname, "..");
/** `packages/ui/src` — a sibling PACKAGE, reached deliberately. The note on the
 *  destructive rules below says why one file polices both. */
const UI = join(__dirname, "..", "..", "..", "ui", "src");

function sourcesIn(dir: string): { path: string; text: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = join(dir, e.name);
    if (e.isDirectory()) return sourcesIn(full);
    if (!/\.tsx?$/.test(e.name) || /\.test\.tsx?$/.test(e.name)) return [];
    return [{ path: full, text: withoutComments(readFileSync(full, "utf8")) }];
  });
}

/**
 * The file with every comment blanked, LINE NUMBERS PRESERVED.
 *
 * ═══ WITHOUT THIS, EVERY GUARD BELOW FAILS ON ITS OWN DOCUMENTATION ═══
 * The first cut skipped lines beginning `*` or `//`, which is most of a block
 * comment and not all of it: a continuation line starting with a backtick, and
 * every `{/* … *\/}` in JSX, sailed through. The rules here are precisely the
 * ones that get explained at length at the site that used to break them, so a
 * scanner that reads prose reports the explanation as the offence.
 *
 * Comments are replaced with spaces rather than deleted so a reported line
 * number still points at the right line in the real file.
 */
function withoutComments(src: string): string {
  /** Every character except a newline becomes a space, so line numbers hold. */
  const blank = (m: string) => m.replace(/[^\n]/g, " ");
  return (
    src
      .replace(/\/\*[\s\S]*?\*\//g, blank)
      /* `[^:]` in front so a `//` inside `https://…` is not read as a comment —
         this file's own sources carry URLs in strings. */
      .replace(/(^|[^:])\/\/[^\n]*/g, (m, lead: string) => lead + blank(m.slice(lead.length)))
  );
}

describe("a skeleton bar never carries a collapsible space", () => {
  /*
   * ═══ THE ONE THAT COST THE MOST ═══
   * The idiom for "a bar as tall as the line it stands in for" is a `Skeleton`
   * holding a NO-BREAK space: an empty one has no line box and collapses to
   * zero height, and so does one holding a plain ASCII space, because CSS
   * discards a lone collapsible space.
   *
   * Written by hand twelve times, it was already wrong in EIGHT — and the two
   * spellings are indistinguishable in every diff, every review and every
   * editor. Measured fallout before the fix: a rewards ledger row 36px short of
   * the row it stood in for, on every row; the balance panel 44px short; four
   * account-hub rows 16px each.
   *
   * `TextSkeleton` in `@plaspool/ui` now owns the character, so this asserts
   * that nobody has gone back to typing it.
   */
  it("uses TextSkeleton rather than a hand-typed spacer", () => {
    const offenders: string[] = [];
    for (const { path, text } of sourcesIn(SHOP)) {
      text.split("\n").forEach((line, i) => {
        if (/<Skeleton\b[^>]*>\s*\{"\s*"\}/.test(line) || /<Skeleton\b[^>]*>\s*\{" "\}/.test(line)) {
          offenders.push(`${path}:${i + 1}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});

describe("the red that is read is never the red that is filled", () => {
  /*
   * `--destructive` is tuned as a BUTTON FILL — white text on it — and measures
   * **3.76:1 against white** as text, under the 4.5:1 WCAG 2.1 AA requires
   * below 18.66px. It is the colour of every "something went wrong" line in the
   * shop: the one string a shopper must be able to read at the moment they most
   * need it.
   *
   * This was found once, fixed in ONE file by hardcoding `text-red-700`, and
   * left failing in eleven siblings — "the instance fixed, the sibling left",
   * which is the defect this package's ledger keeps recording. There is now a
   * token (`--destructive-strong`, 6.47:1 on white, 5.86:1 on the tinted
   * panel), and this holds every screen in the shop to it.
   *
   * ═══ WHY ONE FILE REACHES INTO A SIBLING PACKAGE ═══
   * This was scoped to `account/` when it was written, because the checkout,
   * the review form and the cart drawer still carried the defect and were
   * outside the change that added it. They have since been migrated, and the
   * glob widened with them: `packages/shop/src` AND `packages/ui/src`.
   *
   * The UI half is not incidental. `FormMessage` in `@plaspool/ui` is the
   * primitive every future form error inherits from, so the failing spelling
   * sitting there outweighs any one screen carrying it — and a guard that
   * stopped at the package boundary would report "clean" while the shared
   * component shipped the defect to its next consumer. That is the failure
   * above one level up. One grep, one answer, everywhere.
   *
   * `bg-destructive` is untouched by both rules and must stay that way: as a
   * FILL the base token is correct, which is what `button`, `badge` and the
   * checkout's tinted error banner use it for. Only the read spellings —
   * `text-` and `border-` — are the defect. The `(?!-)` is what keeps
   * `text-destructive-foreground` (white ON the fill) out of the net.
   */
  it("never uses `text-destructive` as body text or as a hairline", () => {
    const offenders: string[] = [];
    for (const { path, text } of [...sourcesIn(SHOP), ...sourcesIn(UI)]) {
      text.split("\n").forEach((line, i) => {
        if (/\btext-destructive\b(?!-)/.test(line) || /\bborder-destructive\b(?!-)/.test(line)) {
          offenders.push(`${path}:${i + 1}  ${line.trim().slice(0, 80)}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it("never hardcodes a raw Tailwind red either", () => {
    /* `text-red-700` was the hand-picked correct colour. It IS the token's
       value, so this is not about the pixels — it is about there being one
       spelling, so the next grep finds every site. */
    const offenders: string[] = [];
    for (const { path, text } of [...sourcesIn(SHOP), ...sourcesIn(UI)]) {
      text.split("\n").forEach((line, i) => {
        if (/\b(?:text|border|bg)-red-\d{3}\b/.test(line)) offenders.push(`${path}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});

describe("the account area has one page box, not eight", () => {
  /*
   * There were five private `Shell` components and three inlined `<div>`s in
   * three spellings, and one had already drifted: `/account/orders` carried 64px
   * of top padding below `sm` where every other account screen carried 48px, so
   * tapping a row moved the content 16px on a phone between two pages in the
   * same flow. `AccountShell` owns it now.
   */
  it("declares no container of its own", () => {
    const offenders: string[] = [];
    for (const { path, text } of sourcesIn(HERE)) {
      if (path.endsWith("account-shell.tsx")) continue;
      text.split("\n").forEach((line, i) => {
        if (/mx-auto[^"']*\bmax-w-(?:2xl|3xl)\b/.test(line)) offenders.push(`${path}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});

describe("no points or unit noun is spelled in this package", () => {
  /*
   * `data/marketing.ts` sets the rule out at length: an operator can rename the
   * programme, the admin enforces on its own side that no screen spells the
   * words itself, and a storefront that hardcoded them would be the one surface
   * still using the old name after a rename.
   *
   * The nouns below are the ones the live programme currently uses. A file that
   * spells one has stopped reading the API and started remembering it.
   */
  it("never writes a programme's nouns into source", () => {
    const NOUNS = /\b(?:Spool Points?|SpoolPoints)\b/;
    const offenders: string[] = [];
    for (const { path, text } of sourcesIn(SHOP)) {
      text.split("\n").forEach((line, i) => {
        if (NOUNS.test(line)) offenders.push(`${path}:${i + 1}  ${line.trim().slice(0, 70)}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
