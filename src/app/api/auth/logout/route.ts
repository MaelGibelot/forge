import { authenticated } from '@/lib/supabase/server';
import { ok, failure, originCheck, dbCheck } from '@/lib/http';
export async function POST(request: Request) {
  try {
    originCheck(request);
    const { db } = await authenticated();
    const { error } = await db.auth.signOut();
    dbCheck(error);
    return ok({ success: true });
  } catch (e) {
    return failure(e);
  }
}
