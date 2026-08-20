"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { CoverImg } from "./cover-img";
import type { PublicPost } from "../data/types";

/**
 * The featured rail — one post at a time, with arrows and dots.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * IT DOES NOT AUTO-ADVANCE, AND THAT IS THE DESIGN, NOT AN OMISSION.
 *
 * A rail that moves on a timer takes the thing a reader is halfway through
 * reading and replaces it. Every fix for that — pause on hover, pause on
 * focus, pause on tab-hidden — is another piece of machinery apologising for
 * the timer. There are at most four items and they are all one tap apart, so
 * the timer buys nothing that the dots do not already offer.
 *
 * WHAT IT IS, STRUCTURALLY. A labelled group of slides, exactly one of which
 * is in the DOM-visible flow at a time. The inactive slides are NOT rendered
 * hidden-but-present: a screen reader in browse mode would otherwise walk
 * straight through four headings and four "Read more" links that are not on
 * screen, and a keyboard user would tab into a card they cannot see. So the
 * component renders ONE slide, and the controls announce position instead.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface FeaturedCarouselProps {
  posts: PublicPost[];
  /** Heading id, so the section this lives in can be `aria-labelledby` it. */
  labelledBy?: string;
}

export function FeaturedCarousel({ posts, labelledBy }: FeaturedCarouselProps) {
  const [index, setIndex] = React.useState(0);
  const count = posts.length;

  /*
   * CLAMPED DURING RENDER, NOT SYNCED IN AN EFFECT.
   *
   * A shrinking rail must not strand the viewport on a slide that no longer
   * exists — ISR means this list can change under a client that has been open
   * for a whole revalidate window. The obvious version of that is a
   * `useEffect` that resets the index when `count` drops, and it is wrong
   * twice over: it renders one frame against the stale index first, and it
   * costs a second render pass to correct itself. Deriving the safe index
   * here means there is no invalid frame to correct.
   */
  const safeIndex = index < count ? index : 0;

  /* Wrapping in both directions: with four items, "previous" from the first
     meaning "nothing happens" is a control that looks broken. Computed off
     `safeIndex` so a click during a shrink moves from where the reader can
     actually see, not from the stale value. */
  const go = React.useCallback(
    (delta: number) => setIndex((i) => ((i < count ? i : 0) + delta + count) % count),
    [count],
  );

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      }
    },
    [go],
  );

  /*
   * Swipe, without a gesture library and without touching `touchmove`.
   *
   * `touchmove` is where a carousel usually starts fighting the page: to tell
   * a horizontal swipe from a vertical scroll you have to `preventDefault()`,
   * and on a rail this wide most drags ARE the reader scrolling the page.
   * Comparing the start and end points of the touch decides the same question
   * after the fact, costs no listener during the drag, and cannot ever cancel
   * a scroll that the reader meant.
   */
  const touchX = React.useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.changedTouches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchX.current;
    touchX.current = null;
    if (start === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? start) - start;
    /* 44px — the same floor the tap targets use. Below it, a swipe is a tap
       that wobbled, and the whole slide is a link. */
    if (Math.abs(dx) < 44) return;
    go(dx < 0 ? 1 : -1);
  };

  if (count === 0) return null;

  const post = posts[safeIndex]!;
  const title = post.title.trim() || "Untitled";
  const date = new Date(post.publishedAt).toLocaleDateString("en-NG", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      className="feat"
      role="group"
      aria-roledescription="carousel"
      aria-labelledby={labelledBy}
      onKeyDown={onKeyDown}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/*
        `aria-live="polite"` on the slide container, not on the whole
        component: moving between slides should announce the post that
        arrived, and nothing else. The arrows and dots below are outside it,
        so re-rendering them says nothing.
      */}
      <div className="feat__stage" aria-live="polite">
        <article
          className="feat__slide"
          /* Re-keying on the post id restarts the entrance transition, which
             is what makes the change legible as movement rather than as the
             text silently becoming different text. */
          key={post.id}
          aria-roledescription="slide"
          aria-label={`${safeIndex + 1} of ${count}`}
        >
          <Link className="feat__hit" href={`/posts/${post.slug}`} aria-label={`Read ${title}`} />

          {post.coverImage ? (
            <div className="feat__media">
              <CoverImg image={post.coverImage} fallbackAlt={title} className="feat__img" />
              <span className="card__more" aria-hidden="true">
                Read More
                <ArrowRight className="ui-ic" />
              </span>
            </div>
          ) : (
            /* No cover is a normal state, not a broken one — the API serves
               posts without images. A flat band keeps the rail's height
               stable so the dots below do not jump between slides. */
            <div className="feat__media feat__media--empty" aria-hidden="true" />
          )}

          <div className="feat__body">
            {post.category && <span className="card__cat">{post.category}</span>}
            <h3 className="feat__title">{title}</h3>
            {(post.excerpt || post.subtitle) && (
              <p className="feat__excerpt">{post.excerpt || post.subtitle}</p>
            )}
            <p className="feat__by">
              <span className="card__author">{post.author.name || "Unknown writer"}</span>
              <span className="card__when">
                <time dateTime={new Date(post.publishedAt).toISOString()}>{date}</time>
                {" · "}
                {post.wordCount === 0 ? "Empty" : `${post.readingTime} min read`}
              </span>
            </p>
          </div>
        </article>
      </div>

      {/* One item is not a carousel. The slide still renders; the machinery
          around it does not. */}
      {count > 1 && (
        <div className="feat__controls">
          <div className="feat__arrows">
            <button type="button" className="feat__arrow" onClick={() => go(-1)}>
              <ArrowLeft className="ui-ic" aria-hidden="true" />
              <span className="sr-only">Previous featured post</span>
            </button>
            <button type="button" className="feat__arrow" onClick={() => go(1)}>
              <ArrowRight className="ui-ic" aria-hidden="true" />
              <span className="sr-only">Next featured post</span>
            </button>
          </div>

          <div className="feat__dots">
            {posts.map((p, i) => (
              <button
                key={p.id}
                type="button"
                className={`feat__dot${i === safeIndex ? " is-on" : ""}`}
                aria-current={i === safeIndex ? "true" : undefined}
                onClick={() => setIndex(i)}
              >
                {/* The dot is 8px; the label is what makes it a real control
                    for anyone not using a mouse. */}
                <span className="sr-only">{`Featured post ${i + 1} of ${count}`}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
