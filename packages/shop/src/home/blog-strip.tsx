import { Link } from "../components/link";
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
    /* `pwa-hide`: the installed app is the shop, and the blog is the website.
       A media query rather than a mount-time probe, so this never paints and
       then vanishes — see `.pwa-hide` in `globals.css`. The posts are still
       fetched above; the cost is one ISR-cached call on a page that was going
       to make it anyway, and paying it keeps this a server component. */
    <section aria-labelledby="shop-blog" className="pwa-hide border-t border-brand-line">
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

        {/* `blog-scope` puts the blog's design tokens in reach WITHOUT
            repainting the shop band they sit on: the cards below are blog
            objects — cream paper, hard edge, hard offset shadow, press-down
            on click — displayed inside shop chrome. The heading above stays
            the shop's; the boundary between the two systems runs exactly
            here (#15). */}
        <ul className="blog-scope mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <li key={post.id}>
              <Link
                href={`/posts/${post.slug}`}
                className={cn(
                  "blog-strip-card",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                )}
              >
                <div className="strip__media">
                  {post.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl(post.coverImage.url)}
                      alt=""
                      width={post.coverImage.width || undefined}
                      height={post.coverImage.height || undefined}
                      loading="lazy"
                      decoding="async"
                      className="strip__img"
                      style={{ objectPosition: post.coverImage.focalPoint || undefined }}
                    />
                  ) : null}
                </div>
                <div className="strip__body">
                  <h3 className="strip__title">{post.title}</h3>
                  <p className="strip__when">{post.readingTime} min read</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
