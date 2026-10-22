import { z } from 'zod';
import {
  muscles,
  groupSchema,
  newSet,
  startWorkout,
  targetDefaults,
  type Workout,
} from './domain.ts';

const templateEntry = z.object({
  id: z.uuid(),
  exercise_id: z.uuid(),
  name: z.string().min(1).max(120),
  primary_muscle: z.enum(muscles),
  load_kind: z.enum(['external', 'bodyweight', 'assisted', 'cardio']),
  supports_1rm: z.boolean(),
  position: z.number().int().min(0).max(100),
  group_id: z.uuid().nullable(),
  notes: z.string().max(2000),
  increment: z.number().positive().max(100),
  rest_seconds: z.number().int().min(0).max(7200).nullable(),
  sets: z.array(z.enum(['normal', 'warmup', 'drop'])).max(100),
});
export const templateDefinitionSchema = z
  .object({
    exercises: z.array(templateEntry).min(1).max(60),
    groups: z.array(groupSchema).max(30),
  })
  .refine(
    (d) =>
      d.exercises.every((e) => !e.group_id || d.groups.some((g) => g.id === e.group_id)) &&
      d.groups.every((g) => d.exercises.filter((e) => e.group_id === g.id).length >= 2),
    'Superset invalide.',
  );
export const templateSchema = z.object({
  id: z.uuid(),
  revision: z.number().int().min(0),
  name: z.string().trim().min(1).max(100),
  definition: templateDefinitionSchema,
});
export type WorkoutTemplate = z.infer<typeof templateSchema>;

export function templateFromWorkout(w: Workout, name = w.name): WorkoutTemplate {
  return templateSchema.parse({
    id: crypto.randomUUID(),
    revision: 0,
    name,
    definition: {
      groups: w.groups.map((g) => ({ ...g })),
      exercises: w.exercises.map((e) => ({
        id: e.id,
        exercise_id: e.exercise_id,
        name: e.name,
        primary_muscle: e.primary_muscle,
        load_kind: e.load_kind,
        supports_1rm: e.supports_1rm,
        position: e.position,
        group_id: e.group_id,
        notes: e.notes,
        increment: e.increment,
        rest_seconds: e.target.rest_seconds,
        sets: e.sets.map((s) => s.type),
      })),
    },
  });
}

export function workoutFromTemplate(t: WorkoutTemplate): Workout {
  const groupMap = new Map(t.definition.groups.map((g) => [g.id, crypto.randomUUID()]));
  return {
    ...startWorkout(),
    name: t.name,
    groups: t.definition.groups.map((g) => ({ ...g, id: groupMap.get(g.id)! })),
    exercises: t.definition.exercises.map((e) => {
      const target = {
        ...targetDefaults,
        sets: Math.max(1, Math.min(30, e.sets.length)),
        rest_seconds: e.rest_seconds,
      };
      return {
        id: crypto.randomUUID(),
        exercise_id: e.exercise_id,
        name: e.name,
        primary_muscle: e.primary_muscle,
        load_kind: e.load_kind,
        supports_1rm: e.supports_1rm,
        position: e.position,
        group_id: e.group_id ? groupMap.get(e.group_id)! : null,
        notes: e.notes,
        increment: e.increment,
        target,
        technique_ok: false,
        sets: e.sets.map((type, i) => ({
          ...newSet(i, target, e.load_kind),
          type,
          weight: null,
          reps: 0,
        })),
      };
    }),
  };
}
