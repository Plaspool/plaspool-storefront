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
  COLOURS,
  ColourSwatches,
  EmptyState,
  Price,
  QuantityStepper,
  RatingStars,
  SpoolImage,
  STANDARD_TIERS,
  type Colour,
} from "@plaspool/shop";

/* The component gallery. Every primitive at every variant, against the real
   fixture colours and the real bulk ladder — nothing here is invented data. */

const SPOOL_COLOURS: Colour[] = [
  COLOURS["obsidian-black"],
  COLOURS["arctic-white"],
  COLOURS["signal-red"],
  COLOURS["lagos-orange"],
  COLOURS["palm-green"],
  COLOURS["cobalt-blue"],
];

const CARD_COLOURS: Colour[] = [
  COLOURS["obsidian-black"],
  COLOURS["arctic-white"],
  COLOURS["signal-red"],
  COLOURS["solar-yellow"], // out of stock
  COLOURS["palm-green"],
];

const WIDE_COLOURS: Colour[] = [
  COLOURS["obsidian-black"],
  COLOURS["arctic-white"],
  COLOURS["signal-red"],
  COLOURS["lagos-orange"],
  COLOURS["solar-yellow"], // out of stock
  COLOURS["palm-green"],
  COLOURS["deep-teal"],
  COLOURS["cobalt-blue"],
  COLOURS["ash-grey"],
  COLOURS["magenta"], // out of stock
];

const BASE_PRICE = 18_500;

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
              colourHex={COLOURS["cobalt-blue"].hex}
              weightGrams={1000}
              label="Cobalt blue filament spool, 1 kg"
            />
            <Caption>
              Full spool · <Mono>1 kg</Mono>
            </Caption>
          </li>
          <li>
            <SpoolImage
              colourHex={COLOURS["cobalt-blue"].hex}
              weightGrams={500}
              label="Cobalt blue filament spool, 500 g"
            />
            <Caption>
              Half the winding · <Mono>500 g</Mono>
            </Caption>
          </li>
          <li>
            <SpoolImage colourHex={COLOURS["cobalt-blue"].hex} weightGrams={1000} empty />
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
                colourHex={COLOURS["palm-green"].hex}
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
              <BulkTierTable tiers={STANDARD_TIERS} basePrice={BASE_PRICE} quantity={quantity} />
            </div>
          ))}
        </div>
        <div className="mt-10 max-w-sm">
          <h3 className="mb-3 font-sans text-sm font-semibold text-foreground">
            No quantity supplied
          </h3>
          <BulkTierTable tiers={STANDARD_TIERS} basePrice={BASE_PRICE} />
        </div>
      </Kit>
    </main>
  );
}
