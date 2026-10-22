import { describe, expect, it } from 'vitest';
import { catalog } from '../src/lib/catalog';
import { newEntry, newSet, startWorkout, workoutSchema, type Workout } from '../src/lib/domain';
import { templateFromWorkout, workoutFromTemplate, templateSchema } from '../src/lib/templates';

export function completedTemplateWorkout(): Workout {
  const group = { id: crypto.randomUUID(), name: 'Superset', rounds: 2, rest_seconds: 90 };
  const entries = [
    catalog[0],
    catalog.find((e) => e.name === 'Extension triceps corde')!,
    catalog.find((e) => e.load_kind === 'cardio')!,
  ].map((e, i) => newEntry(e, i));
  return {
    ...startWorkout(),
    status: 'completed',
    name: 'Haut du corps',
    notes: 'Résultats de la séance',
    groups: [group],
    round_rests: [{ group_id: group.id, round: 1, rest_seconds: 120 }],
    exercises: entries.map((e, i) => ({
      ...e,
      group_id: i < 2 ? group.id : null,
      technique_ok: true,
      target: { ...e.target, weight: i < 2 ? 75 : null },
      sets: Array.from({ length: 2 }, (_, n) => ({
        ...newSet(n, e.target, e.load_kind),
        completed: true,
        weight: i < 2 ? 75 : null,
        reps: i < 2 ? 12 : 0,
        duration_seconds: i === 2 ? 600 : null,
        distance_km: i === 2 ? 2 : null,
        rpe: 8,
        rir: i === 2 ? null : 2,
        rest_seconds: 100,
        notes: 'Résultat individuel',
        type: n === 0 ? ('warmup' as const) : ('normal' as const),
      })),
    })),
  };
}

describe('modèles et nouvelle exécution de séance', () => {
  it('conserve la structure mais ne stocke aucune charge, répétition ni mesure réalisée', () => {
    const source = completedTemplateWorkout(),
      before = JSON.stringify(source);
    const template = templateFromWorkout(source, 'Mon modèle');
    expect(template.name).toBe('Mon modèle');
    expect(template.definition.exercises.map((e) => e.sets)).toEqual([
      ['warmup', 'normal'],
      ['warmup', 'normal'],
      ['warmup', 'normal'],
    ]);
    const definition = JSON.stringify(template.definition);
    for (const key of [
      'weight',
      'reps',
      'rpe',
      'rir',
      'duration_seconds',
      'distance_km',
      'completed',
    ])
      expect(definition).not.toContain(`"${key}":`);
    expect(definition).not.toContain('Résultat individuel');
    const next = workoutSchema.parse(workoutFromTemplate(template));
    expect(next.status).toBe('active');
    expect(next.id).not.toBe(source.id);
    expect(next.source_day_id).toBeNull();
    expect(next.notes).toBe('');
    expect(next.round_rests).toEqual([]);
    expect(next.groups[0].id).not.toBe(source.groups[0].id);
    expect(next.exercises[0].group_id).toBe(next.groups[0].id);
    expect(
      next.exercises.every(
        (e) =>
          e.target.weight === null &&
          !e.technique_ok &&
          e.sets.every(
            (s) =>
              s.weight === null &&
              s.reps === 0 &&
              !s.completed &&
              s.rpe === null &&
              s.rir === null &&
              s.rest_seconds === null &&
              s.duration_seconds === null &&
              s.distance_km === null &&
              s.notes === '',
          ),
      ),
    ).toBe(true);
    expect(JSON.stringify(source)).toBe(before);
    expect(workoutFromTemplate(template).id).not.toBe(next.id);
  });
  it('retire les résultats ajoutés dans un payload et refuse un modèle vide ou un superset orphelin', () => {
    const template = templateFromWorkout(completedTemplateWorkout());
    const dirty = {
      ...template,
      definition: {
        ...template.definition,
        exercises: template.definition.exercises.map((e) => ({ ...e, weight: 999, reps: 30 })),
      },
    };
    expect(templateSchema.parse(dirty).definition.exercises[0]).not.toHaveProperty('weight');
    expect(
      templateSchema.safeParse({ ...template, definition: { exercises: [], groups: [] } }).success,
    ).toBe(false);
    expect(
      templateSchema.safeParse({ ...template, definition: { ...template.definition, groups: [] } })
        .success,
    ).toBe(false);
  });
});
