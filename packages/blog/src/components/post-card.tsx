import { Link } from "./link";

import { CoverImg } from "./cover-img";
import type { PublicPost } from "../data/types";

/**
 * The post card, ported from the admin app's `PostCard` (issue #15): a
 * tinted sheet behind a hairline rule, with text first and the picture under
 * it, in the order the grid is actually scanned. The geometry lives in
 * `blog.css`; this file is the public adaptation of the admin's markup.
 *
 * THE COVER CARRIES NO "READ MORE" PILL. It used to — a pressable-looking
 * badge over the corner of the picture, `aria-hidden` and `pointer-events:
 * none`, marking where a button would be on a card that is itself one link.
 * It was decoration standing in for an affordance the whole card already
 * provides, it only ever appeared on posts that happened to have a cover, and
 * it sat on top of the image it was meant to advertise. The card is the
 * control; nothing needs to say so.
 *
 * What the adaptation drops is everything a reader cannot do: no status
 * chip (the public API only serves published posts — the accent spine
 * carries that instead), no Edit/Read/overflow actions, no restore. The
 * whole card is one link, drawn as an absolutely-positioned hit target so
 * the tag links can sit above it and stay independently clickable — the
 * admin's own pattern.
 *
 * The byline shows the ABSOLUTE date, not the admin's "3d ago": a relative
 * timestamp computed at render time is a hydration mismatch waiting to
 * happen on an ISR page (the server rendered it up to five minutes ago),
 * and it goes stale inside the cache window. The admin is a live SPA; this
 * is not.
 *
 * This replaces the interim NEO_SURFACE treatment from #7 — the issue that
 * predicted exactly this convergence: "both should be satisfied by this
 * port rather than implemented independently."
 */
export function PostCard({ post, index = 0 }: { post: PublicPost; index?: number }) {
  const title = post.title.trim() || "Untitled";
  const date = new Date(post.publishedAt).toLocaleDateString("en-NG", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <article
      className={["card", post.coverImage ? "" : "card--textonly"].filter(Boolean).join(" ")}
      // Position in the grid — drives the entrance stagger only. Capped so
      // a long page doesn't take seconds to appear.
      style={{ ["--i" as string]: Math.min(index, 12) }}
    >
      <Link className="card__hit" href={`/posts/${post.slug}`} aria-label={`Read ${title}`} />

      <div className="card__body">
        {post.category && (
          <div className="card__meta">
            <span className="card__cat">{post.category}</span>
          </div>
        )}

        <h2 className="card__title">{title}</h2>
        {post.subtitle && <p className="card__subtitle">{post.subtitle}</p>}
        {post.excerpt && <p className="card__excerpt">{post.excerpt}</p>}

        {post.tags.length > 0 && (
          <div className="card__tags">
            {post.tags.slice(0, 4).map((t) => (
              <Link
                key={t}
                className="card__tag"
                href={`/posts?tag=${encodeURIComponent(t)}`}
              >
                {t}
              </Link>
            ))}
            {post.tags.length > 4 && (
              <span className="card__tag card__tag--more">+{post.tags.length - 4}</span>
            )}
          </div>
        )}

        <footer className="card__by">
          <span className="card__avatar" aria-hidden="true">
            {initials(post.author.name)}
          </span>
          <span className="card__byline">
            <span className="card__author">{post.author.name || "Unknown writer"}</span>
            <span className="card__when">
              <time dateTime={new Date(post.publishedAt).toISOString()}>{date}</time>
              {" · "}
              {post.wordCount === 0 ? "Empty" : `${post.readingTime} min read`}
            </span>
          </span>
        </footer>
      </div>

      {post.coverImage && (
        <div className="card__media">
          <CoverImg image={post.coverImage} fallbackAlt={title} className="card__img" />
        </div>
      )}
    </article>
  );
}

/** Up to two initials for the byline disc — the admin's rule, ported. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "·";
  const first = parts[0]![0]!;
  const last = parts.length > 1 ? parts[parts.length - 1]![0]! : "";
  return (first + last).toUpperCase();
}
