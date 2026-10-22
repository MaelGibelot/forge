import { describe, expect, it } from 'vitest';
import { startWorkout } from '../src/lib/domain';
import { weeklyFrequency } from '../src/lib/metrics';

const now = Date.parse('2026-10-22T12:00:00Z');
const ago = (days: number) => new Date(now - days * 864e5).toISOString();
const session = (days: number) => ({
  ...startWorkout(),
  status: 'completed' as const,
  started_at: ago(days),
});

describe('moyenne hebdomadaire', () => {
  it('ne dilue pas un historique de deux semaines dans les périodes longues', () => {
    const workouts = [session(1), session(14), session(3)];
    for (const period of [30, 90, 180, 365, 0]) {
      expect(weeklyFrequency(workouts, period, ago(14), now)).toEqual({ rate: 1.5, days: 14 });
    }
    expect(weeklyFrequency(workouts, 7, ago(14), now)).toEqual({ rate: 2, days: 7 });
  });
  it('garde les semaines sans séance après le début du suivi et respecte la fenêtre', () => {
    const workouts = [session(1), session(60)];
    expect(weeklyFrequency(workouts, 30, ago(60), now).rate).toBeCloseTo(7 / 30);
    expect(weeklyFrequency(workouts, 0, ago(60), now).rate).toBeCloseTo(14 / 60);
  });
  it('ne projette pas une première journée sur sept jours et exclut brouillons et dates futures', () => {
    const workouts = [session(0), { ...session(1), status: 'draft' as const }, session(-1)];
    expect(weeklyFrequency(workouts, 90, ago(0), now)).toEqual({ rate: 1, days: 7 });
    expect(weeklyFrequency([], 0, null, now).rate).toBe(0);
    expect(weeklyFrequency([session(7), session(7.001)], 7, ago(100), now).rate).toBe(1);
  });
});
