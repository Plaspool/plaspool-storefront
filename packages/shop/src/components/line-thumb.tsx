import { BrandLogo } from "@plaspool/brand";
import { Skeleton, cn } from "@plaspool/ui";

import { ProductPhoto } from "./product-photo";
import type { LineImage, LineImageIndex } from "../data/catalog";
import type { OrderLine } from "../data/orders-api";

/**
 * One order line's picture, at a given size.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THREE OUTCOMES, AND THE THIRD IS THE ONE THIS COMPONENT EXISTS FOR.
 *
 *   A PHOTOGRAPH — the variant's own, or the product's cover standing in for
 *     it. `LineImage.ofThisColour` says which, and the alt below is the only
 *     thing that reads it.
 *   A DRAWN SPOOL — nobody has photographed this variant or its product, but
 *     the catalogue records a hex for it. `SpoolImage` is tinted to that hex,
 *     so the picture is true even though it is not a photo.
 *   NO PICTURE — nothing about this line's appearance can be sourced. A dashed,
 *     empty box that claims nothing.
 *
 * ═══ THE THIRD IS REACHED TWO WAYS, AND MISSING ONE OF THEM WAS A DEFECT ═══
 * The obvious way is a variant that is not in the catalogue at all. The other
 * is a variant that IS in it carrying neither a photograph nor a `colorHex` —
 * and an earlier cut of this file drew that one as a spool anyway, in the
 * module's default grey, captioned with the line's own colour. `LineImage`
 * spells the four cases out; the rule underneath them is that the drawn spool
 * is honest ONLY because its hex came from the catalogue, so "no photograph" is
 * never on its own a licence to draw. `drawable` below is that rule, and
 * `lineImageAlt` asks the same question again rather than inferring it.
 *
 * `SpoolImage`'s `empty` mode was the other candidate for the placeholder and
 * is worse: a dashed spool with no filament in it reads as "an empty spool",
 * which is a claim about the goods rather than about our knowledge of them.
 *
 * SO THE PLACEHOLDER IS NOT A SPOOL. It is a box that says "no picture", in the
 * same hairline-and-whitespace register as the rest of the shop, and it is
 * visibly not a photograph at 40px: dashed rather than solid, tinted rather
 * than white, carrying the mark in greyscale rather than a subject.
 *
 * ═══ IT IS DECORATIVE BY DEFAULT, WHICH IS THE HONEST DEFAULT HERE ═══
 * Both order surfaces print the line's title, its colour and its size in text
 * immediately beside the picture, so naming the picture too is a second reading
 * of the same row — the reasoning `cart-drawer.tsx` already carries at its own
 * `alt=""`. Pass `decorative={false}` where a thumbnail stands alone; the NAME
 * is then derived from what actually resolved (`lineImageAlt`), and there is
 * deliberately no prop through which a caller can supply one. The bug this
 * shuts out is a caller writing ``alt={`${line.title}, ${colour}`}`` over a
 * picture that is the product cover — which, today, is every line in the shop.
 *
 * ═══ NO HOOKS, AND NO `"use client"` ═══
 * `ProductPhoto` explains the rule and its cost: the choice between photograph
 * and drawing is made from the URL's presence on whichever side is rendering,
 * so a URL that stops resolving shows the browser's broken-image treatment
 * rather than falling back to the drawing. Both order surfaces are already
 * client components, so this lands in their bundle either way — but it stays
 * hook-free so a future server-rendered order row does not have to change it.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * The default edge, in px — and NOTHING IN THE SHOP CURRENTLY TAKES IT.
 *
 * Every caller names its own size, because the size is a property of the surface
 * and not of the thumbnail: the orders list draws 40 (the height its two text
 * lines already came to), the detail page's item rows draw 48, and the contents
 * block above them draws 64. This existed as "a list row's thumbnail; the detail
 * strip asks for its own", which was written before those three numbers were
 * measured and ended up naming the wrong one.
 *
 * Kept as a floor for a fourth surface rather than deleted, so a new caller that
 * has not measured anything yet still gets a box a picture is legible in.
 */
const DEFAULT_SIZE = 48;

/**
 * THE THREE FIELDS THIS COMPONENT ACTUALLY READS, rather than a whole
 * `OrderLine`.
 *
 * It asked for `OrderLine` while the order pages were its only callers.
 * `/checkout/complete` draws the same row from a receipt snapshot written
 * before the order exists (see `checkout/receipt-snapshot.ts`), which has no
 * `id`, `lineNo`, `sku` or `fulfilledQty` to give it and no honest way to
 * invent them. Narrowing to what is read costs nothing — `OrderLine` still
 * satisfies this, so every existing call site is unchanged — and it keeps the
 * next caller from fabricating five fields to get a picture.
 */
export type ThumbLine = Pick<OrderLine, "variantId" | "title" | "optionValues">;

export interface LineThumbProps {
  /** The line to picture. Only `variantId` finds the image; `title` and
   *  `optionValues` are read solely to NAME it, and only when named. */
  line: ThumbLine;
  /** One catalogue read, shared by every line on the page. See
   *  `getLineImages()`. */
  images: LineImageIndex;
  /** The square's edge in px. Drives `LineThumbSkeleton` too, so the wait and
   *  the resolved box are the same box by construction. */
  size?: number;
  /** False where the thumbnail is not beside text that already names the line.
   *  The name itself is never a caller's to choose — see the file header. */
  decorative?: boolean;
  className?: string;
}

export function LineThumb({
  line,
  images,
  size = DEFAULT_SIZE,
  decorative = true,
  className,
}: LineThumbProps) {
  const image = images[line.variantId];
  const alt = decorative ? "" : lineImageAlt(line, image);

  /* A NUMBER RATHER THAN A TAILWIND WIDTH, because a class cannot be composed
     from a runtime value without a safelist, and because one number driving
     both this box and the skeleton is the only way "the skeleton matches the
     resolved box" is true by construction rather than by two people agreeing.
     Border-box is Tailwind's preflight default, so the border is inside the
     edge and the two boxes measure identically. */
  const box = { width: size, height: size };

  /* ═══ THE INSET IS px COMPUTED FROM `size`, AND IT WAS `p-[6%]` ═══
     A percentage padding resolves against the WIDTH OF THE CONTAINING BLOCK —
     the order row — not against the element it is written on. So a 48px
     thumbnail in a 480px row got 28.8px of padding on each side: more than the
     box is wide, collapsing the content box to zero and rendering a solid,
     bordered, EMPTY square in the branch whose whole job is to say "here is a
     picture". Measured at 4.8px of image in a 343px row and 0px at 480, 672 and
     720 — every width these surfaces actually render at. It survived the bench
     only because `ThumbBench` sits in a 348px grid column at `size=64`, the one
     geometry where it degrades to "small" rather than "gone".
     The placeholder below already did this correctly; now both do. */
  const inset = Math.round(size * 0.06);

  /* ═══ NOTHING TO DRAW IS ALSO A CASE, NOT JUST NOTHING TO FIND ═══
     A catalogue entry with no photograph AND no `colorHex` knows as little
     about this line's appearance as no entry at all, so it gets the same
     answer. The earlier cut inferred "we know the colour" from `src === null`
     alone, drew a `#8a8a94` spool and captioned it with the line's own colour —
     the exact defect `LineImage` is written to prevent, one field further on. */
  const drawable = image !== undefined && (image.src !== null || image.colourHex !== null);

  if (!drawable) {
    return (
      <div
        style={box}
        /* DASHED AND TINTED, so "we have no picture of this" is legible as a
           different thing from "here is a picture", without reading a word. */
        className={cn(
          "flex shrink-0 items-center justify-center border border-dashed border-brand-line bg-brand-soft/40",
          className,
        )}
        /* NOTHING MAY BE SAID ABOUT IT, so nothing is said about it, even when
           the caller asked for a named thumbnail. `lineImageAlt` returns "" for
           both of the cases that land here, for the same reason: an accessible
           name could only describe the product, and this box is not a picture
           of the product — it is the absence of one. The row's text carries
           the item. */
        aria-hidden="true"
      >
        {/* ═══ THE MARK, IN GREYSCALE, AND WHY IT REPLACED A BROKEN-IMAGE ICON
            ═══
            This was `ImageOff` — a crossed-out photograph glyph. It was honest
            and it read as an ERROR: a shopper scanning their order list saw a
            rail of "broken image" symbols and reasonably concluded the page had
            failed to load, when in fact the shop simply has no photograph of
            that variant. The two states look identical to somebody who has
            never seen the working one.
            The mark says the same true thing — "no picture here" — in a
            register that belongs to this shop rather than to a browser's
            failure mode. It is DESATURATED and held at 45% so it cannot be
            mistaken for product art: at full strength a rail of logos reads as
            branding somebody chose to put there, which would be its own small
            lie about what these squares are.
            IT STILL CLAIMS NOTHING. `alt=""` and the wrapper's `aria-hidden`
            between them mean no assistive technology hears "PlaSpool" in place
            of a product it cannot see, and the dashed border and tint above are
            untouched — they are what makes "we have no picture of this" legible
            as a different thing from "here is a picture", and they do that
            without depending on colour or on recognising a logo.
            `priority={false}` IS NOT OPTIONAL HERE. An order list draws up to
            three of these per row over twenty rows; `BrandLogo`'s default asks
            the browser to preload the file once per instance and would push the
            real product photographs down the queue. One 25KB PNG, fetched lazily
            and then served from cache to every other square on the page. */}
        <BrandLogo
          variant="mark"
          tone="light"
          alt=""
          priority={false}
          /* Proportional, so the mark reads at a 40px row thumbnail and does not
             become a postage stamp in a 96px strip. 52% rather than the icon's
             34%: a logomark carries interior detail a two-stroke glyph does not,
             and at 34% of 40px it was an unreadable smudge. */
          className="h-auto opacity-45 grayscale"
          style={{ width: Math.round(size * 0.52) }}
        />
      </div>
    );
  }

  return (
    <div
      style={{ ...box, padding: inset }}
      /* `bg-background` because `SpoolImage` fills its flange and bore with the
         page background and would otherwise composite a tinted surface through
         the middle of the spool — the same note the product page's stage
         carries. The hairline is what gives a white or natural spool an edge. */
      className={cn("shrink-0 border border-brand-line bg-background", className)}
    >
      <ProductPhoto
        src={image.src}
        alt={alt}
        /* NON-NULL WHEREVER IT IS READ. `ProductPhoto` reads `colourHex` only
           when `src` is null, and `drawable` above has already sent a null
           `src` with a null hex to the placeholder — so this fallback never
           reaches a fill. It is `""` rather than a plausible grey precisely so
           that if that invariant is ever broken the result is a visibly wrong
           swatch somebody fixes, not a credible lie nobody notices. */
        colourHex={image.colourHex ?? ""}
        weightGrams={image.weightGrams}
        /* Never `priority`. An order page's LCP is its status headline, and
           these are a rail of thumbnails — exactly the case `ProductPhoto`
           names as wrong for eager loading. */
      />
    </div>
  );
}

/**
 * What the picture may be called, given what it turned out to be.
 *
 * ═══ THE NAME FOLLOWS THE PICTURE, NEVER THE LINE ═══
 * `gallery.tsx` states the rule and the bug behind it: "A picture is named for
 * what it is a picture OF: the colour only enters the name when the photograph
 * is that colour's own." The five answers here are that rule applied to a line:
 *
 *   the variant's own photograph  → product AND colour; it is a picture of both
 *   the product's cover           → product only; it is not a picture of this
 *                                   colour, and today this is every live line
 *   the drawn spool               → product AND colour; the drawing IS tinted
 *                                   to the catalogue's own hex for this
 *                                   variant, so the colour is the one thing it
 *                                   definitely shows
 *   a catalogue entry with no
 *   photograph and no hex         → "", i.e. decorative; nothing is drawn
 *   nothing in the catalogue      → "", i.e. decorative; see `LineThumb`
 *
 * ═══ WHY THE LAST TWO ARE SEPARATE LINES ═══
 * They render identically and they are reached differently, and collapsing them
 * in the CODE is what caused the second one to be wrong. `namesColour` used to
 * read `!image.src || image.ofThisColour` — treating "there is no photograph"
 * as proof that the hex came from the catalogue. It is not: a variant with no
 * `colorHex` also has no photograph, and that expression named it after the
 * line's colour over a `#8a8a94` spool. The question a name has to ask is
 * "does the picture SHOW this colour", which for a drawing means "is there a
 * real hex", never "is the photograph missing".
 *
 * THE WORDS COME FROM THE LINE, NOT THE CATALOGUE. `line.title` and
 * `optionValues.Colour` are the purchase-time snapshot — what the customer
 * bought and what it was called when they bought it. A product renamed since
 * should not rename their order, and the two cannot disagree about WHICH colour
 * because they are the same variant.
 *
 * Exported so the bench can print it beside each case: an `alt` that is wrong
 * is invisible in a screenshot, which is how this class of bug survived three
 * reviews of these surfaces — and a fourth.
 */
export function lineImageAlt(line: ThumbLine, image: LineImage | undefined): string {
  /* NOTHING IS DRAWN, SO NOTHING IS NAMED. Kept in step with `LineThumb`'s
     `drawable`: the two must agree about which entries produce a picture, or a
     placeholder acquires an accessible name describing goods it does not show. */
  if (!image || (image.src === null && image.colourHex === null)) return "";

  const colour = (line.optionValues?.Colour ?? line.optionValues?.colour ?? "").trim();
  /* ASKED OF THE PICTURE, NOT OF WHAT IS ABSENT. A photograph shows this colour
     only when it is the variant's own; a drawing shows it exactly when there is
     a catalogue hex to draw it from. */
  const showsColour = image.src !== null ? image.ofThisColour : image.colourHex !== null;
  return showsColour && colour ? `${line.title}, ${colour}` : line.title;
}

/**
 * The wait, shaped like the thumbnail.
 *
 * `CLAUDE.md`, "Loading states — skeletons, never prose": same edge, same
 * `shrink-0`, no border — a hairline sits inside the box on border-box, so the
 * two occupy identical space and nothing shifts when the picture lands.
 *
 * Order lines arrive on the client, and the index arrives on the server before
 * them, so a resolved line never waits for a picture — this is for the rows
 * themselves, which the list and detail skeletons draw before any line exists.
 */
export function LineThumbSkeleton({
  size = DEFAULT_SIZE,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return <Skeleton style={{ width: size, height: size }} className={cn("shrink-0", className)} />;
}
