import { afterEach, describe, expect, it, vi } from "vitest";
import { getLineImages } from "./catalog";

/**
 * What an order line's picture resolves to, and what it must never resolve to.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT THESE EXIST TO PREVENT COMING BACK.
 *
 * An `OrderLine` has no image field. It is a purchase-time snapshot, so a
 * picture on an order page is necessarily a claim sourced from TODAY'S
 * catalogue about a PAST purchase — and three adversarial reviews of these
 * surfaces have all found the same shape of bug: the page asserting something
 * it does not know. An `alt` naming a colour the photograph was not of. A
 * control claiming an address the fields no longer held.
 *
 * So the assertions below are about the DISTINCTIONS, not the happy path:
 *
 *   - a photograph OF this colour vs. the product's cover standing in for one,
 *     because only the first may be named after the colour, and today the
 *     second is every line in the shop;
 *   - "the catalogue knows this variant and nobody photographed it" (which
 *     still has a colour, and draws a spool in it) vs. "the catalogue cannot
 *     describe this variant at all" (which has nothing, and must draw nothing);
 *   - a presigned URL never reaching a caller, because `/api/public/images/:id`
 *     answers a 302 whose credential outlives nothing.
 *
 * And one property that is not a distinction at all: this never throws. An
 * unreachable catalogue costs pictures, never the page a customer opened to
 * find out where their order is.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

/** A `Response`-shaped stub. Only the parts `getJson` actually reads. */
function respond(status: number, body: unknown = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

/** One product, shaped like the live catalogue's: `variants` ON THE LIST
 *  response, `weightGrams: null` on every variant, the weight only in the
 *  free-text option. */
function catalogue(over: {
  coverImageUrl?: string | null;
  variants?: Partial<{
    id: string;
    colorHex: string | null;
    imageUrl: string | null;
    weightGrams: number | null;
    status: string;
    price: unknown;
    optionValues: Record<string, string>;
  }>[];
}) {
  return {
    items: [
      {
        id: "prd_1",
        slug: "pla-filament",
        title: "PLA Filament",
        description: null,
        status: "active",
        category: "Filament",
        tags: ["PLA"],
        coverImageUrl:
          over.coverImageUrl === undefined
            ? "/api/public/images/img_cover"
            : over.coverImageUrl,
        imageUrls: [],
        publishedAt: 1786794051289,
        variants: (over.variants ?? []).map((v, i) => ({
          id: v.id ?? `var_${i}`,
          sku: `SKU-${i}`,
          optionValues: v.optionValues ?? { Colour: "Black", Weight: "1 kg" },
          position: i,
          weightGrams: v.weightGrams ?? null,
          status: v.status ?? "active",
          colorHex: v.colorHex === undefined ? "#111111" : v.colorHex,
          price: v.price === undefined ? { amount: 2300000, currency: "NGN" } : v.price,
          available: 4,
          backorderable: false,
          imageUrl: v.imageUrl ?? null,
        })),
      },
    ],
    nextCursor: null,
  };
}

function serve(body: unknown) {
  global.fetch = vi.fn().mockResolvedValue(respond(200, body));
}

describe("a variant the catalogue cannot describe", () => {
  it("is ABSENT from the index rather than present with a guessed colour", async () => {
    /*
     * The case a discontinued product produces on an old order: the line still
     * carries `variantId`, `title` and `optionValues.Colour`, so it would be
     * easy to draw a spool from the line's own colour NAME and a default hex.
     * That would be a picture of a grey spool presented as a picture of what
     * somebody bought. An absent key is the only honest answer, and it is what
     * makes `LineThumb` render its "no picture" box.
     */
    serve(catalogue({ variants: [{ id: "var_live" }] }));

    const images = await getLineImages();
    expect(images).not.toHaveProperty("var_discontinued_no_longer_sold");
    expect(images["var_discontinued_no_longer_sold"]).toBeUndefined();
  });
});

describe("a catalogue that cannot be read", () => {
  it("answers an empty index rather than throwing, for a transport failure", async () => {
    // `fetch` rejects for transport failures and for nothing else.
    global.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(getLineImages()).resolves.toEqual({});
  });

  it("answers an empty index rather than throwing, for a non-2xx", async () => {
    global.fetch = vi.fn().mockResolvedValue(respond(503));

    await expect(getLineImages()).resolves.toEqual({});
  });

  it("collapses into the same absent key an unknown variant produces", async () => {
    /*
     * STATED HERE BECAUSE IT IS A DECISION, NOT AN ACCIDENT. "This variant is
     * gone" and "the catalogue is down" are indistinguishable to a caller, and
     * `getLineImages()` argues why: a 48px box beside a row that already names
     * the purchase cannot carry a reason, and both reasons produce the same
     * fact — there is no picture of this. What they must NOT collapse into is
     * the case below, where a colour is known and a spool may be drawn.
     */
    global.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const down = await getLineImages();

    serve(catalogue({ variants: [{ id: "var_other" }] }));
    const up = await getLineImages();

    expect(down["var_live"]).toBeUndefined();
    expect(up["var_live"]).toBeUndefined();
  });
});

describe("a variant nobody has photographed", () => {
  it("falls back to the product's cover and marks it as NOT a picture of this colour", async () => {
    /*
     * THE STATE OF THE LIVE SHOP. Every variant has `imageUrl: null` and the
     * product has a cover, so this is what every line in every order resolves
     * to today. `ofThisColour: false` is the entire defence against an `alt`
     * reading "PLA Filament, Black" over a picture of the product in general.
     */
    serve(catalogue({ variants: [{ id: "var_live", imageUrl: null }] }));

    const image = (await getLineImages())["var_live"];
    expect(image).toEqual({
      src: "/images/shop/img_cover",
      ofThisColour: false,
      colourHex: "#111111",
      weightGrams: 1000,
    });
  });

  it("keeps the colour when the product has no cover either, so a spool can be drawn", async () => {
    /*
     * `src: null` is NOT the same answer as an absent key, and the difference
     * is the whole honesty argument: the catalogue knows this variant and knows
     * its colour, so `SpoolImage` tinted to that hex is a true picture of it.
     */
    serve(catalogue({ coverImageUrl: null, variants: [{ id: "var_live", colorHex: "#c62828" }] }));

    expect((await getLineImages())["var_live"]).toMatchObject({
      src: null,
      ofThisColour: false,
      colourHex: "#c62828",
    });
  });

  it("keeps a missing hex as null rather than standing a grey in for it", async () => {
    /*
     * THE DEFECT THIS PINS. `colourHex` used to default to the module's
     * `NO_COLOUR_SET` grey, and the renderer inferred "we know the colour" from
     * `src === null` — true of the case above, false of this one. The rendered
     * result was a `#8a8a94` spool under `aria-label="PLA Filament, Red"`.
     *
     * A default that stands in for missing knowledge cannot also be the signal
     * that the knowledge is missing. `line-thumb.test.tsx` asserts the other
     * half: that this entry draws nothing and is named nothing.
     */
    serve(catalogue({ coverImageUrl: null, variants: [{ id: "var_live", colorHex: null }] }));

    const image = (await getLineImages())["var_live"];
    expect(image?.colourHex).toBeNull();
    expect(image?.colourHex).not.toBe("#8a8a94");
  });

  it("still keeps a missing hex as null when the product HAS a cover to show", async () => {
    /* The photograph carries the row on its own here, so the null hex costs
       nothing visible — but it must still not become a grey, because
       `ofThisColour` is false and a later reader must not be able to recover a
       "colour" from this entry at all. */
    serve(catalogue({ variants: [{ id: "var_live", colorHex: null }] }));

    expect((await getLineImages())["var_live"]).toMatchObject({
      src: "/images/shop/img_cover",
      ofThisColour: false,
      colourHex: null,
    });
  });
});

describe("a variant with its own photograph", () => {
  it("prefers it over the cover and marks it AS a picture of this colour", async () => {
    serve(
      catalogue({
        variants: [{ id: "var_live", imageUrl: "/api/public/images/img_black" }],
      }),
    );

    expect((await getLineImages())["var_live"]).toMatchObject({
      src: "/images/shop/img_black",
      ofThisColour: true,
    });
  });
});

describe("the URL that reaches the page", () => {
  it("is the cacheable same-origin proxy, never the API's redirecting endpoint", async () => {
    /*
     * `/api/public/images/:id` answers a 302 to a presigned R2 URL, and the
     * redirect carries `private, no-store` because a cached 302 would outlive
     * the credential inside it. `imageUrl()` owns the rewrite to
     * `/images/shop/:id`; this asserts the order surfaces get the same
     * treatment every other picture in the shop gets rather than their own.
     */
    serve(catalogue({ variants: [{ id: "var_live" }] }));

    const src = (await getLineImages())["var_live"]?.src;
    expect(src).toBe("/images/shop/img_cover");
    expect(src).not.toContain("/api/public/images/");
    expect(src).not.toMatch(/^https?:/);
  });
});

describe("what is deliberately NOT filtered out", () => {
  it("indexes a deactivated, unpriced variant of a slugless product", async () => {
    /*
     * `toProduct` drops all three — no slug means no page to link to, no price
     * means nothing quotable, `status !== "active"` means nothing addable to a
     * cart. Every one of those tests asks "can this be SOLD?".
     *
     * An order page asks what the thing they ALREADY BOUGHT looks like. A spool
     * delisted in March is still the spool in the box. Filtering here would
     * blank the pictures on exactly the oldest orders — whose owners are least
     * able to remember what they ordered — and it is the reason this is not
     * built on `listProducts()`.
     */
    const body = catalogue({
      variants: [{ id: "var_retired", status: "archived", price: null }],
    });
    serve({ ...body, items: [{ ...body.items[0], slug: null }] });

    expect((await getLineImages())["var_retired"]).toMatchObject({
      src: "/images/shop/img_cover",
      colourHex: "#111111",
    });
  });
});

describe("the drawn spool's fill level", () => {
  it("reads the free-text Weight option, because `weightGrams` is null on every live variant", async () => {
    serve(
      catalogue({
        coverImageUrl: null,
        variants: [
          { id: "var_kg", optionValues: { Colour: "Black", Weight: "1 kg" } },
          { id: "var_g", optionValues: { Colour: "Black", Weight: "750 g" } },
        ],
      }),
    );

    const images = await getLineImages();
    expect(images["var_kg"]?.weightGrams).toBe(1000);
    expect(images["var_g"]?.weightGrams).toBe(750);
  });

  it("is 0 when no label says, rather than a guessed spool", async () => {
    serve(
      catalogue({
        coverImageUrl: null,
        variants: [{ id: "var_nolabel", optionValues: { Colour: "Black" } }],
      }),
    );

    expect((await getLineImages())["var_nolabel"]?.weightGrams).toBe(0);
  });
});

describe("the request itself", () => {
  it("is one cached read of the public product list, on the catalogue's own window", async () => {
    /*
     * ONE FETCH, SHARED BY EVERY LINE OF EVERY ORDER ON THE PAGE — the cost
     * ceiling this whole seam exists to hold. The explicit `revalidate` is also
     * what keeps it cached on a `force-dynamic` route, where the segment
     * default is otherwise `no-store`.
     */
    serve(catalogue({ variants: [{ id: "var_live" }] }));

    await getLineImages();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(global.fetch).mock.calls[0];
    expect(String(url)).toContain("/api/shop/products");
    expect(String(url)).not.toContain("review");
    expect(init).toMatchObject({ next: { revalidate: 300 } });
  });
});
