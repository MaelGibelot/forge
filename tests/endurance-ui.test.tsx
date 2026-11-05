// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { Dashboard } from '../src/components/dashboard';
import { Settings } from '../src/components/settings';
import { defaults, startWorkout, workoutSchema, type AppData } from '../src/lib/domain';
import { enduranceActivities, enduranceActivity } from '../src/lib/endurance';

const state = vi.hoisted(() => ({
  data: null as AppData | null,
  api: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  reload: vi.fn(async () => {}),
  setWorkout: vi.fn(),
  allWorkouts: vi.fn(async () => []),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: state.push, refresh: state.refresh }),
}));
vi.mock('next-themes', () => ({ useTheme: () => ({ theme: 'light', setTheme: vi.fn() }) }));
vi.mock('next/link', () => ({
  default: ({ children, ...props }: ComponentProps<'a'>) => <a {...props}>{children}</a>,
}));
vi.mock('../src/components/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/components/ui')>()),
  api: state.api,
}));
vi.mock('../src/components/store', () => ({
  useData: () => ({ data: state.data, reload: state.reload, setWorkout: state.setWorkout }),
  allWorkouts: state.allWorkouts,
}));

beforeEach(() => {
  state.data = {
    user_id: '30000000-0000-4000-8000-000000000001',
    preferences: { ...defaults },
    exercises: enduranceActivities,
    workouts: [],
    bodyweights: [],
    programs: [],
    progression: [],
  };
  state.api.mockReset();
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('objectifs et plans cardio', () => {
  it('enregistre des objectifs distincts et convertit les mètres de natation en kilomètres', async () => {
    state.api.mockResolvedValue({ ok: true });
    render(<Settings />);
    fireEvent.change(screen.getByLabelText('Objectif cardio · Course à pied'), {
      target: { value: 'performance' },
    });
    fireEvent.change(screen.getByLabelText('Séances par semaine · Course à pied'), {
      target: { value: '3' },
    });
    fireEvent.change(screen.getByLabelText('Distance cible · Course à pied'), {
      target: { value: '10' },
    });
    fireEvent.change(screen.getByLabelText('Temps cible · Course à pied, minutes'), {
      target: { value: '50' },
    });
    fireEvent.change(screen.getByLabelText('Sport de l’objectif cardio'), {
      target: { value: 'swimming' },
    });
    fireEvent.change(screen.getByLabelText('Objectif cardio · Natation'), {
      target: { value: 'distance' },
    });
    fireEvent.change(screen.getByLabelText('Distance cible · Natation'), {
      target: { value: '800' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer mes préférences' }));

    await waitFor(() => expect(state.api).toHaveBeenCalledTimes(1));
    const [path, request] = state.api.mock.calls[0];
    expect(path).toBe('/api/preferences');
    expect(JSON.parse(request.body).endurance_goals).toEqual([
      {
        sport: 'running',
        objective: 'performance',
        sessions_per_week: 3,
        target_distance_km: 10,
        target_time_seconds: 3000,
      },
      { sport: 'swimming', objective: 'distance', sessions_per_week: 2, target_distance_km: 0.8 },
    ]);
  });

  it('démarre une séance du plan avec sa consigne et des mesures à saisir', async () => {
    state.data!.preferences.endurance_goals = [
      { sport: 'running', objective: 'fitness', sessions_per_week: 3 },
    ];
    state.api.mockResolvedValue({ revision: 1 });
    render(<Dashboard />);
    fireEvent.click(
      await screen.findByRole('button', { name: /^Démarrer Course à pied, séance 1/ }),
    );

    await waitFor(() => expect(state.api).toHaveBeenCalledTimes(1));
    const [path, request] = state.api.mock.calls[0];
    expect(path).toBe('/api/workouts');
    const workout = workoutSchema.parse(JSON.parse(request.body));
    expect(workout.source_day_id).toBeNull();
    expect(workout.exercises).toHaveLength(1);
    const [exercise] = workout.exercises;
    expect(enduranceActivity(exercise.exercise_id)?.sport).toBe('running');
    expect(exercise.notes).toMatch(/\d+ min/);
    expect(exercise.sets).toMatchObject([
      { completed: false, duration_seconds: null, distance_km: null, reps: 0, weight: null },
    ]);
    await waitFor(() => expect(state.push).toHaveBeenCalledWith(`/seances/${workout.id}`));
  });

  it('propose de reprendre une séance active au lieu de lancer un créneau différent', async () => {
    const active = startWorkout();
    state.data!.workouts = [active];
    state.data!.preferences.endurance_goals = [
      { sport: 'cycling', objective: 'distance', sessions_per_week: 2 },
    ];
    render(<Dashboard />);

    const resume = await screen.findByRole('link', { name: 'Reprendre la séance en cours' });
    expect(resume.getAttribute('href')).toBe(`/seances/${active.id}`);
    expect(screen.queryByRole('button', { name: /^Démarrer Vélo, séance/ })).toBeNull();
  });
});
