import { getAuth } from '@/lib/auth/server';

/**
 * `auth.handler()` itself is cheap — it's `getAuth()` that must not run at
 * module scope. These wrappers resolve the (cached) auth instance and build
 * its handler per request, so a missing `NEON_AUTH_*` variable surfaces as a
 * runtime error the first time this route is actually hit, not at import
 * time during the build.
 */
export async function GET(request: Request, ctx: { params: Promise<{ path: string[] }> }): Promise<Response> {
  return getAuth().handler().GET(request, ctx);
}

export async function POST(request: Request, ctx: { params: Promise<{ path: string[] }> }): Promise<Response> {
  return getAuth().handler().POST(request, ctx);
}
