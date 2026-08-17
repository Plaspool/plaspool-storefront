import Link from "next/link";

import { cn } from "@plaspool/ui";

import { imageUrl } from "../data/posts";
import type { PublicPost } from "../data/types";

export function PostCard({ post }: { post: PublicPost }) {
  const date = new Date(post.publishedAt).toLocaleDateString("en-NG", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    // The navy-to-slate gradient this replaced was one hardcoded dark panel
    // among otherwise-light cards — visually the loudest thing on the page
    // for no reason tied to the content. A post card is not the shop; it
    // gets the same neutral card treatment as everything else: a plain
    // surface and a border.
    //
    // The hover state is neobrutalist rather than a soft lift: the shadow is a
    // hard offset copy of the card in the brand accent, no blur, so the card
    // reads as a physical object sitting above the page. Hover deepens the
    // offset and lifts the card away from it; :active collapses the offset to
    // zero and moves the card down into where the shadow was, which is what
    // sells the press. The two transforms are the same distance in opposite
    // directions, so the shadow's outer edge never moves — only the gap does.
    //
    // Distances are held in one place because three properties have to agree:
    // change the shadow offset and the translate must follow it.
    <Link
      href={`/posts/${post.slug}`}
      className={cn(
        "border-2 border-foreground bg-card p-4 rounded-lg group flex justify-between flex-col not-prose gap-8",
        "shadow-[4px_4px_0_0_hsl(var(--brand-accent))]",
        "hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_hsl(var(--brand-accent))]",
        "active:translate-x-1 active:translate-y-1 active:shadow-[0_0_0_0_hsl(var(--brand-accent))]",
        // Keyboard users get the hover treatment too — the pressed state is
        // pointer-only feedback, but the raised state is information.
        "focus-visible:outline-none focus-visible:-translate-x-0.5 focus-visible:-translate-y-0.5",
        "focus-visible:shadow-[6px_6px_0_0_hsl(var(--brand-accent))]",
        "focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "transition-[transform,box-shadow] duration-100 ease-out",
        // Reduced motion keeps the states, drops the travel: the shadow still
        // changes depth, the card just does not slide.
        "motion-reduce:transition-none motion-reduce:hover:translate-x-0 motion-reduce:hover:translate-y-0",
        "motion-reduce:active:translate-x-0 motion-reduce:active:translate-y-0",
      )}
    >
      <div className="flex flex-col gap-4">
        <div className="h-48 w-full overflow-hidden relative rounded-md border flex items-center justify-center bg-muted">
          {post.coverImage ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              className="h-full w-full object-cover"
              style={{ objectPosition: post.coverImage.focalPoint || undefined }}
              src={imageUrl(post.coverImage.url)}
              alt={post.coverImage.alt || post.title}
              loading="lazy"
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full text-muted-foreground">
              No image available
            </div>
          )}
        </div>
        <div className="text-xl text-card-foreground font-medium group-hover:underline decoration-muted-foreground underline-offset-4 decoration-dotted transition-all">
          {post.title}
        </div>
        <div className="text-sm text-muted-foreground">{post.excerpt}</div>
      </div>

      <div className="flex flex-col gap-4">
        <hr />
        <div className="flex justify-between items-center text-xs text-muted-foreground">
          <p>{post.category || "Uncategorised"}</p>
          <p>{date}</p>
        </div>
      </div>
    </Link>
  );
}
