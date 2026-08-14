import type { BulkTier, Colour, Product, SizeOption } from "../data/types";

/**
 * Cart types, split out from `cart-context.tsx` so `storage.ts` — a plain
 * module with no React and no `"use client"` — can import `CartLine` without
 * pulling the provider in with it.
 *
 * Ruling R3: the brief's Step 1 opens with
 * `import type { CartLine } from "./types-or-inline"`, which is not a module,
 * only a drafting artefact. This file is the `./types` it should have named.
 */

/** Identifies one cart line: a specific product, colour and size. Two lines
 *  with the same key are the same line — quantities merge into one, they
 *  never stack as a duplicate entry. */
export interface CartLineKey {
  productSlug: string;
  colourId: string;
  sizeId: string;
}

/** The persisted shape. Identifiers and a quantity, never a price — see
 *  `storage.ts` for why that is the one hard rule of this task. */
export interface CartLine extends CartLineKey {
  qty: number;
}

/** A `CartLine` joined against the live catalog, with pricing computed fresh
 *  on every render rather than read from storage. Produced by
 *  `cart-context.tsx`'s `resolved`, which drops any line whose product,
 *  colour or size no longer exists in the catalog before it reaches this
 *  shape — a product pulled from the catalog must not crash the drawer. */
export interface ResolvedLine {
  key: string;
  product: Product;
  colour: Colour;
  size: SizeOption;
  qty: number;
  unitPrice: number;
  total: number;
  tier: BulkTier | null;
}

/** The cart's whole public surface. `hydrated` gates anything derived from
 *  `lines`/`resolved` — the server always renders an empty cart, and nothing
 *  that depends on the real one may render until the client has loaded it.
 *  See `cart-context.tsx` for the full rule. */
export interface CartApi {
  lines: CartLine[];
  resolved: ResolvedLine[];
  itemCount: number;
  subtotal: number;
  savings: number;
  hydrated: boolean;
  add(key: CartLineKey, qty?: number): void;
  setQty(key: CartLineKey, qty: number): void;
  remove(key: CartLineKey): void;
  clear(): void;
  isOpen: boolean;
  open(): void;
  close(): void;
}
