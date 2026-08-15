import { BLOG_API } from "./config";

export class BlogAPIError extends Error {
  constructor(
    message: string,
    public status: number,
    public endpoint: string,
  ) {
    super(message);
    this.name = "BlogAPIError";
  }
}

function buildUrl(path: string, query?: Record<string, unknown>): string {
  const url = new URL(`${BLOG_API}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/**
 * Retries 5xx and network failures only. A 4xx is an answer, not an outage:
 * retrying it burns the timeout budget to arrive at the same response.
 */
export async function blogFetch<T>(
  path: string,
  opts: {
    query?: Record<string, unknown>;
    revalidate: number;
    tags?: string[];
    retries?: number;
    timeoutMs?: number;
  },
): Promise<T> {
  const { query, revalidate, tags, retries = 3, timeoutMs = 8000 } = opts;
  const url = buildUrl(path, query);

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
        next: { revalidate, tags },
      });

      if (res.status >= 400 && res.status < 500) {
        throw new BlogAPIError(`Blog API ${res.status}`, res.status, url);
      }

      if (!res.ok) {
        if (attempt === retries) {
          throw new BlogAPIError(`Blog API ${res.status}`, res.status, url);
        }
      } else {
        return (await res.json()) as T;
      }
    } catch (error) {
      if (error instanceof BlogAPIError) throw error;
      if (attempt === retries) {
        throw new BlogAPIError(
          error instanceof Error ? error.message : "Unknown error",
          502,
          url,
        );
      }
    } finally {
      clearTimeout(timer);
    }

    await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** (attempt - 1), 5000)));
  }

  throw new BlogAPIError("Unreachable", 502, url);
}
