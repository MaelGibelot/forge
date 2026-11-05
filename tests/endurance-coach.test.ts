import { describe, expect, it } from 'vitest';
import { newEntry, newSet, startWorkout, type Workout } from '../src/lib/domain';
import {
  enduranceActivities,
  enduranceActivity,
  type EnduranceGoal,
  type EnduranceSession,
  type EnduranceSport,
} from '../src/lib/endurance';
import { enduranceCoaching } from '../src/lib/endurance-coach';

const now = Date.parse('2026-11-05T12:00:00Z');
const day = 86_400_000;
const goal: EnduranceGoal = { sport: 'running', objective: 'performance', sessions_per_week: 3 };

function workout(
  sport: EnduranceSport,
  session: EnduranceSession,
  daysAgo: number,
  efforts: { seconds: number; km: number | null; rest?: number }[],
): Workout {
  const activity = enduranceActivities.find((exercise) => {
    const variant = enduranceActivity(exercise.id);
    return variant?.sport === sport && variant.session === session;
  })!;
  const exercise = newEntry(activity, 0);
  const started = now - daysAgo * day;
  return {
    ...startWorkout(),
    status: 'completed',
    started_at: new Date(started).toISOString(),
    finished_at: new Date(started + 3_600_000).toISOString(),
    exercises: [
      {
        ...exercise,
        technique_ok: false,
        sets: efforts.map((effort, index) => ({
          ...newSet(index, exercise.target, 'cardio'),
          duration_seconds: effort.seconds,
          distance_km: effort.km,
          rest_seconds: effort.rest ?? null,
          completed: true,
        })),
      },
    ],
  };
}

describe('coaching par sport cardio', () => {
  it('compte exactement sept dates locales même quand 168 h couvrent huit dates', () => {
    const workouts = [0.125, 1.125, 2.125, 3.125, 4.125, 5.125, 6.125, 6.9375].map((daysAgo) =>
      workout('running', 'easy', daysAgo, [{ seconds: 1800, km: 5 }]),
    );
    expect(enduranceCoaching(goal, workouts, now).recent).toMatchObject({ sessions: 7, days: 7 });
  });

  it('distingue les séances des jours parisiens et exclut les passages non validés', () => {
    const beforeUtcMidnight = workout('running', 'easy', 1.52, [{ seconds: 1500, km: 4 }]);
    const afterUtcMidnight = workout('running', 'long', 0.66, [{ seconds: 1800, km: null }]);
    const set = beforeUtcMidnight.exercises[0].sets[0];
    beforeUtcMidnight.exercises[0].sets.push(
      { ...set, type: 'warmup', duration_seconds: 300, distance_km: 0.5 },
      { ...set, completed: false, duration_seconds: 3000, distance_km: 20 },
    );
    const draft = {
      ...workout('running', 'easy', 2, [{ seconds: 3600, km: 10 }]),
      status: 'draft' as const,
    };
    const future = workout('running', 'easy', -1, [{ seconds: 3600, km: 10 }]);
    const bike = workout('cycling', 'easy', 2, [{ seconds: 3600, km: 30 }]);
    const result = enduranceCoaching(
      goal,
      [beforeUtcMidnight, afterUtcMidnight, draft, future, bike, beforeUtcMidnight],
      now,
    );
    expect(result.recent).toEqual({
      sessions: 2,
      days: 1,
      duration_seconds: 3600,
      distance_km: 4.5,
      distance_recorded_sessions: 1,
    });
    expect(result.plan).toHaveLength(1);
  });

  it('compare uniquement les mêmes segments du même type à récupération identique', () => {
    const previous = workout('running', 'intervals', 6, [
      { seconds: 330, km: 1, rest: 60 },
      { seconds: 350, km: 1, rest: 60 },
    ]);
    const latest = workout('running', 'intervals', 3, [
      { seconds: 310, km: 1, rest: 60 },
      { seconds: 330, km: 1, rest: 60 },
    ]);
    const differentRest = workout('running', 'intervals', 2, [
      { seconds: 300, km: 1, rest: 30 },
      { seconds: 320, km: 1, rest: 30 },
    ]);
    const differentSegments = workout('running', 'intervals', 1, [{ seconds: 610, km: 2 }]);
    const differentType = workout('running', 'tempo', 0.5, [{ seconds: 610, km: 2 }]);
    const result = enduranceCoaching(
      goal,
      [previous, latest, differentRest, differentSegments, differentType],
      now,
    );
    expect(result.comparison).toMatchObject({
      latest_date: latest.started_at,
      previous_date: previous.started_at,
      distance_km: 2,
      latest_seconds: 640,
      previous_seconds: 680,
    });
    expect(result.comparison?.change_percent).toBeCloseTo(-5.88, 2);
    expect(enduranceCoaching(goal, [differentSegments, differentType], now).comparison).toBeNull();
  });

  it('compare le chrono de l’objectif avec un effort de la distance exacte saisi en un segment', () => {
    const target = { ...goal, target_distance_km: 10, target_time_seconds: 3000 };
    const intervals = workout('running', 'intervals', 1, [{ seconds: 2700, km: 10 }]);
    const broken = workout('running', 'long', 2, [
      { seconds: 1500, km: 5 },
      { seconds: 1550, km: 5 },
    ]);
    const sameDistance = workout('running', 'easy', 3, [{ seconds: 3120, km: 10 }]);
    const result = enduranceCoaching(target, [intervals, broken, sameDistance], now);
    expect(result.facts.some((fact) => fact.includes('2 min de plus que le temps cible'))).toBe(
      true,
    );
    expect(result.facts.some((fact) => fact.includes('5:00 /km'))).toBe(true);
    const missing = enduranceCoaching(target, [intervals, broken], now);
    expect(missing.facts.some((fact) => fact.includes('Il manque une séance'))).toBe(true);
  });

  it('limite la reprise et produit un plan utilisable même avec une seule séance souhaitée', () => {
    const noHistory = enduranceCoaching({ ...goal, sessions_per_week: 7 }, [], now);
    expect(noHistory.plan).toHaveLength(2);
    expect(noHistory.plan.every((slot) => ['easy', 'recovery'].includes(slot.session))).toBe(true);
    expect(noHistory.guidance).toContain('7 souhaitée');
    const old = workout('swimming', 'intervals', 20, [{ seconds: 6000, km: 2 }]);
    const restart = enduranceCoaching(
      { ...goal, sport: 'swimming', sessions_per_week: 1 },
      [old],
      now,
    );
    expect(restart.plan).toHaveLength(1);
    expect(restart.plan[0]).toMatchObject({ session: 'technique', duration_seconds: 900 });
  });

  it('alloue la distance à l’endurance et le chrono à un travail soutenu selon les jours pratiqués', () => {
    const history = [1, 3, 8, 10].map((daysAgo) =>
      workout('running', 'easy', daysAgo, [{ seconds: 3600, km: 10 }]),
    );
    const time = enduranceCoaching({ ...goal, sessions_per_week: 2 }, history, now);
    expect(time.plan.map((slot) => slot.session)).toEqual(['easy', 'intervals']);
    expect(time.plan[1].duration_seconds).toBeGreaterThanOrEqual(25 * 60);
    const distance = enduranceCoaching(
      { ...goal, objective: 'distance', target_distance_km: 12 },
      history,
      now,
    );
    expect(distance.plan.map((slot) => slot.session)).toEqual(['easy', 'easy', 'long']);
    expect(distance.plan[2].distance_km).toBeLessThanOrEqual(10);
    expect(distance.plan.reduce((sum, slot) => sum + slot.duration_seconds, 0)).toBeLessThanOrEqual(
      7200,
    );
    const volumeAndSpeed = enduranceCoaching(goal, history, now);
    expect(volumeAndSpeed.plan.every((slot) => slot.session !== 'intervals')).toBe(true);
    const difficult = {
      effort: 'hard' as const,
      recovery: 'poor' as const,
      pain: false,
      technique_issue: false,
    };
    history[0].exercises[0].feedback = difficult;
    const recovery = enduranceCoaching(goal, history, now);
    expect(recovery.plan.map((slot) => slot.session)).toEqual(['recovery', 'easy']);
  });

  it('allonge une sortie de distance après une récupération confirmée sans dépasser la cible', () => {
    const history = [1, 3, 8, 10].map((daysAgo) =>
      workout('running', 'long', daysAgo, [{ seconds: 3600, km: 10 }]),
    );
    history[0].exercises[0].feedback = {
      effort: 'controlled',
      recovery: 'good',
      pain: false,
      technique_issue: false,
    };
    const distanceGoal: EnduranceGoal = {
      ...goal,
      objective: 'distance',
      sessions_per_week: 2,
      target_distance_km: 10.25,
    };
    const extended = enduranceCoaching(distanceGoal, history, now);
    expect(extended.plan[1]).toMatchObject({ session: 'long', distance_km: 10.25 });
    expect(extended.plan[1].duration_seconds).toBeGreaterThan(3600);
    expect(extended.plan[1].duration_seconds).toBeLessThanOrEqual(3780);
    delete history[0].exercises[0].feedback;
    expect(enduranceCoaching(distanceGoal, history, now).plan[1].distance_km).toBeLessThanOrEqual(
      10,
    );
  });
});
