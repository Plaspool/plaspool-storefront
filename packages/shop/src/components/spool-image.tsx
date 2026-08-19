import type { ReactElement } from "react";
import { cn } from "@plaspool/ui";

/**
 * The product image for the whole store. There is no photography: every spool
 * on every surface — card, gallery, cart line, category tile, description
 * figure — is this SVG, tinted by the filament's own hex.
 *
 * Deliberately hook-free and free of `"use client"`, so it renders on the
 * server inside a server component. The only motion in the component is the
 * `fill` transition on the winding, which is what lets a colour picker re-tint
 * the spool without the page knowing anything about animation.
 */

/* Geometry, in the 0 0 200 200 viewBox. The near flange is the reference
   frame; the far flange sits up and slightly left of it so the spool reads as
   a solid object rather than a disc. */
const CX = 100;
const CY = 103;
const FLANGE_RX = 82;
const FLANGE_RY = 77;
const BACK_DX = -6;
const BACK_DY = -11;

/** The well is the annulus the filament winds into: barrel at the inside,
 *  flange edge at the outside. A full spool fills it; a half spool does not. */
const WELL_RX = 66;
const WELL_RY = 62;
const CORE_RX = 32;
const CORE_RY = 30;

const HUB_RX = 31;
const HUB_RY = 29;
const HOLE_RX = 17;
const HOLE_RY = 16;

/** Winding bands. Eleven reads as a wound coil at 480 px and merges into a
 *  clean annulus at 64 px, which is the behaviour we want at both ends. */
const BANDS = 11;
/** > 1 puts the bands closer together near the hub, the way filament tightens
 *  as it approaches the barrel. */
const TIGHTEN = 1.25;

/** A full spool at the reference weight. 500 g draws roughly half the stack. */
const FULL_SPOOL_GRAMS = 1000;

const LINE = "hsl(var(--brand-line))";
const NAVY = "hsl(var(--brand-accent))";
const SOFT = "hsl(var(--brand-soft))";
const BACKGROUND = "hsl(var(--background))";

/** Fraction of the well's radial span filled at band index `i` (0 = barrel). */
function bandT(i: number): number {
  return Math.pow(i / BANDS, TIGHTEN);
}

function rxAt(t: number): number {
  return CORE_RX + (WELL_RX - CORE_RX) * t;
}

function ryAt(t: number): number {
  return CORE_RY + (WELL_RY - CORE_RY) * t;
}

/** An elliptical annulus as a single path. Drawn with `fillRule="evenodd"` so
 *  the inner ellipse punches the hole regardless of winding direction. */
function annulus(
  cx: number,
  cy: number,
  rxOuter: number,
  ryOuter: number,
  rxInner: number,
  ryInner: number,
): string {
  const ring = (rx: number, ry: number) =>
    `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
  return `${ring(rxOuter, ryOuter)} ${ring(rxInner, ryInner)}`;
}

/** `1000` → `1 kg`, `500` → `500 g`, `1500` → `1.5 kg`. */
function formatWeight(grams: number): string {
  if (grams < 1000) return `${grams} g`;
  const kg = grams / 1000;
  return `${Number.isInteger(kg) ? kg : Number(kg.toFixed(2))} kg`;
}

export interface SpoolImageProps {
  /** The filament's own colour. The one hue the component draws. */
  colourHex: string;
  weightGrams: number;
  /** Draws the flanges, rim and hub with a dashed outline where filament
   *  would be. For "sold out" and "your cart is empty" surfaces. */
  empty?: boolean;
  className?: string;
  /** Overrides the generated accessible name. Callers that know the colour's
   *  name should always pass one — the default can only name the hex. */
  label?: string;
}

export function SpoolImage({
  colourHex,
  weightGrams,
  empty = false,
  className,
  label,
}: SpoolImageProps) {
  const fill = Math.min(1, Math.max(0, weightGrams / FULL_SPOOL_GRAMS));
  const bandsDrawn = empty || fill <= 0 ? 0 : Math.max(1, Math.round(BANDS * fill));

  const fillT = bandT(bandsDrawn);
  const fillRx = rxAt(fillT);
  const fillRy = ryAt(fillT);

  /* The strand leaves the coil at its actual surface, so a half-empty spool
     pays out from further in — the detail that makes the fill level read as
     information rather than decoration. */
  const angle = (68 * Math.PI) / 180;
  const sx = CX + fillRx * Math.cos(angle);
  const sy = CY - fillRy * Math.sin(angle);
  const strand = `M ${sx.toFixed(2)} ${sy.toFixed(2)} C ${(sx + 8).toFixed(2)} ${(sy - 21).toFixed(2)}, 152 22, 174 34`;

  /* ═══ AN EMPTY LABEL MEANS DECORATIVE, NOT "NAME IT YOURSELF" ═══
     `label ?? default` treated `""` as a supplied name, because an empty string
     is not nullish — so a caller passing `alt=""` for a thumbnail whose button
     already carries the colour's name got `role="img" aria-label=""` and an
     empty `<title>`, which is an unnamed image rather than a hidden one. Seven
     of them on every product page. `alt=""` is the HTML idiom for "this adds
     nothing"; it has to mean the same thing here. */
  const decorative = label === "";

  const title =
    label ||
    (empty
      ? "Empty filament spool"
      : `Filament spool, ${formatWeight(weightGrams)}, colour ${colourHex.toUpperCase()}`);

  const bands: ReactElement[] = [];
  for (let i = 1; i <= bandsDrawn; i += 1) {
    const tOuter = bandT(i);
    const tInner = bandT(i - 1);
    const rxOuter = rxAt(tOuter);
    const ryOuter = ryAt(tOuter);
    const rxInner = rxAt(tInner);
    const ryInner = ryAt(tInner);
    /* A proportional kerf between windings: invisible at 64 px, a legible
       coil line at 480 px. */
    const kerf = Math.min(0.6, (rxOuter - rxInner) * 0.18);
    bands.push(
      <path
        key={i}
        d={annulus(CX, CY, rxOuter - kerf, ryOuter - kerf, rxInner, ryInner)}
        fillRule="evenodd"
        fill={colourHex}
        /* The hairline is what keeps arctic white and natural from vanishing
           into a pale flange. It disappears at card size and reads as the
           shadow between windings at gallery size. */
        stroke={LINE}
        strokeWidth={0.5}
        className="transition-[fill] duration-200 motion-reduce:transition-none"
      />,
    );
  }

  return (
    <svg
      viewBox="0 0 200 200"
      {...(decorative
        ? { "aria-hidden": true as const }
        : { role: "img" as const, "aria-label": title })}
      className={cn("block h-auto w-full", className)}
    >
      {!decorative && <title>{title}</title>}

      {/* Far flange — the sliver of it that shows past the near flange is the
          whole of the spool's depth, so it is the darker of the two. */}
      <ellipse
        cx={CX + BACK_DX}
        cy={CY + BACK_DY}
        rx={FLANGE_RX}
        ry={FLANGE_RY}
        fill={NAVY}
        fillOpacity={0.18}
        stroke={LINE}
        strokeWidth={1.5}
      />

      {/* Near flange. Opaque first, so the far flange does not composite
          through it and invert the depth cue, then tinted. */}
      <ellipse cx={CX} cy={CY} rx={FLANGE_RX} ry={FLANGE_RY} fill={BACKGROUND} />
      <ellipse
        cx={CX}
        cy={CY}
        rx={FLANGE_RX}
        ry={FLANGE_RY}
        fill={NAVY}
        fillOpacity={0.07}
        stroke={LINE}
        strokeWidth={2}
      />

      {/* The well. Its outline is what gives a white or natural filament a
          defined edge, and dashed it is the whole of the empty state. */}
      <path
        d={annulus(CX, CY, WELL_RX, WELL_RY, CORE_RX, CORE_RY)}
        fillRule="evenodd"
        fill={SOFT}
        stroke={LINE}
        strokeWidth={1.5}
        strokeDasharray={empty ? "6 5" : undefined}
      />

      {bands}

      {/* The top of the wound stack. Redundant on a full spool, and the line
          that shows the level on every other one. */}
      {bandsDrawn > 0 && (
        <ellipse
          cx={CX}
          cy={CY}
          rx={fillRx}
          ry={fillRy}
          fill="none"
          stroke={LINE}
          strokeWidth={1.25}
        />
      )}

      {/* Hub: navy ring, open bore. */}
      <path
        d={annulus(CX, CY, HUB_RX, HUB_RY, HOLE_RX, HOLE_RY)}
        fillRule="evenodd"
        fill={NAVY}
      />
      <ellipse
        cx={CX}
        cy={CY}
        rx={HOLE_RX}
        ry={HOLE_RY}
        fill={BACKGROUND}
        stroke={LINE}
        strokeWidth={1.25}
      />

      {/* The strand. Without it this is a disc; with it, it is filament. */}
      {bandsDrawn > 0 && (
        <>
          <path
            d={strand}
            fill="none"
            stroke={LINE}
            strokeWidth={6.5}
            strokeLinecap="round"
          />
          <path
            d={strand}
            fill="none"
            stroke={colourHex}
            strokeWidth={4.5}
            strokeLinecap="round"
            className="transition-[stroke] duration-200 motion-reduce:transition-none"
          />
        </>
      )}
    </svg>
  );
}
