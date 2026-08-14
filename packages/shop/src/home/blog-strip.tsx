import Link from "next/link";
import { listPosts, imageUrl, type PublicPost } from "@plaspool/blog";
import { cn } from "@plaspool/ui";

/**
 * The last band: three posts from the Phase 1 content API. A server component,
 * because the API is fetched server-side and its base URL is not a public one.
 *
 * The API is a separate service. A shop home must not 500 because a content
 * service is unreachable, and an empty strip with a heading over it is worse
 * than no strip — so both failure and emptiness render nothing at all. The API
 * returns empty collections today while the platform is populated, so the
 * expected result right now is that this section does not appear.
 */

export async function BlogStrip() {
  let posts: PublicPost[] = [];
  try {
    const list = await listPosts({ limit: 3 });
    posts = list.items;
  } catch {
    return null;
  }
  if (!posts.length) return null;

  return (
    <section aria-labelledby="shop-blog" className="border-t border-brand-line">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-14 lg:px-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2
            id="shop-blog"
            className="font-sans text-xl font-semibold text-foreground sm:text-2xl"
          >
            Guides and news
          </h2>
          <Link
            href="/posts"
            className={cn(
              "rounded-sm font-sans text-sm font-medium text-brand underline-offset-4 hover:underline",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
          >
            Read the blog
          </Link>
        </div>

        <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <li key={post.id} className="group">
              <Link
                href={`/posts/${post.slug}`}
                className={cn(
                  "block rounded-sm",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                )}
              >
                {/* A plain `<img>`: the deploy target is Workers, which has no
                    sharp, and the cover URL is presigned — it is resolved
                    through `imageUrl()` on every render and never baked into
                    the page. */}
                {post.coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrl(post.coverImage.url)}
                    alt=""
                    loading="lazy"
                    className="aspect-[16/9] w-full rounded-lg border border-brand-line object-cover"
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className="aspect-[16/9] w-full rounded-lg border border-brand-line bg-brand-soft"
                  />
                )}
                <h3
                  className={cn(
                    "mt-3 font-sans text-base font-semibold leading-snug text-foreground",
                    "transition-colors group-hover:text-brand motion-reduce:transition-none",
                  )}
                >
                  {post.title}
                </h3>
              </Link>
              <p className="mt-1.5 font-mono text-xs tabular-nums text-muted-foreground">
                {post.readingTime} min read
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
