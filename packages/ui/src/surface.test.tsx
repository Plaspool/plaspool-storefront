import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { Button } from "./primitives/button";
import { DEFAULT_BUTTON_SURFACE, controlSurface } from "./surface";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS CAN AND CANNOT PROVE — the same disclaimer the shop's component
 * tests carry. `renderToStaticMarkup` has no CSS engine and no layout: it
 * cannot see that the bevel's three inset shadows land, that the press travels
 * a full pixel with no transition, that the focus outline survives, or that
 * #303030 clears 3:1 against the ground it is painted on. All of that was
 * measured in a browser — `getComputedStyle` read inside a real `mousedown`,
 * and an audit of every `.mach` element on twenty routes.
 *
 * What a test CAN pin is what would be wrong in the BYTES, and there are two
 * things here that would be, both of them silent:
 *
 *   THE FOUR BEVEL-KILLERS. `ring-2` compiles to a box-shadow and so does the
 *     bevel, `transition-colors` replaces the transition property list, and
 *     `disabled:opacity-50` smears three inset shadows into grey. Each is a
 *     class shadcn's base string wants to add back, none of them is visible in
 *     a screenshot of a resting button, and `ring-2` in particular only shows
 *     itself to a keyboard user mid-tab.
 *
 *   THE EXCEPTION LIST. The architecture's whole claim is that DOING NOTHING
 *     FOLLOWS THE FLAG and that being excused has to be typed out on purpose.
 *     That claim is only true while the exception list stays exactly the three
 *     product-purchase CTAs the owner named, so the list is asserted rather
 *     than trusted.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const REPO = join(__dirname, "..", "..", "..");

function sourceFiles(): string[] {
  const out: string[] = [];
  const skip = new Set([
    "node_modules", ".next", ".open-next", ".wrangler", ".git", ".claude", "dist",
  ]);
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (skip.has(entry)) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      // Tests are excluded: this file names both things it scans for.
      else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
    }
  };
  walk(join(REPO, "packages"));
  walk(join(REPO, "apps"));
  return out;
}

describe("controlSurface", () => {
  it("resolves every tone under both surfaces", () => {
    expect(controlSurface("primary", "machined")).toBe("mach mach--primary");
    expect(controlSurface("default", "machined")).toBe("mach mach--default");
    expect(controlSurface("plain", "machined")).toBe("mach mach--plain");
    expect(controlSurface("critical", "machined")).toBe("mach mach--critical");

    expect(controlSurface("primary", "neo")).toContain("bg-brand");
    expect(controlSurface("primary", "neo")).toContain("border-2 border-foreground");
  });

  it("follows the flag when no surface is named, and only then", () => {
    expect(controlSurface("primary")).toBe(controlSurface("primary", DEFAULT_BUTTON_SURFACE));
    // An explicit argument is the ONLY thing that beats the flag.
    expect(controlSurface("primary", "neo")).not.toBe(controlSurface("primary", "machined"));
  });

  it("keeps the neobrutalist stroke off `plain`", () => {
    // `neo.ts` reserves its treatment for one real call to action per screen.
    // A `plain` control is the opposite of that by definition, and putting the
    // stroke here framed every icon button in the shop nav.
    expect(controlSurface("plain", "neo")).not.toContain("border-2");
    expect(controlSurface("plain", "neo")).not.toContain("shadow-[4px_4px");
  });
});

describe("<Button> follows the flag by doing nothing", () => {
  const render = (el: React.ReactElement) => renderToStaticMarkup(el);

  it("derives a tone from `variant`, so an untouched call site is reskinned", () => {
    expect(render(<Button>Pay now</Button>)).toContain("mach mach--primary");
    expect(render(<Button variant="outline">Back</Button>)).toContain("mach mach--default");
    expect(render(<Button variant="ghost">Remove</Button>)).toContain("mach mach--plain");
    expect(render(<Button variant="destructive">Delete</Button>)).toContain("mach mach--critical");
  });

  it("leaves `variant=\"link\"` alone — a text link is not a key", () => {
    const html = render(<Button variant="link">Terms</Button>);
    expect(html).not.toContain("mach");
    expect(html).toContain("underline-offset-4");
  });

  it("obeys an explicit tone over the variant's own", () => {
    expect(render(<Button variant="outline" tone="primary">Go</Button>))
      .toContain("mach mach--primary");
  });

  it("`tone=\"none\"` renders the stock shadcn variant", () => {
    const html = render(<Button variant="outline" tone="none">Specs</Button>);
    expect(html).not.toContain("mach");
    expect(html).toContain("border-input");
  });

  it("`surface` pins a treatment against the flag", () => {
    const html = render(<Button surface="neo">Add to cart</Button>);
    expect(html).not.toContain("mach");
    expect(html).toContain("bg-brand");
  });

  it("keeps its size and lets the call site win on a one-off", () => {
    const html = render(<Button tone="primary" className="h-12 text-base">Pay now</Button>);
    expect(html).toContain("h-12");
    expect(html).toContain("text-base");
  });
});

describe("the four bevel-killers never ship with a bevel", () => {
  // Each of these fights the treatment and none of them is visible in a
  // screenshot of a button at rest.
  const KILLERS = [
    ["focus-visible:ring-2", "a ring is a box-shadow, and so is the bevel"],
    ["disabled:opacity-50", "50% over three inset shadows is a grey smear"],
    ["transition-colors", "replaces the property list, so the press stops animating"],
    ["focus-visible:outline-none", "kills the outline the bevel focuses with"],
  ] as const;

  for (const variant of ["default", "outline", "ghost", "destructive"] as const) {
    it(`variant="${variant}"`, () => {
      const html = renderToStaticMarkup(<Button variant={variant}>x</Button>);
      expect(html).toContain("mach");
      for (const [cls, why] of KILLERS) {
        expect(html, `${cls} — ${why}`).not.toContain(cls);
      }
    });
  }

  it("still ships them on the stock path, so `buttonVariants` callers are unchanged", () => {
    const html = renderToStaticMarkup(<Button variant="link">x</Button>);
    expect(html).toContain("focus-visible:ring-2");
    expect(html).toContain("disabled:opacity-50");
  });
});

describe("the exception list", () => {
  it("is exactly the three product-purchase CTAs", () => {
    const pinned = sourceFiles()
      .filter((f) => readFileSync(f, "utf8").includes("SURFACE PIN"))
      .map((f) => f.replace(REPO, "").replace(/\\/g, "/"))
      .sort();

    expect(pinned).toEqual([
      "/packages/shop/src/cart/add-to-cart.tsx",
      "/packages/shop/src/components/card-add-button.tsx",
      "/packages/shop/src/product/buy-box.tsx",
    ]);
  });

  it("leaves no call site naming the neobrutalist look directly", () => {
    // `NEO_SURFACE` is one half of the flag now, not a thing a component asks
    // for. It may be referenced by the resolver and by its own definition —
    // and by comments, of which three survive on purpose: `post-card`,
    // `announcement-bar` and `rewards-band` each explain why the surface they
    // draw is deliberately NOT the call-to-action treatment.
    const OWNERS = ["/packages/ui/src/neo.ts", "/packages/ui/src/surface.ts"];
    const COMMENT = /^\s*(\*|\/\/|\/\*|\{\/\*)/;
    const offenders = sourceFiles().filter((f) => {
      const rel = f.replace(REPO, "").replace(/\\/g, "/");
      if (OWNERS.includes(rel)) return false;
      return readFileSync(f, "utf8")
        .split("\n")
        .some((l) => l.includes("NEO_SURFACE") && !COMMENT.test(l));
    });
    expect(offenders.map((f) => f.replace(REPO, "").replace(/\\/g, "/"))).toEqual([]);
  });
});
