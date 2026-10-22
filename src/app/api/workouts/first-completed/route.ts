import { z } from 'zod';
import { authenticated } from '@/lib/supabase/server';
import { ok, failure, dbCheck } from '@/lib/http';

export async function GET(request: Request) {
  try {
    const { db, user } = await authenticated();
    const until = z.iso.datetime().parse(new URL(request.url).searchParams.get('until'));
    const { data, error } = await db
      .from('workout_sessions')
      .select('started_at')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .lte('started_at', until)
      .order('started_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    dbCheck(error);
    return ok({ started_at: data?.started_at ?? null });
  } catch (e) {
    return failure(e);
  }
}
