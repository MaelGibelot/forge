import { describe, expect, it } from 'vitest';
import { catalog } from '../src/lib/catalog';
import { variantCatalog } from '../src/lib/variants';
import { newEntry, newSet, startWorkout, type Workout } from '../src/lib/domain';
import { muscleSeries, workoutVolume, records } from '../src/lib/metrics';

describe('bilan et mouvements assistés', () => {
  it('compte les répétitions de blocs distincts et exclut le cardio et les séries non réalisées', () => {
    const entry = newEntry(catalog[0], 0);
    const cardio = newEntry(
      catalog.find((e) => e.load_kind === 'cardio')!,
      2,
    );
    const workout: Workout = {
      ...startWorkout(),
      status: 'completed',
      exercises: [
        {
          ...entry,
          technique_ok: true,
          sets: [
            { ...newSet(0, entry.target), completed: true },
            { ...newSet(1, entry.target), completed: true, type: 'warmup' },
            { ...newSet(2, entry.target), completed: false },
          ],
        },
        {
          ...entry,
          id: crypto.randomUUID(),
          technique_ok: true,
          sets: [{ ...newSet(0, entry.target), completed: true, type: 'drop' }],
        },
        {
          ...cardio,
          technique_ok: false,
          sets: [{ ...newSet(0, cardio.target, 'cardio'), duration_seconds: 600, completed: true }],
        },
      ],
    };
    const before = JSON.stringify(workout);
    const result = muscleSeries([workout], catalog);
    expect(result.direct.find((m) => m.name === 'Pectoraux')?.count).toBe(2);
    expect(result.secondary.find((m) => m.name === 'Triceps')?.count).toBe(2);
    expect(result.direct.reduce((n, m) => n + m.count, 0)).toBe(2);
    expect(
      muscleSeries([workout], catalog, true).direct.find((m) => m.name === 'Pectoraux')?.count,
    ).toBe(3);
    expect(muscleSeries([workout], []).secondary.every((m) => m.count === 0)).toBe(true);
    expect(JSON.stringify(workout)).toBe(before);
  });
  it('isole les prises et marque l’assistance sans volume externe ni record de charge', () => {
    expect(new Set(catalog.map((e) => e.id)).size).toBe(catalog.length);
    const assisted = variantCatalog.filter((e) => e.load_kind === 'assisted');
    expect(assisted).toHaveLength(8);
    expect(assisted.every((e) => e.equipment === 'Machine' && !e.supports_1rm)).toBe(true);
    const entry = newEntry(
      assisted.find((e) => e.name.includes('Dips'))!,
      0,
    );
    const workout: Workout = {
      ...startWorkout(),
      status: 'completed',
      exercises: [
        {
          ...entry,
          technique_ok: true,
          sets: [{ ...newSet(0, entry.target, 'assisted'), completed: true, reps: 10, weight: 40 }],
        },
      ],
    };
    expect(workoutVolume(workout)).toBe(0);
    expect(records([workout])).toEqual([]);
    expect(muscleSeries([workout], catalog).direct.find((m) => m.name === 'Triceps')?.count).toBe(
      1,
    );
  });
});
