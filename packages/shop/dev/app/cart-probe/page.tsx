"use client";

import { Button } from "@plaspool/ui";
import {
  AddToCartButton,
  CartDrawer,
  CartProvider,
  formatNaira,
  getProduct,
  useCart,
  type CartLineKey,
  type Product,
} from "@plaspool/shop";

/**
 * Harness-only. Exercises `CartProvider`, `useCart`, `CartDrawer` and
 * `AddToCartButton` against the real catalog before any storefront surface
 * uses them. Task 14 deletes this route.
 */

function requireProduct(slug: string): Product {
  const product = getProduct(slug);
  if (!product) throw new Error(`cart-probe: missing fixture product "${slug}"`);
  return product;
}

const PRODUCT_A = requireProduct("pla-basic");
const PRODUCT_B = requireProduct("pla-plus-basic");

/** Two in stock, one (solar yellow) globally out of stock, so the disabled
 *  path is reachable without editing a fixture. */
const PROBE_COLOUR_IDS = ["obsidian-black", "signal-red", "solar-yellow"];

function ProbeRow({
  product,
  colourId,
  variant,
}: {
  product: Product;
  colourId: string;
  variant?: "default" | "outline";
}) {
  const colour = product.colours.find((c) => c.id === colourId);
  if (!colour) return null;

  return (
    <tr className="border-b border-brand-line last:border-b-0">
      <td className="px-3 py-2 align-middle font-sans text-sm text-foreground">{product.name}</td>
      <td className="px-3 py-2 align-middle font-sans text-sm text-foreground">
        {colour.name}
        {!colour.inStock && (
          <span className="ml-1.5 font-mono text-xs text-muted-foreground">(out of stock)</span>
        )}
      </td>
      {product.sizes.map((size) => (
        <td key={size.id} className="px-3 py-2 align-middle">
          <AddToCartButton
            line={{ productSlug: product.slug, colourId: colour.id, sizeId: size.id }}
            qty={1}
            disabled={!colour.inStock}
            variant={variant}
          />
        </td>
      ))}
    </tr>
  );
}

function CartProbeContent() {
  const cart = useCart();

  const duplicateLine: CartLineKey = {
    productSlug: PRODUCT_A.slug,
    colourId: PRODUCT_A.colours[0].id,
    sizeId: PRODUCT_A.sizes[0].id,
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <header className="mb-10 border-b border-brand-line pb-8">
        <h1 className="font-sans text-2xl font-bold text-foreground">Cart probe</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Harness-only. Exercises the cart before any real storefront surface uses it.
        </p>
        <p className="mt-4 font-mono text-xs tabular-nums text-muted-foreground">
          hydrated: {String(cart.hydrated)} · lines: {cart.lines.length} · items:{" "}
          {cart.itemCount} · subtotal: {formatNaira(cart.subtotal)}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={() => cart.open()}
            className="focus-visible:ring-brand focus-visible:ring-offset-background"
          >
            Open cart
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => cart.clear()}
            className="focus-visible:ring-brand focus-visible:ring-offset-background"
          >
            Clear cart
          </Button>
        </div>
      </header>

      <section className="mb-10">
        <h2 className="mb-1 font-sans text-lg font-semibold text-foreground">Add lines</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Two products, three colours, both sizes. Solar yellow is out of stock everywhere, so
          its row should render disabled buttons.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-brand-line">
                <th
                  scope="col"
                  className="px-3 pb-2 font-sans text-xs font-semibold text-muted-foreground"
                >
                  Product
                </th>
                <th
                  scope="col"
                  className="px-3 pb-2 font-sans text-xs font-semibold text-muted-foreground"
                >
                  Colour
                </th>
                {PRODUCT_A.sizes.map((size) => (
                  <th
                    key={size.id}
                    scope="col"
                    className="px-3 pb-2 font-sans text-xs font-semibold text-muted-foreground"
                  >
                    {size.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PROBE_COLOUR_IDS.map((id) => (
                <ProbeRow key={`${PRODUCT_A.slug}-${id}`} product={PRODUCT_A} colourId={id} />
              ))}
              <ProbeRow
                product={PRODUCT_B}
                colourId={PRODUCT_B.colours[0].id}
                variant="outline"
              />
              <ProbeRow
                product={PRODUCT_B}
                colourId={PRODUCT_B.colours[1].id}
                variant="outline"
              />
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-1 font-sans text-lg font-semibold text-foreground">
          Merge and bulk-tier test
        </h2>
        <p className="mb-4 max-w-xl text-sm text-muted-foreground">
          Both buttons below add the exact same line. Two clicks should merge into one line at
          quantity 2, not create two lines. Then use the stepper in the drawer to push that line
          to 4, then 6, and watch the unit price and the bulk chip.
        </p>
        <div className="flex flex-wrap gap-3">
          <AddToCartButton line={duplicateLine} qty={1} label="Add — button one" />
          <AddToCartButton line={duplicateLine} qty={1} label="Add — button two" />
        </div>
      </section>
    </main>
  );
}

export default function CartProbePage() {
  return (
    <CartProvider>
      <CartProbeContent />
      <CartDrawer />
    </CartProvider>
  );
}
