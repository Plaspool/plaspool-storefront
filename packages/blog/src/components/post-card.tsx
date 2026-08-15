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
    // surface, a border, a subtle lift on hover.
    <Link
      href={`/posts/${post.slug}`}
      className={cn(
        "border bg-card p-4 rounded-lg group flex justify-between flex-col not-prose gap-8",
        "transition-shadow hover:shadow-md motion-reduce:transition-none",
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
