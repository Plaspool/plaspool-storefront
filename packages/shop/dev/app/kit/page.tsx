"use client";

import * as React from "react";
import {
  MessageSquareQuote,
  PackageSearch,
  Search,
  ShoppingCart,
} from "lucide-react";
import { Button, cn } from "@plaspool/ui";
import {
  BulkTierTable,
  Breadcrumb,
  ColourSwatches,
  EmptyState,
  Price,
  ProductGrid,
  QuantityStepper,
  RatingStars,
  SpoolImage,
  type Colour,
  type Product,
  type RatingSummary,
  type SizeOption,
} from "@plaspool/shop";

/**
 * The component gallery. Every primitive at every variant.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ITS FIXTURES ARE ITS OWN, AND THAT IS THE POINT.
 *
 * This page used to read the shop's own data, back when the shop's own data was
 * a local array. It is a live commerce API now, and a gallery that reads one
 * demos whatever the shop happens to be selling this morning: no sale price —
 * no live variant carries `compareAtMinor` — no sold-out colour, an empty bulk
 * ladder, and nothing at all on a day the API is down. A gallery exists to read
 * a component against the states it has to survive, so the states are stated
 * here.
 *
 * That is not a new decision, only a finished one: `DEMO_TIERS` below already
 * existed for exactly this reason, because `STANDARD_TIERS` went empty and the
 * tier table demoed nothing.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * The gallery's palette.
 *
 * ═══ `satisfies`, NOT A `Record<string, Colour>` ANNOTATION ═══
 * That distinction is load-bearing, and its absence is what let this page rot
 * into a 500. It used to index the hero carousel's `HERO_COLOURS`, which IS
 * declared `Record<string, Colour>` — and an index signature answers EVERY
 * string key with `Colour`, so `COLOURS["ash-grey"]` typechecked perfectly,
 * evaluated to `undefined`, and threw `Cannot read properties of undefined
 * (reading 'id')` inside `ColourSwatches`. `satisfies` checks these values
 * against `Colour` while keeping the literal keys, so a name that is not in
 * this object is now a compile error rather than a hole punched in an array.
 *
 * Borrowing `HERO_COLOURS` was the wrong fixture for a second reason, which no
 * compiler would have caught either: it is decoration for a marketing
 * animation and every entry is `inStock: true` by design, so the out-of-stock
 * treatments below had nothing left to draw and their captions described
 * something that was no longer on the page.
 */
const DEMO_COLOURS = {
  "obsidian-black": { id: "obsidian-black", name: "Obsidian black", hex: "#101014", inStock: true, imageUrl: null },
  "arctic-white": { id: "arctic-white", name: "Arctic white", hex: "#F4F4F6", inStock: true, imageUrl: null },
  "signal-red": { id: "signal-red", name: "Signal red", hex: "#C42B2B", inStock: true, imageUrl: null },
  "lagos-orange": { id: "lagos-orange", name: "Lagos orange", hex: "#E2620F", inStock: true, imageUrl: null },
  "solar-yellow": { id: "solar-yellow", name: "Solar yellow", hex: "#E8B71A", inStock: false, imageUrl: null },
  "palm-green": { id: "palm-green", name: "Palm green", hex: "#1F7A4C", inStock: true, imageUrl: null },
  "deep-teal": { id: "deep-teal", name: "Deep teal", hex: "#12626B", inStock: true, imageUrl: null },
  "cobalt-blue": { id: "cobalt-blue", name: "Cobalt blue", hex: "#1B4FA8", inStock: true, imageUrl: null },
  "brand-navy": { id: "brand-navy", name: "Spool navy", hex: "#231C50", inStock: true, imageUrl: null },
  "clay-brown": { id: "clay-brown", name: "Clay brown", hex: "#7A4B2A", inStock: true, imageUrl: null },
  "ash-grey": { id: "ash-grey", name: "Ash grey", hex: "#8A8D94", inStock: true, imageUrl: null },
  magenta: { id: "magenta", name: "Magenta", hex: "#B02A75", inStock: false, imageUrl: null },
} satisfies Record<string, Colour>;

const SPOOL_COLOURS: Colour[] = [
  DEMO_COLOURS["obsidian-black"],
  DEMO_COLOURS["arctic-white"],
  DEMO_COLOURS["signal-red"],
  DEMO_COLOURS["lagos-orange"],
  DEMO_COLOURS["palm-green"],
  DEMO_COLOURS["cobalt-blue"],
];

const CARD_COLOURS: Colour[] = [
  DEMO_COLOURS["obsidian-black"],
  DEMO_COLOURS["arctic-white"],
  DEMO_COLOURS["signal-red"],
  DEMO_COLOURS["solar-yellow"], // out of stock
  DEMO_COLOURS["palm-green"],
];

const WIDE_COLOURS: Colour[] = [
  DEMO_COLOURS["obsidian-black"],
  DEMO_COLOURS["arctic-white"],
  DEMO_COLOURS["signal-red"],
  DEMO_COLOURS["lagos-orange"],
  DEMO_COLOURS["solar-yellow"], // out of stock
  DEMO_COLOURS["palm-green"],
  DEMO_COLOURS["deep-teal"],
  DEMO_COLOURS["cobalt-blue"],
  DEMO_COLOURS["ash-grey"],
  DEMO_COLOURS.magenta, // out of stock
];

/* A REAL LADDER, because the shop's own comes from the API now and
   `STANDARD_TIERS` is an empty array — the table demoed as nothing. These are
   the rungs the admin resolves by default, in basis points. */
const DEMO_TIERS = [
  { minQty: 3, percentBps: 500 },
  { minQty: 5, percentBps: 1000 },
  { minQty: 10, percentBps: 1500 },
];

const BASE_PRICE = 18_500;

/* ── The product grid's own catalogue ──────────────────────────────────────
   `listProducts()` became an async call against the commerce API, and this
   page is a client component, so it was handing `ProductGrid` a Promise — which
   has no `.length` to test and no `.map` to call. Awaiting it would only trade
   that crash for a gallery whose contents depend on the shop's stock level;
   see the header for why these are stated here instead. */

const DEMO_SIZES: SizeOption[] = [
  { id: "500g", label: "500 g", weightGrams: 500, priceNaira: 11_000, compareAtNaira: null },
  { id: "1kg", label: "1 kg", weightGrams: 1000, priceNaira: 18_500, compareAtNaira: null },
];

const NO_RATING: RatingSummary = { average: 0, count: 0, distribution: [0, 0, 0, 0, 0] };

/**
 * One demo product.
 *
 * `variantIds` IS DELIBERATELY LEFT EMPTY. `CardAddButton` reads the live cart,
 * whose catalogue comes from the API and will never hold these slugs; with no
 * variant behind the pair, `cart.add()` returns early and does nothing. That is
 * the behaviour this page wants — the button is here to be looked at in its
 * hover and focus states, and opening the drawer onto an error it has no way to
 * resolve would demo a failure rather than a component.
 */
function demoProduct(
  slug: string,
  name: string,
  rest: Partial<Product> & { colours: Colour[] },
): Product {
  return {
    slug,
    name,
    categorySlug: "pla",
    material: "PLA",
    diameterMm: 1.75,
    sizes: DEMO_SIZES,
    bulkTiers: [],
    coverImageUrl: null,
    imageUrls: [],
    badges: [],
    overview: "",
    seoTitle: null,
    seoDescription: null,
    features: [],
    overviewClaims: [],
    description: [],
    parameters: null,
    rating: NO_RATING,
    featured: false,
    variantIds: {},
    ...rest,
  };
}

const ALL_COLOURS: Colour[] = Object.values(DEMO_COLOURS);

const DEMO_PRODUCTS: Product[] = [
  /* A ladder, a rating, and a swatch row long enough to truncate. */
  demoProduct("pla-basic", "PLA Basic 1.75 mm", {
    colours: WIDE_COLOURS,
    bulkTiers: DEMO_TIERS,
    badges: ["Bulk sale"],
    rating: { average: 4.5, count: 128, distribution: [96, 20, 8, 3, 1] },
  }),
  /* No reviews, so the card renders NO star row at all rather than "0.0 (0)".
     Also the longest name here, which is what makes a grid row uneven. */
  demoProduct(
    "petg-carbon-fibre",
    "PETG Carbon Fibre 1.75 mm — obsidian black, 1 kg spool for engineering parts",
    {
      colours: [DEMO_COLOURS["obsidian-black"], DEMO_COLOURS["ash-grey"]],
      categorySlug: "petg",
      material: "PETG",
      badges: ["New"],
    },
  ),
  /* `Low stock` is the one badge drawn as an outline against the background. */
  demoProduct("tpu-flex", "TPU Flex 95A 1.75 mm", {
    colours: [
      DEMO_COLOURS["signal-red"],
      DEMO_COLOURS["obsidian-black"],
      DEMO_COLOURS["arctic-white"],
    ],
    categorySlug: "tpu",
    material: "TPU",
    badges: ["Low stock"],
    rating: { average: 4, count: 24, distribution: [12, 8, 3, 1, 0] },
  }),
  demoProduct("abs-engineering", "ABS Engineering 1.75 mm", {
    colours: [
      DEMO_COLOURS["arctic-white"],
      DEMO_COLOURS["obsidian-black"],
      DEMO_COLOURS["clay-brown"],
    ],
    categorySlug: "abs",
    material: "ABS",
    badges: ["Sale"],
    bulkTiers: DEMO_TIERS,
    rating: { average: 3.5, count: 11, distribution: [4, 3, 2, 1, 1] },
  }),
  /* EVERY COLOUR GONE. `availableColours` cannot filter this one down to
     anything buyable, so it falls back to the full list and the swatches are
     drawn struck through — the one path that treatment still has. */
  demoProduct("asa-outdoor", "ASA Outdoor 1.75 mm", {
    colours: [DEMO_COLOURS["solar-yellow"], DEMO_COLOURS.magenta],
    categorySlug: "asa",
    material: "ASA",
    rating: { average: 4.5, count: 6, distribution: [4, 2, 0, 0, 0] },
  }),
  /* Twelve colours against the card's `max={6}`: the `+N` overflow count. */
  demoProduct("pla-silk", "PLA Silk 1.75 mm", {
    colours: ALL_COLOURS,
    badges: ["Bulk sale"],
    bulkTiers: DEMO_TIERS,
    rating: { average: 5, count: 6, distribution: [6, 0, 0, 0, 0] },
  }),
];

/** Literal classes, so Tailwind's scanner actually emits them. */
const SPOOL_SIZES = [
  { px: 64, className: "w-16" },
  { px: 96, className: "w-24" },
  { px: 160, className: "w-40" },
  { px: 240, className: "w-60" },
] as const;

function Kit({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-brand-line py-10">
      <h2 className="font-sans text-xl font-semibold text-foreground">{title}</h2>
      {note && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{note}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Caption({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-xs text-muted-foreground">{children}</p>;
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono tabular-nums text-foreground">{children}</span>;
}

function Frame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-brand-line p-4", className)}>{children}</div>
  );
}

export default function KitPage() {
  const [selectedColour, setSelectedColour] = React.useState("signal-red");
  const [qty, setQty] = React.useState(3);
  const [smallQty, setSmallQty] = React.useState(2);

  const picked = WIDE_COLOURS.find((c) => c.id === selectedColour) ?? WIDE_COLOURS[0];

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <header>
        <h1 className="font-sans text-2xl font-bold text-foreground">Component gallery</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          The eight presentational primitives every storefront surface composes from. Colour on this
          page only ever comes from a filament hex; the chrome is brand navy and the neutral tokens.
        </p>
      </header>

      <Kit
        title="Spool image"
        note="Six filament colours at 1 kg. The winding is the only place the product's colour appears."
      >
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {SPOOL_COLOURS.map((colour) => (
            <li key={colour.id}>
              <SpoolImage
                colourHex={colour.hex}
                weightGrams={1000}
                label={`${colour.name} filament spool, 1 kg`}
              />
              <Caption>
                {colour.name} · <Mono>1 kg</Mono>
              </Caption>
            </li>
          ))}
        </ul>

        <h3 className="mt-10 font-sans text-base font-semibold text-foreground">
          Weight and the empty state
        </h3>
        <ul className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <li>
            <SpoolImage
              colourHex={DEMO_COLOURS["cobalt-blue"].hex}
              weightGrams={1000}
              label="Cobalt blue filament spool, 1 kg"
            />
            <Caption>
              Full spool · <Mono>1 kg</Mono>
            </Caption>
          </li>
          <li>
            <SpoolImage
              colourHex={DEMO_COLOURS["cobalt-blue"].hex}
              weightGrams={500}
              label="Cobalt blue filament spool, 500 g"
            />
            <Caption>
              Half the winding · <Mono>500 g</Mono>
            </Caption>
          </li>
          <li>
            <SpoolImage colourHex={DEMO_COLOURS["cobalt-blue"].hex} weightGrams={1000} empty />
            <Caption>Empty — dashed where the filament would be</Caption>
          </li>
        </ul>

        <h3 className="mt-10 font-sans text-base font-semibold text-foreground">
          Holds up across the sizes it is used at
        </h3>
        <ul className="mt-4 flex flex-wrap items-end gap-6">
          {SPOOL_SIZES.map(({ px, className }) => (
            <li key={px}>
              <SpoolImage
                colourHex={DEMO_COLOURS["palm-green"].hex}
                weightGrams={1000}
                label="Palm green filament spool, 1 kg"
                className={className}
              />
              <Caption>
                <Mono>{px} px</Mono>
              </Caption>
            </li>
          ))}
        </ul>
      </Kit>

      <Kit
        title="Price"
        note="Monospace and tabular. Every slot below is laid out against the widest realistic string, From ₦34,000."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-brand-line text-left">
                <th scope="col" className="px-2 pb-2 text-xs font-semibold text-muted-foreground">
                  Size
                </th>
                <th scope="col" className="px-2 pb-2 text-xs font-semibold text-muted-foreground">
                  Plain
                </th>
                <th scope="col" className="px-2 pb-2 text-xs font-semibold text-muted-foreground">
                  With compareAt
                </th>
                <th scope="col" className="px-2 pb-2 text-xs font-semibold text-muted-foreground">
                  From
                </th>
                <th scope="col" className="px-2 pb-2 text-xs font-semibold text-muted-foreground">
                  Sale + bulk rung
                </th>
              </tr>
            </thead>
            <tbody>
              {(["sm", "md", "lg"] as const).map((size) => (
                <tr key={size} className="border-b border-brand-line last:border-b-0">
                  <td className="px-2 py-4 font-mono text-xs text-muted-foreground">{size}</td>
                  <td className="w-[11rem] px-2 py-4">
                    <Price amount={18_500} size={size} />
                  </td>
                  <td className="w-[15rem] px-2 py-4">
                    <Price amount={18_500} compareAt={21_000} size={size} />
                  </td>
                  <td className="w-[13rem] px-2 py-4">
                    <Price amount={34_000} from size={size} />
                  </td>
                  {/* THE THREE-NUMBER CASE. A spool reduced from ₦24,000 to
                      ₦20,000 AND bought five at a time. The strike belongs to
                      the sale; the rung is stated separately with the quantity
                      that earns it. Passing the bulk figure as `amount` and the
                      list price as `compareAt` — which the buy box used to do —
                      renders this as a 25% sale when the sale is 17%. */}
                  <td className="w-[22rem] px-2 py-4">
                    <Price
                      amount={20_000}
                      compareAt={24_000}
                      bulkAmount={18_000}
                      bulkQty={5}
                      size={size}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Kit>

      <Kit
        title="Colour swatches"
        note="Static mode is a list, because a product card is a single link. Interactive mode is a radio group with arrow-key movement."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <Frame>
            <h3 className="font-sans text-sm font-semibold text-foreground">Static — five colours</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Solar yellow is out of stock: dimmed and struck through.
            </p>
            <div className="mt-4">
              <ColourSwatches colours={CARD_COLOURS} />
            </div>
          </Frame>

          <Frame>
            <h3 className="font-sans text-sm font-semibold text-foreground">
              Static — more than fits
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Ten colours, four slots, and the remainder as a mono count.
            </p>
            <div className="mt-4">
              <ColourSwatches colours={WIDE_COLOURS} max={4} />
            </div>
          </Frame>

          <Frame>
            <h3 className="font-sans text-sm font-semibold text-foreground">
              Static — with a selection
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Selected swatch carries the brand ring.
            </p>
            <div className="mt-4">
              <ColourSwatches colours={CARD_COLOURS} selectedId="signal-red" size="md" />
            </div>
          </Frame>

          <Frame>
            <h3 className="font-sans text-sm font-semibold text-foreground">
              Interactive — radio group
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Tab in once, then use the arrow keys. Out-of-stock swatches take focus but cannot be
              chosen.
            </p>
            <div className="mt-4 flex items-center gap-5">
              <ColourSwatches
                colours={WIDE_COLOURS}
                selectedId={selectedColour}
                onSelect={setSelectedColour}
              />
            </div>
            <div className="mt-5 flex items-center gap-4">
              <SpoolImage
                colourHex={picked.hex}
                weightGrams={1000}
                label={`${picked.name} filament spool, 1 kg`}
                className="w-20"
              />
              <p className="text-sm text-foreground">
                {picked.name} <span className="font-mono text-xs text-muted-foreground">{picked.hex}</span>
              </p>
            </div>
          </Frame>
        </div>
      </Kit>

      <Kit title="Rating stars" note="Filled to the nearest half. The count renders as a mono figure.">
        <ul className="grid gap-3 sm:grid-cols-2">
          {[
            { rating: 0, count: 0 },
            { rating: 0.5, count: 1 },
            { rating: 1, count: 2 },
            { rating: 2, count: 4 },
            { rating: 3, count: 6 },
            { rating: 3.5, count: 11 },
            { rating: 4, count: 24 },
            { rating: 4.5, count: 6 },
            { rating: 5, count: 128 },
          ].map((row) => (
            <li key={row.rating} className="flex items-center gap-4">
              <RatingStars rating={row.rating} count={row.count} size="md" />
              <span className="font-mono text-xs text-muted-foreground">
                rating={row.rating}
              </span>
            </li>
          ))}
          <li className="flex items-center gap-4">
            <RatingStars rating={4.5} />
            <span className="font-mono text-xs text-muted-foreground">no count, size=sm</span>
          </li>
        </ul>
      </Kit>

      <Kit
        title="Empty states"
        note="Each one says what is missing and what to do next. None of them apologise."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Frame className="p-0">
            <EmptyState
              icon={<ShoppingCart />}
              title="Your cart is empty"
              body="Add a spool to get started. Bulk pricing kicks in at four of the same product."
              action={
                <Button
                  variant="outline"
                  className="focus-visible:ring-brand focus-visible:ring-offset-background"
                >
                  Browse filament
                </Button>
              }
            />
          </Frame>

          <Frame className="p-0">
            <EmptyState
              icon={<PackageSearch />}
              title="No spools in this category yet"
              body="Support material lands next month. PLA and PETG carry the widest colour range today."
              action={
                <Button
                  variant="outline"
                  className="focus-visible:ring-brand focus-visible:ring-offset-background"
                >
                  See all filament
                </Button>
              }
            />
          </Frame>

          <Frame className="p-0">
            <EmptyState
              icon={<Search />}
              title="Nothing matches that search"
              body="Check the spelling, or search by material — PLA, PLA+, PETG, ABS, ASA or TPU."
              action={
                <Button
                  variant="outline"
                  className="focus-visible:ring-brand focus-visible:ring-offset-background"
                >
                  Clear search
                </Button>
              }
            />
          </Frame>

          <Frame className="p-0">
            <EmptyState
              icon={<MessageSquareQuote />}
              title="No reviews yet"
              body="Reviews open once a spool has shipped. Print with it first, then tell the next buyer how it ran."
            />
          </Frame>
        </div>
      </Kit>

      <Kit
        title="Breadcrumb"
        note="The last crumb is the current page and the only one that truncates."
      >
        <div className="space-y-6">
          <Frame>
            <Breadcrumb
              trail={[
                { label: "Home", href: "/" },
                { label: "PETG", href: "/category/petg" },
                {
                  label:
                    "PETG Carbon Fibre 1.75 mm — obsidian black, 1 kg spool for engineering parts",
                },
              ]}
            />
          </Frame>
          <Frame>
            <Breadcrumb
              trail={[
                { label: "Home", href: "/" },
                { label: "PLA", href: "/category/pla" },
                { label: "PLA Basic" },
              ]}
            />
          </Frame>
        </div>
      </Kit>

      <Kit
        title="Quantity stepper"
        note="Buttons disable at the bounds and the value is a polite live region."
      >
        <div className="flex flex-wrap items-start gap-10">
          <div>
            <QuantityStepper value={qty} onChange={setQty} />
            <Caption>
              Default bounds — <Mono>1</Mono> to <Mono>99</Mono>
            </Caption>
          </div>
          <div>
            <QuantityStepper value={smallQty} onChange={setSmallQty} min={2} max={4} label="PLA Basic" />
            <Caption>
              Bounded <Mono>2</Mono>–<Mono>4</Mono>, and named for a cart line
            </Caption>
          </div>
        </div>
      </Kit>

      <Kit
        title="Bulk tier table"
        note="Hairline rules, no card chrome. The rung the quantity has reached is highlighted."
      >
        <div className="grid gap-8 md:grid-cols-3">
          {[1, 4, 10].map((quantity) => (
            <div key={quantity}>
              <h3 className="mb-3 font-sans text-sm font-semibold text-foreground">
                quantity = <span className="font-mono tabular-nums">{quantity}</span>
              </h3>
              <BulkTierTable tiers={DEMO_TIERS} basePrice={BASE_PRICE} quantity={quantity} />
            </div>
          ))}
        </div>
        <div className="mt-10 max-w-sm">
          <h3 className="mb-3 font-sans text-sm font-semibold text-foreground">
            No quantity supplied
          </h3>
          <BulkTierTable tiers={DEMO_TIERS} basePrice={BASE_PRICE} />
        </div>
      </Kit>

      <Kit
        title="Product grid"
        note="Six demo products covering every state a card has: a bulk ladder, each kind of badge, one with no reviews, one whose colours have all sold out, and a swatch row that overflows. Two columns at 375 px, three at md, four at xl. Hover or tab into a card and the add button appears over the spool."
      >
        <ProductGrid products={DEMO_PRODUCTS} />
      </Kit>

      <Kit title="Product grid — empty" note="No products, no supplied empty state: the default fallback.">
        <ProductGrid products={[]} />
      </Kit>
    </main>
  );
}
