import { DocRenderer } from "./doc-renderer";
import { CoverImg } from "./cover-img";
import { BLOG_DEFAULT_TEMPLATE, SHOW_READING_TIME } from "../data/config";
import type { PublicPostDetail, ReadingTemplate } from "../data/types";

import { Link } from "./link";

/**
 * The four reading layouts, ported from the admin app's
 * `src/reader/templates.tsx`. The DB stores a per-post template, the public
 * API has always sent it, and the storefront typed it and then ignored it —
 * an author picked "editorial", previewed it, published, and the public site
 * rendered a hardcoded layout instead (issue #15). This is the other half of
 * that contract.
 *
 * Adaptations from the admin original, all deliberate:
 *
 * - No `settings` object. The public API has no settings endpoint; the
 *   defaults live in `data/config.ts` and the author name is the post's own.
 * - No draft branches. Everything the public API serves is published, so the
 *   dateline is always the publication date and the Technical rail carries
 *   no Status row — "Status: published" on a public page is noise.
 * - No "Start writing" escape hatch in the empty state. A reader cannot
 *   edit; a published-but-empty post just says so.
 * - Tags are LINKS, not the admin's static chips. A public reader can act
 *   on a tag; an admin scanning a grid cannot, which is why theirs don't.
 * - The body class is `blog-prose` (see blog.css for the one rename).
 */

export interface TemplateProps {
  post: PublicPostDetail;
}

function Byline({ post }: { post: PublicPostDetail }) {
  const author = post.author.name;
  const dateLine = new Date(post.publishedAt).toLocaleDateString("en-NG", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="tpl__byline">
      <span className="tpl__avatar" aria-hidden="true">
        {author.slice(0, 1)}
      </span>
      <div>
        <p className="tpl__author">{author}</p>
        <p className="tpl__dateline">
          {dateLine}
          {SHOW_READING_TIME && post.wordCount > 0 && <> · {post.readingTime} min read</>}
        </p>
      </div>
    </div>
  );
}

function Body({ post }: { post: PublicPostDetail }) {
  if (post.wordCount === 0 || !post.content) {
    return (
      <div className="tpl__blank">
        <p>This post has no content yet.</p>
      </div>
    );
  }
  return (
    <div className="blog-prose tpl__body">
      <DocRenderer doc={post.content} />
    </div>
  );
}

function Tags({ post }: { post: PublicPostDetail }) {
  if (!post.tags.length) return null;
  return (
    <footer className="tpl__tags">
      {post.tags.map((t) => (
        <Link key={t} className="chip" href={`/posts?tag=${encodeURIComponent(t)}`}>
          {t}
        </Link>
      ))}
    </footer>
  );
}

/* ------------------------------------------------------------- magazine */

function Magazine({ post }: TemplateProps) {
  return (
    <article className="tpl tpl--magazine">
      <header className="tpl__head">
        {post.category && <p className="tpl__kicker">{post.category}</p>}
        <h1 className="tpl__title">{post.title.trim() || "Untitled"}</h1>
        {post.subtitle && <p className="tpl__subtitle">{post.subtitle}</p>}
        <Byline post={post} />
      </header>

      {post.coverImage && (
        <figure className="tpl__cover tpl__cover--wide">
          <CoverImg
            image={post.coverImage}
            fallbackAlt={post.title}
            className="tpl__cover-img"
            priority
          />
          {post.coverImage.alt && (
            <figcaption className="tpl__caption">{post.coverImage.alt}</figcaption>
          )}
        </figure>
      )}

      <Body post={post} />
      <Tags post={post} />
    </article>
  );
}

/* -------------------------------------------------------------- minimal */

function Minimal({ post }: TemplateProps) {
  return (
    <article className="tpl tpl--minimal">
      <header className="tpl__head">
        <h1 className="tpl__title">{post.title.trim() || "Untitled"}</h1>
        {post.subtitle && <p className="tpl__subtitle">{post.subtitle}</p>}
        <p className="tpl__meta-line">
          {post.author.name}
          {" · "}
          {new Date(post.publishedAt).toLocaleDateString("en-NG", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
          {SHOW_READING_TIME && post.wordCount > 0 && <> · {post.readingTime} min</>}
        </p>
      </header>
      <Body post={post} />
      <Tags post={post} />
    </article>
  );
}

/* ------------------------------------------------------------ editorial */

function Editorial({ post }: TemplateProps) {
  return (
    <article className="tpl tpl--editorial">
      {post.coverImage && (
        <figure className="tpl__cover tpl__cover--bleed">
          <CoverImg
            image={post.coverImage}
            fallbackAlt={post.title}
            className="tpl__cover-img"
            priority
          />
        </figure>
      )}
      <header className="tpl__head tpl__head--centred">
        {post.category && <p className="tpl__kicker">{post.category}</p>}
        <h1 className="tpl__title">{post.title.trim() || "Untitled"}</h1>
        {post.subtitle && <p className="tpl__subtitle">{post.subtitle}</p>}
        <div className="tpl__rule" aria-hidden="true" />
        <Byline post={post} />
      </header>
      <Body post={post} />
      <Tags post={post} />
    </article>
  );
}

/* ------------------------------------------------------------ technical */

function Technical({ post }: TemplateProps) {
  return (
    <article className="tpl tpl--technical">
      <div className="tpl__rail">
        <dl className="tpl__facts">
          <div>
            <dt>Author</dt>
            <dd>{post.author.name}</dd>
          </div>
          <div>
            <dt>Published</dt>
            <dd>
              <time dateTime={new Date(post.publishedAt).toISOString()}>
                {new Date(post.publishedAt).toLocaleDateString("en-NG", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </time>
            </dd>
          </div>
          {post.category && (
            <div>
              <dt>Category</dt>
              <dd>{post.category}</dd>
            </div>
          )}
          <div>
            <dt>Length</dt>
            <dd>
              {post.wordCount.toLocaleString()} words
              {SHOW_READING_TIME && post.wordCount > 0 && <> · {post.readingTime} min</>}
            </dd>
          </div>
        </dl>
        {post.tags.length > 0 && (
          <div className="tpl__rail-tags">
            {post.tags.map((t) => (
              <Link key={t} className="chip" href={`/posts?tag=${encodeURIComponent(t)}`}>
                {t}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="tpl__main">
        <header className="tpl__head">
          <h1 className="tpl__title">{post.title.trim() || "Untitled"}</h1>
          {post.subtitle && <p className="tpl__subtitle">{post.subtitle}</p>}
        </header>
        {post.coverImage && (
          <figure className="tpl__cover">
            <CoverImg
              image={post.coverImage}
              fallbackAlt={post.title}
              className="tpl__cover-img"
              priority
            />
          </figure>
        )}
        <Body post={post} />
      </div>
    </article>
  );
}

const REGISTRY: Record<ReadingTemplate, (p: TemplateProps) => React.ReactElement> = {
  magazine: Magazine,
  minimal: Minimal,
  editorial: Editorial,
  technical: Technical,
};

/**
 * The one place a layout is chosen. A post may pin its own; otherwise the
 * blog default. The `?? Magazine` below stays as the floor for a template
 * name this build doesn't know — a real case once the enum grows upstream,
 * and one that must render rather than throw.
 */
export function resolveTemplate(post: Pick<PublicPostDetail, "template">): ReadingTemplate {
  return post.template ?? BLOG_DEFAULT_TEMPLATE;
}

export function ArticleTemplate(props: TemplateProps) {
  const Chosen = REGISTRY[resolveTemplate(props.post)] ?? Magazine;
  return <Chosen {...props} />;
}
