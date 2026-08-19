import { describe, expect, it } from "vitest";

import { serialiseJsonLd } from "./json-ld";

/**
 * Regression test for the JSON-LD escaping fix (storefront #11).
 *
 * `JSON.stringify` escapes for JSON, not for HTML. Inside a `<script>` element
 * the parser hunts for the literal bytes `</script` and ends the element there
 * however well-quoted the JSON around them is — so a CMS-authored post title
 * is an XSS vector unless `<`, `>` and `&` leave as `\uXXXX`.
 */

const HOSTILE_TITLE = "test</script><script>alert(1)</script>";

describe("serialiseJsonLd", () => {
  it("emits no byte the HTML parser reacts to", () => {
    const out = serialiseJsonLd({ "@type": "Article", headline: HOSTILE_TITLE });
    expect(out).not.toContain("</script");
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
    expect(out).not.toContain("&");
  });

  it("closes neither the element nor a comment", () => {
    const out = serialiseJsonLd({ a: "</SCRIPT >", b: "<!--", c: "-->" });
    expect(out.toLowerCase()).not.toContain("</script");
    expect(out).not.toContain("<!--");
    expect(out).not.toContain("-->");
  });

  /* The escaping must be lossless: consumers parse `<` back to `<`, so
     Google's Rich Results Test sees exactly what it saw before. */
  it("round-trips to the identical object", () => {
    const data = {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: HOSTILE_TITLE,
      description: "A & B < C > D",
      author: { "@type": "Person", name: "R&D" },
      keywords: ["<a>", "&amp;"],
    };
    expect(JSON.parse(serialiseJsonLd(data))).toEqual(data);
  });

  it("uses the unicode escapes, not HTML entities", () => {
    expect(serialiseJsonLd("<&>")).toBe('"\\u003c\\u0026\\u003e"');
  });

  it("leaves ordinary content byte-identical to JSON.stringify", () => {
    const plain = { name: "Plaspool", url: "https://plaspool.com/" };
    expect(serialiseJsonLd(plain)).toBe(JSON.stringify(plain));
  });
});
