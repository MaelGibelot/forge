import { z } from 'zod';
import { authenticated } from '@/lib/supabase/server';
import { ok, failure, originCheck, json, dbCheck } from '@/lib/http';
export async function GET(request: Request) {
  try {
    const { db } = await authenticated();
    const offset = z.coerce
      .number()
      .int()
      .min(0)
      .parse(new URL(request.url).searchParams.get('offset') ?? 0);
    const { data, error } = await db
      .from('bodyweight_entries')
      .select('id,date,weight')
      .order('date', { ascending: false })
      .range(offset, offset + 199);
    dbCheck(error);
    return ok(data);
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    originCheck(request);
    const { db, user } = await authenticated();
    const p = z
      .object({ date: z.iso.date(), weight: z.number().positive().max(700) })
      .parse(await json(request));
    const { error } = await db
      .from('bodyweight_entries')
      .upsert({ ...p, user_id: user.id }, { onConflict: 'user_id,date' });
    dbCheck(error);
    return ok({ success: true });
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(request: Request) {
  try {
    originCheck(request);
    const { db, user } = await authenticated();
    const { id } = z.object({ id: z.uuid() }).parse(await json(request));
    const { error } = await db
      .from('bodyweight_entries')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    dbCheck(error);
    return ok({ success: true });
  } catch (e) {
    return failure(e);
  }
}
