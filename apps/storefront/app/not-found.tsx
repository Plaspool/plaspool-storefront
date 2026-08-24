import { Button, Container, Input, Section } from "@plaspool/ui";
import { BrandLogo } from "@plaspool/brand";

import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <Section>
      <Container>
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-6">
          <BrandLogo variant="mark" tone="light" className="h-16" />
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">We couldn&apos;t find that page</h1>
            <p className="text-muted-foreground max-w-md">
              The link may be out of date, or the page may have moved. Try a search,
              or start from one of these.
            </p>
          </div>
          {/* A plain GET form rather than the blog's SearchInput: that component
              rewrites the *current* path's query string, which on a 404 route
              would search nothing. This lands on /posts?search=… instead, and
              keeps this page a server component. */}
          <form action="/posts" className="w-full max-w-sm not-prose">
            <label htmlFor="search" className="sr-only">
              Search the blog
            </label>
            <Input
              id="search"
              type="search"
              name="search"
              placeholder="Search posts..."
            />
          </form>
          <div className="flex flex-wrap gap-3 justify-center not-prose">
            <Button asChild>
              <Link href="/">Home</Link>
            </Button>
            <Button asChild variant="outline">
              {/* The one `/shop` link left in the browser. `prefetch={false}`
                  because the splash is a page that exists to be left — warming
                  its payload buys nothing. See `nav.tsx` for the full note. */}
              <Link href="/shop" prefetch={false}>Shop filaments</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/posts">Blog</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/contact">Contact us</Link>
            </Button>
          </div>
        </div>
      </Container>
    </Section>
  );
}
