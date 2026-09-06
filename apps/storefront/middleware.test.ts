import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The middleware hands Clerk its publishable key from source.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE OUTAGE THIS PINS. `clerkMiddleware()` with no options reads
 * `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, which Next inlines into the middleware
 * bundle at build time. Only Workers Builds' production branch had that
 * variable, so a build from anywhere else shipped `undefined` there — harmless
 * until a `CLERK_SECRET_KEY` was present at runtime, at which point Clerk
 * mounted and threw "Missing publishableKey" on every matched route. On
 * 2026-09-06 that was the whole shop answering "Internal Server Error" for two
 * and a half minutes after a branch was deployed by hand.
 *
 * The committed key in `lib/auth/publishable.ts` already reached the provider;
 * this suite asserts it reaches the middleware too, WITHOUT the build variable,
 * which is the exact condition the outage happened under. Clerk itself is
 * mocked: the question is what this file passes, not what Clerk does with it.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const { clerkMiddleware } = vi.hoisted(() => ({
  clerkMiddleware: vi.fn<(options?: { publishableKey?: string }) => unknown>(
    () => () => undefined,
  ),
}));

vi.mock("@clerk/nextjs/server", () => ({ clerkMiddleware }));

const ORIGINAL_ENV = { ...process.env };
const KEYS = ["CLERK_SECRET_KEY", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"] as const;

/** The middleware's default export, evaluated fresh under exactly this
 *  environment — it reads `process.env` at module scope, so a stale module
 *  would answer for the previous test's variables. */
async function loadMiddleware(env: Partial<Record<(typeof KEYS)[number], string>>) {
  vi.resetModules();
  for (const key of KEYS) {
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
  return (await import("./middleware")).default;
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  clerkMiddleware.mockClear();
});

describe("the middleware hands Clerk its publishable key itself", () => {
  it("passes the committed key when the build environment has none — every preview, every laptop", async () => {
    await loadMiddleware({ CLERK_SECRET_KEY: "sk_test_not_a_real_key" });

    expect(clerkMiddleware).toHaveBeenCalledTimes(1);
    const options = clerkMiddleware.mock.calls[0][0];
    /* The committed production key, never `undefined` — `undefined` is the
       value that took the shop down. */
    expect(options?.publishableKey).toMatch(/^pk_live_/);
  });

  it("prefers the build environment's key when there is one, as the constant promises", async () => {
    await loadMiddleware({
      CLERK_SECRET_KEY: "sk_test_not_a_real_key",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_from_the_build_environment",
    });

    expect(clerkMiddleware.mock.calls[0][0]?.publishableKey).toBe(
      "pk_test_from_the_build_environment",
    );
  });

  it("still mounts nothing at all without a secret — the degrade the header describes", async () => {
    const middleware = await loadMiddleware({});

    expect(clerkMiddleware).not.toHaveBeenCalled();
    /* A pass-through function, so an unconfigured deployment sells as a guest
       shop rather than failing every route. */
    expect(typeof middleware).toBe("function");
  });
});
