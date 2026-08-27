import { cn } from "@plaspool/ui";

/**
 * The shopper's face in the nav: their picture, or a letter on a colour that is
 * always the same colour for them.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY IT EXISTS. The header rendered one grey `User` glyph whether somebody was
 * signed in or not, so the nav gave no signal at all about session state — the
 * only difference was where the link went, which you discover by clicking it.
 *
 * THE COLOUR IS DERIVED, NOT RANDOM AND NOT STORED. A hash of a stable key —
 * the customer id, falling back to the normalised email — indexes a small
 * hand-picked palette, so the same person gets the same colour on every device,
 * after every reload, with nothing persisted and no round trip. `Math.random()`
 * would change on every render and re-mount; a stored colour would be a column
 * and a migration for something entirely derivable.
 *
 * THE PALETTE HAS TO SATISFY TWO PROPERTIES, AND THE FIRST CUT ENFORCED ONLY
 * ONE. Every colour clears WCAG AA (≥4.5:1) against white type — that was
 * tested. Every colour must ALSO be distinguishable from every other, and that
 * was not: "deep teal" and "pine" sat 5.5 apart in CIEDE2000, which at 28px is
 * not a difference anybody can see, so two of eight identities were one. A
 * colour that cannot be told from another colour does not identify anything,
 * which is the whole job. `avatar.test.ts` now computes both — the contrast
 * ratios and the pairwise ΔE — so the build fails rather than a person having
 * to notice.
 *
 * THE BRAND NAVY IS DELIBERATELY ABSENT. It is `--brand-accent` and the focus
 * ring, so one shopper in eight would have carried an avatar the same colour as
 * the chrome around it.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Deep, saturated grounds with white type. Chosen to sit beside the brand's
 * navy rather than to span the wheel — a rainbow of avatars in a shop this
 * restrained would read as somebody else's component.
 */
export const AVATAR_COLOURS = [
  "#1B4FA8", // cobalt
  "#0F766E", // teal
  "#4D7C0F", // olive
  "#7A4B2A", // clay
  "#A32C2C", // signal red
  "#6D28A8", // violet
  "#831843", // wine
  "#3F3F46", // graphite
] as const;

/** White on every one of them. Kept as a constant so the test has one pair to
 *  check per colour rather than a convention to trust. */
export const AVATAR_FOREGROUND = "#FFFFFF";

/**
 * A stable index into the palette.
 *
 * FNV-1a rather than `String#hashCode`-by-hand: it is short, it has no
 * dependencies, and it distributes single-character differences — which matters
 * because the keys here are ids from one generator and emails at one domain,
 * i.e. strings that differ in very few places.
 */
export function avatarColourFor(key: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  /* XOR-FOLDED BEFORE THE MODULO. `hash % 8` reads only the low three bits, so
     the index depended on the last few bits of the last few characters — every
     pair of single-character codes differing by 8 collided. Folding the high
     half down first makes the whole hash contribute. It measured uniform on
     real ids either way; this removes the sharp edge rather than a live bug. */
  const folded = (hash ^ (hash >>> 16)) >>> 0;
  return AVATAR_COLOURS[folded % AVATAR_COLOURS.length];
}

/**
 * The letter to draw.
 *
 * The name's first letter, then the email's, then a full stop — never a blank
 * circle. A person with neither is a data state that should still render as a
 * person. Uppercased, and taken with `Array.from` so an emoji or an accented
 * character is one grapheme rather than half a surrogate pair.
 */
export function avatarInitial(name: string | null, email: string): string {
  const source = (name ?? "").trim() || email.trim();
  const first = Array.from(source)[0];
  return first ? first.toUpperCase() : "·";
}

export interface AvatarProps {
  /** The provider's picture, when the account has one. */
  imageUrl?: string | null;
  name: string | null;
  email: string;
  /** The stable key the colour is derived from. The customer id, ideally. */
  colourKey?: string;
  className?: string;
}

export function Avatar({ imageUrl, name, email, colourKey, className }: AvatarProps) {
  /* SIZED BY THE CALLER, but square and clipped here so a non-square upload
     cannot become an oval. */
  const shape = cn(
    "inline-flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full",
    className,
  );

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className={cn(shape, "object-cover")}
      />
    );
  }

  const background = avatarColourFor(colourKey || email || "");
  return (
    <span
      /* `aria-hidden`, always. The control around this names the account; a
         screen reader reading "A" between the cart and the search box is noise,
         and the letter is a visual shorthand rather than information. */
      aria-hidden="true"
      className={cn(shape, "text-xs font-semibold leading-none")}
      style={{ backgroundColor: background, color: AVATAR_FOREGROUND }}
    >
      {avatarInitial(name, email)}
    </span>
  );
}
