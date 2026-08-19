import { createHmac, randomBytes } from 'node:crypto';
import { auth } from '@/lib/auth/server';

/**
 * Mint a short-lived assertion that the BROWSER carries to the admin API.
 *
 * WHY THE BROWSER AND NOT THIS SERVER. `__Host-shop_session` is set by the
 * admin on its own registrable domain. A server-to-server call cannot plant a
 * cookie in the customer's browser, so the browser has to make that request
 * itself with `credentials: 'include'` — and the only thing it may be given to
 * carry is something that expires in a minute and works exactly once.
 *
 * WHY NOT HAND THE BROWSER THE NEON SESSION TOKEN. Neon's cookie is httpOnly
 * for the same reason ours is. Reading it out into JS to post it onward would
 * turn any XSS on this origin into full account takeover against a session we
 * do not control.
 */
export const runtime = 'nodejs';

const TTL_MS = 60_000;

export async function POST(): Promise<Response> {
  const secret = process.env.SHOP_AUTH_BRIDGE_SECRET;
  if (!secret) {
    return Response.json({ error: 'not_implemented', feature: 'identity-bridge' }, { status: 501 });
  }

  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  /*
   * AN UNVERIFIED ADDRESS IS REFUSED. The admin resolves `shop_customers` BY
   * EMAIL, so an unverified one would let anyone claim an existing customer's
   * account by signing up with their address. Neon verifies by OTP on the
   * password path and inherently on Google; this is the check that makes that
   * guarantee load-bearing rather than assumed.
   */
  if (!session.user.emailVerified) {
    return Response.json({ error: 'forbidden', detail: 'email_unverified' }, { status: 403 });
  }

  const now = Date.now();
  const payload = Buffer.from(
    JSON.stringify({
      v: 1,
      sub: session.user.id,
      email: String(session.user.email).trim().toLowerCase(),
      iat: now,
      exp: now + TTL_MS,
      jti: randomBytes(16).toString('base64url'),
    }),
  ).toString('base64url');

  const mac = createHmac('sha256', secret).update(payload).digest('base64url');
  return Response.json({ assertion: `${payload}.${mac}` });
}
