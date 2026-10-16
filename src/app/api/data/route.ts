import { authenticated } from '@/lib/supabase/server';
import { ok, failure, dbCheck } from '@/lib/http';
import { defaults, preferencesSchema, programSchema, workoutSchema } from '@/lib/domain';
export async function GET() {
  try {
    const { db, user } = await authenticated();
    const results = await Promise.all([
      db.from('profiles').select('display_name').eq('user_id', user.id).single(),
      db.from('user_preferences').select('*').eq('user_id', user.id).single(),
      db.from('exercises').select('*, exercise_muscles(muscle,role)').order('name'),
      db.rpc('read_programs'),
      db.rpc('read_workouts'),
      db
        .from('bodyweight_entries')
        .select('id,date,weight')
        .order('date', { ascending: false })
        .limit(1000),
      db.from('exercise_progression').select('exercise_id,increment,reps_min,reps_max'),
    ]);
    results.forEach((r) => dbCheck(r.error));
    const [profile, prefs, exercises, programs, workouts, bodyweights, progression] = results;
    return ok({
      user_id: user.id,
      preferences: preferencesSchema.parse({ ...defaults, ...prefs.data, ...profile.data }),
      exercises: exercises.data?.map((e) => {
        const { exercise_muscles: links, ...row } = e;
        return {
          ...row,
          secondary_muscles: links
            .filter((m: { role: string }) => m.role === 'secondary')
            .map((m: { muscle: string }) => m.muscle),
        };
      }),
      programs: programSchema.array().parse(programs.data),
      workouts: workoutSchema.array().parse(workouts.data),
      bodyweights: bodyweights.data,
      progression: progression.data,
    });
  } catch (e) {
    return failure(e);
  }
}
