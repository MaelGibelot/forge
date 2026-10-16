import { createHmac, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { admin, configured, supabase, ApiError } from '@/lib/supabase/server';
import { ok, failure, originCheck, json, dbCheck } from '@/lib/http';
export async function POST(request: Request) {
  try {
    originCheck(request);
    if (!configured())
      throw new ApiError(
        'Le propriétaire doit configurer Supabase avant la première connexion.',
        503,
      );
    const { username, password } = z
      .object({
        username: z
          .string()
          .trim()
          .toLowerCase()
          .min(3)
          .max(32)
          .regex(/^[a-z0-9][a-z0-9_.-]+$/),
        password: z.string().min(1).max(128),
      })
      .parse(await json(request));
    if (process.env.LOGIN_RATE_SECRET!.length < 32)
      throw new ApiError('Configuration serveur incomplète.', 503);
    const service = admin();
    // Vercel overwrites x-vercel-forwarded-for at its trusted ingress.
    // Other hosts share a bucket until a trusted proxy is explicitly integrated.
    const ip = process.env.VERCEL
      ? (request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown')
      : 'local';
    const hash = (s: string) =>
      createHmac('sha256', process.env.LOGIN_RATE_SECRET!).update(s).digest('hex');
    const limits = await Promise.all([
      service.rpc('consume_login_attempt', { bucket: hash(`user:${username}`), max_attempts: 8 }),
      service.rpc('consume_login_attempt', { bucket: hash(`ip:${ip}`), max_attempts: 40 }),
    ]);
    limits.forEach((r) => dbCheck(r.error));
    if (limits.some((r) => r.data !== true))
      throw new ApiError(
        'Connexion impossible. Vérifiez vos identifiants ou réessayez dans 15 minutes.',
        429,
      );
    const lookup = await service.rpc('resolve_login', { login: username });
    dbCheck(lookup.error);
    const db = await supabase();
    // Always perform a password verification, including unknown usernames.
    const { error } = await db.auth.signInWithPassword({
      email: lookup.data ?? `${randomUUID()}@${process.env.AUTH_IDENTITY_DOMAIN}`,
      password,
    });
    if (error || !lookup.data)
      throw new ApiError(
        'Connexion impossible. Vérifiez vos identifiants ou réessayez plus tard.',
        401,
      );
    return ok({ success: true });
  } catch (e) {
    return failure(e);
  }
}
