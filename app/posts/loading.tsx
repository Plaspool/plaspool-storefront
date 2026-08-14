import { Section, Container, Prose } from "@/components/craft";

export default function Loading() {
  return (
    <Section className="bg-white font-mono">
      <Container>
        <div className="space-y-8">
          <Prose>
            <div className="h-8 bg-gray-200 rounded animate-pulse w-32" />
          </Prose>

          <div className="space-y-4">
            <div className="h-10 bg-gray-200 rounded animate-pulse" />
            <div className="flex gap-2">
              <div className="h-10 bg-gray-200 rounded animate-pulse w-24" />
              <div className="h-10 bg-gray-200 rounded animate-pulse w-24" />
              <div className="h-10 bg-gray-200 rounded animate-pulse w-24" />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border rounded-lg p-4 space-y-3">
                <div className="h-4 bg-gray-200 rounded animate-pulse" />
                <div className="h-3 bg-gray-200 rounded animate-pulse w-3/4" />
                <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}