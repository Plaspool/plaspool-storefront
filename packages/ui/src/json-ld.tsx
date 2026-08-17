/**
 * The one way structured data is allowed to reach the page.
 *
 * `JSON.stringify` escapes for JSON, not for HTML. Inside a `<script>` element
 * the parser hunts for the literal bytes `</script` and ends the element there
 * no matter how well-quoted the JSON around them is — so a CMS-authored post
 * title containing `</script><script>…` closes our block and opens the
 * attacker's. `<!--` is the same story through the comment state.
 *
 * Escaping `<`, `>` and `&` to their `\uXXXX` forms removes every byte the HTML
 * parser reacts to while staying valid JSON: consumers parse `<` back to
 * `<`, so Google's Rich Results Test sees exactly what it saw before.
 *
 * Use this component for every `application/ld+json` block. Injecting one by
 * hand with `dangerouslySetInnerHTML={{ __html: JSON.stringify(x) }}` is the
 * bug this exists to prevent.
 */
export function serialiseJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serialiseJsonLd(data) }}
    />
  );
}
