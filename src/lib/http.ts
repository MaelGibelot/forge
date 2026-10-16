import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiError } from './supabase/server';
export function originCheck(request: Request) {
  const origin = request.headers.get('origin');
  const expected = process.env.APP_ORIGIN;
  if (!expected || origin !== new URL(expected).origin)
    throw new ApiError('Origine de la requête refusée.', 403);
}
export function ok(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'private, no-store' } });
}
export function failure(e: unknown) {
  if (e instanceof z.ZodError)
    return ok(
      { error: e.issues.map((i) => `${i.path.join('.')} : ${i.message}`).join(' · ') },
      422,
    );
  if (e instanceof ApiError) return ok({ error: e.message }, e.status);
  console.error(
    'Échec opération FORGE',
    e instanceof Error ? e.message : 'Erreur de base de données',
  );
  return ok(
    {
      error:
        'Impossible de terminer l’opération. Vos modifications locales sont conservées ; réessayez.',
    },
    500,
  );
}
export function dbCheck(error: { message: string } | null) {
  if (error) {
    if (error.message.includes('CONFLICT') || error.message.includes('duplicate key'))
      throw new ApiError(
        'Cette donnée a changé dans un autre onglet. Rechargez la version du serveur avant de réessayer.',
        409,
      );
    throw new Error(error.message);
  }
}
export async function json(request: Request) {
  if (Number(request.headers.get('content-length') ?? 0) > 1_000_000)
    throw new ApiError('Requête trop volumineuse.', 413);
  const text = await request.text();
  if (text.length > 1_000_000) throw new ApiError('Requête trop volumineuse.', 413);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError('Données invalides.');
  }
}
