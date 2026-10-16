import { describe, expect, it } from 'vitest';
import { catalog } from '../src/lib/catalog';
import { technogymCatalog, technogymFamilies } from '../src/lib/technogym';
import {
  equipment,
  muscles,
  newEntry,
  newSet,
  startWorkout,
  workoutSchema,
  type Workout,
  type WorkoutExercise,
} from '../src/lib/domain';
import {
  cardioTotals,
  eligible,
  estimated1RM,
  records,
  recommendation,
  workoutVolume,
} from '../src/lib/metrics';
import { duplicateWorkout } from '../src/lib/clone';
const machine = technogymCatalog.find((e) => e.load_kind === 'cardio')!;
function cardio(): Workout {
  const entry = newEntry(machine, 0);
  const exercise: WorkoutExercise = {
    ...entry,
    technique_ok: false,
    sets: [
      {
        ...newSet(0, entry.target, 'cardio'),
        duration_seconds: 1234,
        distance_km: 4.25,
        completed: true,
      },
    ],
  };
  return {
    ...startWorkout(),
    status: 'completed',
    finished_at: new Date().toISOString(),
    exercises: [exercise],
  };
}
describe('catalogue Technogym', () => {
  it('conserve les identifiants des exercices initiaux et ajoute des modèles distincts', () => {
    expect(technogymCatalog[0].id).toBe('11000000-0000-4000-8000-164509db1b57');
    expect(
      catalog
        .slice(0, 62)
        .every((e, i) => e.id === `10000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`),
    ).toBe(true);
    expect(new Set(catalog.map((e) => e.id)).size).toBe(catalog.length);
    expect(new Set(technogymCatalog.map((e) => e.name)).size).toBe(technogymCatalog.length);
    expect(technogymCatalog.length).toBe(
      technogymFamilies.reduce((n, f) => n + f.models.length, 0),
    );
    for (const e of technogymCatalog) {
      expect(e.name.length).toBeLessThanOrEqual(120);
      expect(muscles).toContain(e.primary_muscle);
      expect(equipment).toContain(e.equipment);
      expect(e.secondary_muscles).not.toContain(e.primary_muscle);
      expect(e.supports_1rm).toBe(false);
      expect(e.instructions).toHaveLength(3);
    }
  });
  it('distingue les charges et historiques des gammes et des fonctions d’une machine double', () => {
    const presses = technogymCatalog.filter((e) => e.english_name?.endsWith('Chest Press'));
    expect(presses.length).toBeGreaterThan(3);
    expect(new Set(presses.map((e) => e.id)).size).toBe(presses.length);
    expect(
      technogymCatalog.some(
        (e) => e.name.includes('Dual Pectoral') && e.primary_muscle === 'Pectoraux',
      ),
    ).toBe(true);
    expect(
      technogymCatalog.some(
        (e) => e.name.includes('Dual Pectoral') && e.primary_muscle === 'Épaules',
      ),
    ).toBe(true);
    expect(
      technogymCatalog.some((e) => e.name.includes('Skillrow') && e.load_kind === 'cardio'),
    ).toBe(true);
    expect(technogymCatalog.some((e) => e.load_kind === 'assisted')).toBe(true);
  });
});
describe('suivi cardio', () => {
  it('enregistre une séance cardio sans répétition ni charge artificielle', () => {
    const w = workoutSchema.parse(cardio());
    expect(w.exercises[0].sets[0]).toMatchObject({
      reps: 0,
      weight: null,
      duration_seconds: 1234,
      distance_km: 4.25,
    });
    expect(cardioTotals(w)).toEqual({ seconds: 1234, distance: 4.25 });
    expect(eligible(w.exercises[0].sets[0])).toBe(false);
    expect(workoutVolume(w)).toBe(0);
    expect(records([w])).toEqual([]);
    expect(estimated1RM(w.exercises[0].sets[0], w.exercises[0])).toBeNull();
    expect(
      recommendation(w.exercises[0], [w], {
        display_name: 'Test',
        recommendations: true,
        history_count: 3,
        max_rpe: 9,
        min_rir: 1,
      }).kind,
    ).toBe('disabled');
  });
  it.each([
    { duration_seconds: null },
    { duration_seconds: 0 },
    { duration_seconds: -1 },
    { duration_seconds: 86401 },
    { duration_seconds: 1.5 },
    { distance_km: -1 },
    { distance_km: 10001 },
    { reps: 1 },
    { weight: 10 },
    { rir: 2 },
    { type: 'drop' },
  ])('refuse un intervalle réalisé invalide : %j', (change) => {
    const w = cardio();
    Object.assign(w.exercises[0].sets[0], change);
    expect(workoutSchema.safeParse(w).success).toBe(false);
  });
  it('accepte une distance absente et exclut les intervalles non réalisés et les échauffements filtrés', () => {
    const w = cardio();
    w.exercises[0].sets[0].distance_km = null;
    w.exercises[0].sets.push({
      ...w.exercises[0].sets[0],
      id: crypto.randomUUID(),
      position: 1,
      duration_seconds: 300,
      type: 'warmup',
    });
    w.exercises[0].sets.push({
      ...w.exercises[0].sets[0],
      id: crypto.randomUUID(),
      position: 2,
      completed: false,
      duration_seconds: 600,
    });
    expect(workoutSchema.safeParse(w).success).toBe(true);
    expect(cardioTotals(w)).toEqual({ seconds: 1534, distance: 0 });
    expect(cardioTotals(w, false)).toEqual({ seconds: 1234, distance: 0 });
  });
  it('prépare un intervalle vide et remet les mesures à zéro lors d’une duplication', () => {
    const entry = newEntry(machine, 0);
    expect(entry.target.sets).toBe(1);
    expect(newSet(0, entry.target, 'cardio')).toMatchObject({
      reps: 0,
      weight: null,
      duration_seconds: null,
      distance_km: null,
      completed: false,
    });
    expect(duplicateWorkout(cardio()).exercises[0].sets[0]).toMatchObject({
      reps: 0,
      weight: null,
      duration_seconds: null,
      distance_km: null,
      completed: false,
    });
  });
});
