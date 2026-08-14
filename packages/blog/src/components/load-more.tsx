"use client";

import { useState } from "react";

import { Button } from "@plaspool/ui";

import { PostCard } from "./post-card";
import { BLOG_API, POSTS_PER_PAGE } from "../data/config";
import type { ListParams, PublicPost } from "../data/types";

export function LoadMore({
  initialCursor,
  params,
}: {
  initialCursor: string | null;
  params: ListParams;
}) {
  const [posts, setPosts] = useState<PublicPost[]>([]);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    setFailed(false);
    try {
      const url = new URL(`${BLOG_API}/posts`);
      url.searchParams.set("cursor", cursor);
      url.searchParams.set("limit", String(POSTS_PER_PAGE));
      for (const key of ["category", "tag", "search", "sort"] as const) {
        const value = params[key];
        if (value) url.searchParams.set(key, String(value));
      }

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(String(res.status));
      const page = (await res.json()) as { items: PublicPost[]; nextCursor: string | null };
      setPosts((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {posts.length > 0 && (
        <div className="grid md:grid-cols-3 gap-4 mt-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
      {cursor && (
        <div className="flex flex-col items-center gap-2 mt-8">
          <Button onClick={loadMore} disabled={loading} variant="outline">
            {loading ? "Loading…" : "Load more posts"}
          </Button>
          {failed && (
            <p role="alert" className="text-sm text-red-600">
              Could not load more posts. Try again.
            </p>
          )}
        </div>
      )}
    </>
  );
}
