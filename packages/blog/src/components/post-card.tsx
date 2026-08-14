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
    <Link
      href={`/posts/${post.slug}`}
      className={cn(
        "border p-4 bg-gradient-to-r from-blue-900 to-slate-900 rounded-lg group flex justify-between flex-col not-prose gap-8",
        "hover:bg-slate-600 transition-all",
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
        <div className="text-xl text-white font-medium group-hover:underline decoration-muted-foreground underline-offset-4 decoration-dotted transition-all">
          {post.title}
        </div>
        <div className="text-sm text-white">{post.excerpt}</div>
      </div>

      <div className="flex flex-col gap-4">
        <hr />
        <div className="flex justify-between items-center text-xs text-white">
          <p>{post.category || "Uncategorised"}</p>
          <p>{date}</p>
        </div>
      </div>
    </Link>
  );
}
