import { describe, it, expect } from 'vitest';
import {
  climbingGrades,
  climbingTotals,
  sportCatalog,
  gradeLabel,
  gradeRank,
} from '../src/lib/climbing';
import {
  defaults,
  newEntry,
  newSet,
  startWorkout,
  workoutSchema,
  type Workout,
  type WorkoutSet,
} from '../src/lib/domain';
import {
  muscleSeries,
  records,
  workoutVolume,
  eligible,
  cardioTotals,
  estimated1RM,
} from '../src/lib/metrics';
import { recommendation } from '../src/lib/progression';
import { duplicateWorkout } from '../src/lib/clone';
import { templateFromWorkout, workoutFromTemplate } from '../src/lib/templates';
function session(kind: 'climbing' | 'bouldering' = 'climbing'): Workout {
  const e = newEntry(
    sportCatalog.find((x) => x.load_kind === kind)!,
    0,
  );
  return {
    ...startWorkout(),
    status: 'completed',
    finished_at: new Date(Date.now() + 3600000).toISOString(),
    exercises: [
      {
        ...e,
        technique_ok: false,
        sets: [
          {
            ...newSet(0, e.target, kind),
            completed: true,
            climbing: {
              grade: '6b+',
              attempts: 2,
              result: 'sent',
              style: kind === 'climbing' ? 'lead' : null,
            },
          },
        ],
      },
    ],
  };
}
describe('sports : escalade en voie et bloc', () => {
  it.each(['climbing', 'bouldering'] as const)(
    'suit %s sans fausses répétitions, volume, durée cardio ou conseil de poids',
    (kind) => {
      const w = workoutSchema.parse(session(kind)),
        e = w.exercises[0],
        s = e.sets[0];
      expect(s).toMatchObject({ weight: null, reps: 0, completed: true });
      expect(eligible(s)).toBe(false);
      expect(workoutVolume(w)).toBe(0);
      expect(cardioTotals(w)).toEqual({ seconds: 0, distance: 0 });
      expect(muscleSeries([w], sportCatalog).direct.every((r) => r.count === 0)).toBe(true);
      expect(records([w])).toEqual([]);
      expect(estimated1RM(s, e)).toBeNull();
      expect(recommendation(e, [w], defaults).kind).toBe('disabled');
    },
  );
  it('distingue les essais des réussites et les voies des blocs, avec ordre correct des cotations', () => {
    const w = session(),
      block = session('bouldering');
    w.exercises[0].sets.push({
      ...w.exercises[0].sets[0],
      id: crypto.randomUUID(),
      climbing: { grade: '9c', attempts: 3, result: 'attempt', style: 'toprope' },
    });
    const before = JSON.stringify([w, block]);
    expect(climbingTotals([w, block], 'climbing')).toEqual({
      count: 2,
      sent: 1,
      attempts: 5,
      highest: '6b+',
    });
    expect(climbingTotals([w, block], 'bouldering')).toEqual({
      count: 1,
      sent: 1,
      attempts: 2,
      highest: '6b+',
    });
    expect(gradeRank('6c+')).toBeLessThan(gradeRank('7a'));
    expect(new Set(climbingGrades).size).toBe(climbingGrades.length);
    expect(gradeLabel('6b+', 'bouldering')).toBe('6B+');
    expect(JSON.stringify([w, block])).toBe(before);
  });
  it.each([
    { weight: 10 },
    { reps: 1 },
    { rpe: 8 },
    { rir: 2 },
    { reached_failure: true },
    { type: 'drop' },
    { duration_seconds: 60 },
    { distance_km: 1 },
    { climbing: null },
    { climbing: { grade: null, attempts: 1, result: 'sent', style: null } },
    { climbing: { grade: 'rouge', attempts: 1, result: 'sent', style: null } },
    { climbing: { grade: '6a', attempts: 0, result: 'sent', style: null } },
    { climbing: { grade: '6a', attempts: 1.5, result: 'sent', style: null } },
  ])('refuse un passage incohérent %j', (patch) => {
    const w = session();
    Object.assign(w.exercises[0].sets[0], patch);
    expect(workoutSchema.safeParse(w).success).toBe(false);
  });
  it('autorise un projet tenté et un brouillon vide, interdit une pratique de corde pour le bloc', () => {
    const w = session();
    w.exercises[0].sets[0].climbing!.result = 'attempt';
    expect(workoutSchema.safeParse(w).success).toBe(true);
    w.status = 'draft';
    w.finished_at = null;
    w.exercises[0].sets = [newSet(0, w.exercises[0].target, 'climbing')];
    expect(workoutSchema.safeParse(w).success).toBe(true);
    const block = session('bouldering');
    block.exercises[0].sets[0].climbing!.style = 'lead';
    expect(workoutSchema.safeParse(block).success).toBe(false);
  });
  it('remet les cotations, résultats et essais à zéro lors des copies ou modèles', () => {
    const w = session(),
      copied = duplicateWorkout(w),
      fromTemplate = workoutFromTemplate(templateFromWorkout(w));
    for (const result of [copied, fromTemplate]) {
      expect(result.exercises[0].sets[0]).toMatchObject({
        reps: 0,
        weight: null,
        completed: false,
        climbing: { grade: null, attempts: 1, result: 'attempt', style: null },
      });
      expect(workoutSchema.safeParse(result).success).toBe(true);
    }
    expect(JSON.stringify(templateFromWorkout(w).definition)).not.toContain('6b+');
  });
  it('ne laisse pas entrer une cotation sur une série de musculation', () => {
    const w = session();
    w.exercises[0].load_kind = 'external';
    w.exercises[0].sets[0].reps = 10;
    w.exercises[0].sets[0].weight = 20;
    expect(workoutSchema.safeParse(w).success).toBe(false);
    const blank: WorkoutSet = newSet(0, w.exercises[0].target);
    expect(blank.climbing).toBeUndefined();
  });
});
