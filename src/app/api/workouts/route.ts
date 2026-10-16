import { z } from 'zod';
import { authenticated, ApiError } from '@/lib/supabase/server';
import { ok, failure, originCheck, json, dbCheck } from '@/lib/http';
import { workoutSchema } from '@/lib/domain';
export async function POST(request: Request) {
  try {
    originCheck(request);
    const { db } = await authenticated();
    const payload = workoutSchema.parse(await json(request));
    const { data, error } = await db.rpc('save_workout', { payload });
    dbCheck(error);
    return ok({ revision: data });
  } catch (e) {
    return failure(e);
  }
}
export async function GET(request: Request) {
  try {
    const { db } = await authenticated();
    const p = new URL(request.url).searchParams;
    const params = z
      .object({
        page: z.coerce.number().int().min(0).default(0),
        since: z.iso.datetime().optional(),
        id: z.uuid().optional(),
        exercise: z.uuid().optional(),
      })
      .parse(Object.fromEntries(p));
    const { data, error } = await db.rpc('read_workouts', {
      page_offset: params.page * 30,
      page_size: 30,
      since_date: params.since ?? null,
      only_id: params.id ?? null,
      only_exercise: params.exercise ?? null,
    });
    dbCheck(error);
    return ok(workoutSchema.array().parse(data));
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(request: Request) {
  try {
    originCheck(request);
    const { db, user } = await authenticated();
    const { id, revision } = z
      .object({ id: z.uuid(), revision: z.number().int().positive() })
      .parse(await json(request));
    const { data, error } = await db
      .from('workout_sessions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('revision', revision)
      .select('id');
    dbCheck(error);
    if (!data?.length) throw new ApiError('La séance a changé. Rechargez la page.', 409);
    return ok({ success: true });
  } catch (e) {
    return failure(e);
  }
}
