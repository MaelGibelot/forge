// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { Shell } from '../src/components/shell';
import { ProgramEditor } from '../src/components/programs';
import { Statistics } from '../src/components/statistics';
import { MuscleActivity } from '../src/components/anatomy';
import { WorkoutPage } from '../src/components/workout';
import {
  defaults,
  programSchema,
  startWorkout,
  newEntry,
  newSet,
  type Workout,
  type WorkoutExercise,
} from '../src/lib/domain';
import { catalog } from '../src/lib/catalog';
const state = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  api: vi.fn(),
  reload: vi.fn(async () => {}),
  setWorkout: vi.fn(),
  allWorkouts: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/poids',
  useRouter: () => ({ push: state.push, replace: state.replace }),
}));
vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('next/link', () => ({
  default: ({ children, ...p }: ComponentProps<'a'>) => <a {...p}>{children}</a>,
}));
vi.mock('../src/components/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/components/ui')>()),
  api: state.api,
}));
vi.mock('../src/components/store', () => ({
  useData: () => ({
    data: {
      user_id: '30000000-0000-4000-8000-000000000001',
      preferences: defaults,
      programs: [],
      exercises: catalog,
      workouts: [],
      progression: [],
      bodyweights: [],
    },
    reload: state.reload,
    setWorkout: state.setWorkout,
  }),
  allWorkouts: state.allWorkouts,
}));

beforeEach(() => {
  state.api.mockReset();
  state.allWorkouts.mockReset().mockResolvedValue([]);
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});
describe('parcours des composants privés (DOM, sans service Auth simulé)', () => {
  it('rend les rubriques supplémentaires et la déconnexion accessibles sur mobile', () => {
    render(
      <Shell name="Jean">
        <div>Contenu</div>
      </Shell>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Plus de rubriques' }));
    const menu = within(screen.getByRole('dialog', { name: 'Votre espace' }));
    expect(menu.getByRole('link', { name: 'Records' }).getAttribute('href')).toBe('/records');
    expect(menu.getByRole('link', { name: 'Poids corporel' }).getAttribute('href')).toBe('/poids');
    expect(menu.getByRole('link', { name: 'Paramètres' }).getAttribute('href')).toBe('/parametres');
    expect(menu.getByRole('button', { name: 'Se déconnecter' })).toBeTruthy();
    fireEvent.click(menu.getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('construit un programme et un superset via les contrôles, puis soumet un modèle valide', async () => {
    state.api.mockResolvedValue({ revision: 1 });
    render(<ProgramEditor />);
    fireEvent.change(screen.getByLabelText('Nom du programme'), {
      target: { value: 'Upper test' },
    });
    for (const name of ['Développé couché', 'Extension triceps corde']) {
      fireEvent.click(screen.getByRole('button', { name: 'Ajouter un exercice' }));
      const picker = within(screen.getByRole('dialog'));
      fireEvent.change(picker.getByLabelText('Rechercher un exercice'), {
        target: { value: name },
      });
      fireEvent.click(picker.getAllByRole('button').find((b) => b.textContent?.startsWith(name))!);
    }
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Sélectionner Développé couché pour un superset' }),
    );
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: 'Sélectionner Extension triceps corde pour un superset',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Regrouper en superset' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le programme' }));
    await waitFor(() => expect(state.push).toHaveBeenCalledWith('/programmes'));
    const submitted = programSchema.parse(JSON.parse(state.api.mock.calls[0][1].body));
    expect(submitted.name).toBe('Upper test');
    expect(submitted.days[0].groups).toHaveLength(1);
    expect(
      submitted.days[0].exercises.every((e) => e.group_id === submitted.days[0].groups[0].id),
    ).toBe(true);
  });
  it('limite les statistiques à 7 jours et adapte la carte aux séries validées et aux échauffements', async () => {
    const entry = newEntry(catalog[0], 0);
    const exercise: WorkoutExercise = {
      ...entry,
      technique_ok: true,
      sets: [
        { ...newSet(0, entry.target), completed: true, reps: 10 },
        { ...newSet(1, entry.target), completed: true, reps: 10, type: 'warmup' },
        { ...newSet(2, entry.target), completed: false, reps: 10 },
      ],
    };
    const recent: Workout = { ...startWorkout(), status: 'completed', exercises: [exercise] };
    const old = {
      ...recent,
      id: crypto.randomUUID(),
      started_at: new Date(Date.now() - 10 * 864e5).toISOString(),
    };
    const draft: Workout = { ...recent, id: crypto.randomUUID(), status: 'draft' };
    state.allWorkouts.mockImplementation(async (since: string) =>
      [recent, old, draft].filter((w) => w.started_at >= since),
    );
    render(<Statistics />);
    await screen.findByRole('region', { name: 'Zones musculaires travaillées' });
    const count = () =>
      within(screen.getByRole('img', { name: 'Vue avant, séries directes' })).getByText(
        `${exercise.primary_muscle} : 1 séries directes`,
      );
    fireEvent.click(screen.getByRole('button', { name: '7 jours' }));
    await waitFor(() => expect(count()).toBeTruthy());
    const requested = Date.parse(state.allWorkouts.mock.lastCall![0]);
    expect(Math.abs(requested - (Date.now() - 7 * 864e5))).toBeLessThan(3000);
    expect(screen.getByRole('button', { name: '7 jours' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: '7 jours' }));
    expect(count()).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Inclure les échauffements' }));
    expect(
      within(screen.getByRole('img', { name: 'Vue avant, séries directes' })).getByText(
        `${exercise.primary_muscle} : 2 séries directes`,
      ),
    ).toBeTruthy();
  });
  it('colore les zones selon les séries et sépare les sollicitations secondaires', () => {
    render(
      <MuscleActivity
        direct={[
          { name: 'Pectoraux', count: 5 },
          { name: 'Abdominaux', count: 6 },
          { name: 'Biceps', count: 11 },
        ]}
        secondary={[{ name: 'Pectoraux', count: 8 }]}
      />,
    );
    const fill = (text: string) =>
      within(screen.getByRole('img', { name: /Vue avant/ }))
        .getByText(text)
        .parentElement!.getAttribute('fill');
    expect(fill('Pectoraux : 5 séries directes')).toBe('#94bca4');
    expect(fill('Abdominaux : 6 séries directes')).toBe('#e5b65c');
    expect(fill('Biceps : 11 séries directes')).toBe('#f18b54');
    expect(fill('Quadriceps : 0 séries directes')).toBe('var(--panel2)');
    fireEvent.click(screen.getByRole('button', { name: 'Secondaires' }));
    expect(fill('Pectoraux : 8 sollicitations secondaires')).toBe('#e5b65c');
    expect(fill('Biceps : 0 sollicitations secondaires')).toBe('var(--panel2)');
  });
  it.each(['active', 'draft', 'completed'] as const)(
    'supprime une séance libre %s depuis sa fiche après confirmation',
    async (status) => {
      const w: Workout = { ...startWorkout(), revision: 1, status };
      state.api.mockImplementation(async (_url: string, options?: RequestInit) =>
        options?.method === 'DELETE' ? { success: true } : [w],
      );
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
      render(<WorkoutPage id={w.id} />);
      const button = await screen.findByRole('button', { name: 'Supprimer la séance' });
      fireEvent.click(button);
      expect(state.api.mock.calls.some(([, options]) => options?.method === 'DELETE')).toBe(false);
      expect(state.replace).not.toHaveBeenCalled();
      confirm.mockReturnValue(true);
      fireEvent.click(button);
      await waitFor(() => expect(state.replace).toHaveBeenCalledWith('/historique'));
      const call = state.api.mock.calls.find(([, options]) => options?.method === 'DELETE')!;
      expect(JSON.parse(call[1].body)).toEqual({ id: w.id, revision: 1 });
      expect(state.reload).toHaveBeenCalled();
    },
  );
});
