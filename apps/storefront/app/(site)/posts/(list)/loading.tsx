/**
 * The POST LIST's skeleton — and it lives in the `(list)` group so that it
 * covers the list and nothing else.
 *
 * ═══ A `loading.tsx` IS A SUSPENSE BOUNDARY OVER EVERY CHILD SEGMENT ═══
 * At `posts/` this file wrapped `[slug]` too, and that cost the blog its 404s:
 * Next flushed this shell — status 200, headers gone — and only then resolved
 * the page, so `notFound()` for a slug that does not exist arrived too late to
 * change the status. `/posts/anything-at-all` answered 200 on the FIRST
 * request, with `NEXT_HTTP_ERROR_FALLBACK;404` buried in the payload and the
 * not-found UI never rendered. Crawlers were told every made-up URL was a page.
 *
 * It was also the wrong picture: six card placeholders and a filter row, drawn
 * over an article nobody was listing.
 *
 * `/store/products/[slug]` never had this because the shop has no `loading.tsx`
 * above it — which is why that route 404s correctly and this one did not.
 */
import { Section, Container, Prose } from "@plaspool/ui";

export default function Loading() {
  return (
    <Section className="bg-white font-mono">
      <Container>
        <div className="space-y-8">
          <Prose>
            <div className="h-8 bg-muted rounded animate-pulse w-32" />
          </Prose>

          <div className="space-y-4">
            <div className="h-10 bg-muted rounded animate-pulse" />
            <div className="flex gap-2">
              <div className="h-10 bg-muted rounded animate-pulse w-24" />
              <div className="h-10 bg-muted rounded animate-pulse w-24" />
              <div className="h-10 bg-muted rounded animate-pulse w-24" />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border rounded-lg p-4 space-y-3">
                <div className="h-4 bg-muted rounded animate-pulse" />
                <div className="h-3 bg-muted rounded animate-pulse w-3/4" />
                <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}