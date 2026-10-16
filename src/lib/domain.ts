import { z } from 'zod';

export const muscles = [
  'Pectoraux',
  'Dos',
  'Épaules',
  'Biceps',
  'Triceps',
  'Quadriceps',
  'Ischio-jambiers',
  'Fessiers',
  'Mollets',
  'Abdominaux',
  'Adducteurs',
] as const;
export type Muscle = (typeof muscles)[number];
export const equipment = [
  'Barre',
  'Haltères',
  'Machine',
  'Poulie',
  'Poids du corps',
  'Élastique',
  'Cardio',
] as const;
export type Equipment = (typeof equipment)[number];
export interface Exercise {
  id: string;
  user_id: string | null;
  name: string;
  english_name: string | null;
  description: string;
  category: string;
  equipment: Equipment;
  primary_muscle: Muscle;
  secondary_muscles: Muscle[];
  instructions: string[];
  tips: string;
  mistakes: string;
  load_kind: 'external' | 'bodyweight' | 'assisted' | 'cardio';
  supports_1rm: boolean;
}
const uuid = z.uuid();
const optionalNumber = (min: number, max: number) =>
  z.number().finite().min(min).max(max).nullable();
export const setSchema = z.object({
  id: uuid,
  position: z.number().int().min(0).max(100),
  weight: optionalNumber(0, 2000),
  reps: z.number().int().min(0).max(500),
  rpe: optionalNumber(1, 10),
  rir: optionalNumber(0, 10),
  rest_seconds: z.number().int().min(0).max(7200).nullable(),
  type: z.enum(['normal', 'warmup', 'drop']),
  completed: z.boolean(),
  notes: z.string().max(1000),
  duration_seconds: z.number().int().min(0).max(86400).nullable().optional(),
  distance_km: optionalNumber(0, 10000).optional(),
});
export type WorkoutSet = z.infer<typeof setSchema>;
export const targetSchema = z
  .object({
    sets: z.number().int().min(1).max(30),
    reps_min: z.number().int().min(1).max(100),
    reps_max: z.number().int().min(1).max(100),
    weight: optionalNumber(0, 2000),
    rpe: optionalNumber(1, 10),
    rir: optionalNumber(0, 10),
    rest_seconds: z.number().int().min(0).max(7200).nullable(),
  })
  .refine((t) => t.reps_max >= t.reps_min, {
    message: 'La borne haute doit être supérieure ou égale à la borne basse.',
    path: ['reps_max'],
  });
export type Target = z.infer<typeof targetSchema>;
const entrySchema = z.object({
  id: uuid,
  exercise_id: uuid,
  name: z.string().min(1).max(120),
  primary_muscle: z.enum(muscles),
  load_kind: z.enum(['external', 'bodyweight', 'assisted', 'cardio']),
  supports_1rm: z.boolean(),
  position: z.number().int().min(0).max(100),
  group_id: uuid.nullable(),
  target: targetSchema,
  notes: z.string().max(2000),
  increment: z.number().positive().max(100),
});
export type ProgramExercise = z.infer<typeof entrySchema>;
export const groupSchema = z.object({
  id: uuid,
  name: z.string().min(1).max(60),
  rounds: z.number().int().min(1).max(30),
  rest_seconds: z.number().int().min(0).max(7200).nullable(),
});
export type Superset = z.infer<typeof groupSchema>;
const validGroups = (d: { exercises: { group_id: string | null }[]; groups: Superset[] }) =>
  d.exercises.every((e) => !e.group_id || d.groups.some((g) => g.id === e.group_id)) &&
  d.groups.every((g) => d.exercises.filter((e) => e.group_id === g.id).length >= 2);
export const daySchema = z
  .object({
    id: uuid,
    name: z.string().trim().min(1).max(100),
    position: z.number().int().min(0).max(100),
    exercises: z.array(entrySchema).max(60),
    groups: z.array(groupSchema).max(30),
  })
  .refine(validGroups, 'Un superset doit contenir au moins deux exercices de la même séance.');
export type ProgramDay = z.infer<typeof daySchema>;
export const programSchema = z.object({
  id: uuid,
  revision: z.number().int().min(0),
  name: z.string().trim().min(1).max(100),
  description: z.string().max(2000),
  active: z.boolean(),
  days: z.array(daySchema).min(1).max(30),
});
export type Program = z.infer<typeof programSchema>;
export const workoutExerciseSchema = entrySchema.extend({
  sets: z.array(setSchema).max(100),
  technique_ok: z.boolean(),
});
export type WorkoutExercise = z.infer<typeof workoutExerciseSchema>;
export const workoutSchema = z
  .object({
    id: uuid,
    revision: z.number().int().min(0),
    name: z.string().trim().min(1).max(100),
    source_day_id: uuid.nullable(),
    started_at: z.iso.datetime({ offset: true }),
    finished_at: z.iso.datetime({ offset: true }).nullable(),
    status: z.enum(['active', 'draft', 'completed']),
    notes: z.string().max(5000),
    exercises: z.array(workoutExerciseSchema).max(60),
    groups: z.array(groupSchema).max(30),
    round_rests: z
      .array(
        z.object({
          group_id: uuid,
          round: z.number().int().min(1).max(30),
          rest_seconds: z.number().int().min(0).max(7200).nullable(),
        }),
      )
      .max(900),
  })
  .refine(validGroups, 'Superset incohérent.')
  .refine(
    (w) =>
      w.status !== 'completed' ||
      (!!w.finished_at &&
        Date.parse(w.finished_at) >= Date.parse(w.started_at) &&
        w.exercises.some((e) =>
          e.sets.some(
            (s) =>
              s.completed &&
              (e.load_kind === 'cardio' ? (s.duration_seconds ?? 0) > 0 : s.reps > 0),
          ),
        )),
    'Une séance terminée doit contenir au moins une série réalisée et des dates cohérentes.',
  )
  .refine(
    (w) =>
      w.exercises.every((e) =>
        e.sets.every((s) =>
          e.load_kind === 'cardio'
            ? s.reps === 0 &&
              s.weight === null &&
              s.rir === null &&
              s.type !== 'drop' &&
              (!s.completed || (s.duration_seconds ?? 0) > 0)
            : s.duration_seconds == null && s.distance_km == null && (!s.completed || s.reps > 0),
        ),
      ),
    'Une série effectuée doit contenir au moins une répétition ; un intervalle cardio doit avoir une durée positive, sans charge ni répétitions.',
  )
  .refine(
    (w) =>
      w.round_rests.every((r) => w.groups.some((g) => g.id === r.group_id && r.round <= g.rounds)),
    'Tour de superset invalide.',
  );
export type Workout = z.infer<typeof workoutSchema>;
export const preferencesSchema = z.object({
  display_name: z.string().trim().min(1).max(60),
  recommendations: z.boolean(),
  history_count: z.number().int().min(2).max(20),
  max_rpe: optionalNumber(1, 10),
  min_rir: optionalNumber(0, 10),
});
export type Preferences = z.infer<typeof preferencesSchema>;
export const progressionSchema = z
  .object({
    exercise_id: uuid,
    increment: z.number().positive().max(100),
    reps_min: z.number().int().min(1).max(100),
    reps_max: z.number().int().min(1).max(100),
  })
  .refine((s) => s.reps_max >= s.reps_min, 'Fourchette invalide.');
export type ProgressionSetting = z.infer<typeof progressionSchema>;
export interface Bodyweight {
  id: string;
  date: string;
  weight: number;
}
export interface AppData {
  user_id: string;
  preferences: Preferences;
  exercises: Exercise[];
  programs: Program[];
  workouts: Workout[];
  bodyweights: Bodyweight[];
  progression: ProgressionSetting[];
}
export const defaults: Preferences = {
  display_name: 'Athlète',
  recommendations: true,
  history_count: 3,
  max_rpe: 9,
  min_rir: 1,
};
export const targetDefaults: Target = {
  sets: 3,
  reps_min: 8,
  reps_max: 12,
  weight: null,
  rpe: null,
  rir: null,
  rest_seconds: 120,
};
export function newEntry(
  e: Exercise,
  position: number,
  setting?: ProgressionSetting,
): ProgramExercise {
  return {
    id: crypto.randomUUID(),
    exercise_id: e.id,
    name: e.name,
    primary_muscle: e.primary_muscle,
    load_kind: e.load_kind,
    supports_1rm: e.supports_1rm,
    position,
    group_id: null,
    target: {
      ...targetDefaults,
      ...(e.load_kind === 'cardio'
        ? { sets: 1, reps_min: 1, reps_max: 1, rest_seconds: null }
        : {}),
      ...(setting ? { reps_min: setting.reps_min, reps_max: setting.reps_max } : {}),
    },
    notes: '',
    increment:
      setting?.increment ??
      (['Quadriceps', 'Ischio-jambiers', 'Fessiers', 'Mollets'].includes(e.primary_muscle)
        ? 5
        : 2.5),
  };
}
export function newSet(
  position: number,
  target: Target,
  kind: Exercise['load_kind'] = 'external',
): WorkoutSet {
  return {
    id: crypto.randomUUID(),
    position,
    weight: kind === 'cardio' ? null : target.weight,
    reps: kind === 'cardio' ? 0 : target.reps_min,
    rpe: null,
    rir: null,
    rest_seconds: null,
    type: 'normal',
    completed: false,
    notes: '',
    duration_seconds: null,
    distance_km: null,
  };
}
export function startWorkout(day?: ProgramDay, previous: Workout[] = []): Workout {
  const groupMap = new Map(day?.groups.map((g) => [g.id, crypto.randomUUID()]) ?? []);
  return {
    id: crypto.randomUUID(),
    revision: 0,
    name: day?.name ?? 'Séance libre',
    source_day_id: day?.id ?? null,
    started_at: new Date().toISOString(),
    finished_at: null,
    status: 'active',
    notes: '',
    groups: day?.groups.map((g) => ({ ...g, id: groupMap.get(g.id)! })) ?? [],
    round_rests: [],
    exercises:
      day?.exercises.map((e) => {
        const last = previousExercise(previous, e.exercise_id);
        return {
          ...e,
          id: crypto.randomUUID(),
          group_id: e.group_id ? groupMap.get(e.group_id)! : null,
          target: { ...e.target },
          technique_ok: false,
          sets: Array.from({ length: e.target.sets }, (_, i) => ({
            ...newSet(i, e.target, e.load_kind),
            weight:
              e.load_kind === 'cardio'
                ? null
                : (e.target.weight ??
                  last?.sets.filter((s) => s.type === 'normal' && s.completed)[i]?.weight ??
                  null),
          })),
        };
      }) ?? [],
  };
}
export function previousExercise(workouts: Workout[], exerciseId: string, excluding?: string) {
  return [...workouts]
    .filter((w) => w.status === 'completed' && w.id !== excluding)
    .sort((a, b) => b.started_at.localeCompare(a.started_at))
    .flatMap((w) => w.exercises)
    .find((e) => e.exercise_id === exerciseId);
}
