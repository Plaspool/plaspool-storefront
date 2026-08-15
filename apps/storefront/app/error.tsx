"use client";

import { useEffect } from "react";
import { Button, Container, Section } from "@plaspool/ui";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Section>
      <Container>
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-6">
          <h1 className="text-3xl font-bold">Something went wrong</h1>
          <p className="text-muted-foreground max-w-md">
            This page failed to load. It is usually temporary — trying again often
            works.
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground">Reference: {error.digest}</p>
          )}
          <div className="flex gap-3 not-prose">
            <Button onClick={reset}>Try again</Button>
            <Button asChild variant="outline">
              <Link href="/">Go home</Link>
            </Button>
          </div>
        </div>
      </Container>
    </Section>
  );
}
