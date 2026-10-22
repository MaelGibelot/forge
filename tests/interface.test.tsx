// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { Shell } from '../src/components/shell';
import { ProgramEditor } from '../src/components/programs';
import { Statistics } from '../src/components/statistics';
import { MuscleActivity } from '../src/components/anatomy';
import { WorkoutPage } from '../src/components/workout';
import { ExerciseLibrary, ExercisePicker } from '../src/components/exercises';
import {
  defaults,
  programSchema,
  startWorkout,
  newEntry,
  newSet,
  workoutSchema,
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
  it('choisit 1 à 30 répétitions et conserve une ancienne valeur sans champ RPE/RIR', async () => {
    const entry = newEntry(catalog[0], 0);
    const w: Workout = {
      ...startWorkout(),
      revision: 1,
      exercises: [
        {
          ...entry,
          technique_ok: true,
          sets: [{ ...newSet(0, entry.target), reps: 45, rpe: 8, rir: 2 }],
        },
      ],
    };
    let submitted: Workout | undefined;
    state.api.mockImplementation(async (_url: string, options?: RequestInit) => {
      if (options?.method === 'POST') {
        submitted = workoutSchema.parse(JSON.parse(String(options.body)));
        return { revision: 2 };
      }
      return [w];
    });
    render(<WorkoutPage id={w.id} />);
    const reps = await screen.findByRole('combobox', { name: 'Répétitions série 1' });
    expect((reps as HTMLSelectElement).value).toBe('45');
    expect(
      within(reps)
        .getAllByRole('option')
        .filter((o) => !(o as HTMLOptionElement).disabled)
        .map((o) => o.textContent),
    ).toEqual(Array.from({ length: 30 }, (_, i) => String(i + 1)));
    expect(screen.queryByLabelText(/RPE|RIR/)).toBeNull();
    fireEvent.change(reps, { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sauver en brouillon' }));
    await waitFor(() => expect(submitted?.exercises[0].sets[0].reps).toBe(30));
    expect(submitted!.exercises[0].sets[0]).toMatchObject({ rpe: 8, rir: 2 });
  });
  it('retrouve le pupitre EZ et distingue les prises dans le sélecteur', () => {
    const select = vi.fn();
    render(<ExercisePicker onClose={() => {}} onSelect={select} />);
    const search = screen.getByRole('textbox', { name: 'Rechercher un exercice' });
    fireEvent.change(search, { target: { value: 'pupitre' } });
    fireEvent.click(screen.getByRole('button', { name: /Curl pupitre · barre EZ/ }));
    expect(select.mock.lastCall![0].name).toBe('Curl pupitre · barre EZ');
    fireEvent.change(search, { target: { value: 'Tirage vertical · supination serrée' } });
    fireEvent.click(screen.getByRole('button', { name: /Tirage vertical · supination serrée/ }));
    expect(select.mock.lastCall![0].id).not.toBe(select.mock.calls[0][0].id);
  });
  it('retrouve une machine Technogym dans la bibliothèque et le sélecteur', async () => {
    const machine = catalog.find((e) => e.name.includes('Skillrow'))!;
    const library = render(<ExerciseLibrary />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Collection' }), {
      target: { value: 'technogym' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Rechercher' }), {
      target: { value: 'Skillrow' },
    });
    expect(screen.getByRole('link', { name: new RegExp('Skillrow') }).getAttribute('href')).toBe(
      `/exercices/${machine.id}`,
    );
    library.unmount();
    const select = vi.fn();
    render(<ExercisePicker onClose={() => {}} onSelect={select} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Collection' }), {
      target: { value: 'cardio' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Rechercher un exercice' }), {
      target: { value: 'Skillrow' },
    });
    fireEvent.click(screen.getByRole('button', { name: new RegExp('Skillrow') }));
    expect(select).toHaveBeenCalledWith(machine);
  });
  it('prépare un programme cardio avec des intervalles et sans objectifs de charge', async () => {
    state.api.mockResolvedValue({ revision: 1 });
    render(<ProgramEditor />);
    fireEvent.change(screen.getByLabelText('Nom du programme'), {
      target: { value: 'Cardio test' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un exercice' }));
    fireEvent.change(screen.getByLabelText('Rechercher un exercice'), {
      target: { value: 'Skillrow' },
    });
    fireEvent.click(screen.getByRole('button', { name: new RegExp('Skillrow') }));
    expect(screen.getByRole('spinbutton', { name: 'Nombre d’intervalles cardio' })).toBeTruthy();
    expect(screen.queryByRole('spinbutton', { name: 'Répétitions minimales' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le programme' }));
    await waitFor(() => expect(state.push).toHaveBeenCalledWith('/programmes'));
    expect(
      programSchema.parse(JSON.parse(state.api.mock.calls[0][1].body)).days[0].exercises[0],
    ).toMatchObject({ load_kind: 'cardio', target: { sets: 1 } });
  });
  it('saisit et termine une séance cardio avec une durée et une distance réelles', async () => {
    const machine = catalog.find((e) => e.name.includes('Skillrow'))!;
    const entry = newEntry(machine, 0);
    const w: Workout = {
      ...startWorkout(),
      revision: 1,
      exercises: [{ ...entry, technique_ok: false, sets: [newSet(0, entry.target, 'cardio')] }],
    };
    let submitted: Workout | undefined;
    state.api.mockImplementation(async (_url: string, options?: RequestInit) => {
      if (options?.method === 'POST') {
        submitted = workoutSchema.parse(JSON.parse(String(options.body)));
        return { revision: 2 };
      }
      return [w];
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<WorkoutPage id={w.id} />);
    await screen.findByRole('spinbutton', { name: 'Durée intervalle 1, minutes' });
    expect(
      (screen.getByRole('checkbox', { name: 'Intervalle 1 effectué' }) as HTMLInputElement)
        .disabled,
    ).toBe(true);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Durée intervalle 1, minutes' }), {
      target: { value: '20' },
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Distance intervalle 1' }), {
      target: { value: '4.5' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Intervalle 1 effectué' }));
    fireEvent.click(screen.getByRole('button', { name: 'Terminer la séance' }));
    await waitFor(() => expect(state.push).toHaveBeenCalledWith('/historique'));
    expect(submitted!.status).toBe('completed');
    expect(submitted!.exercises[0].sets[0]).toMatchObject({
      duration_seconds: 1200,
      distance_km: 4.5,
      reps: 0,
      weight: null,
      completed: true,
    });
  });
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
    expect(screen.queryByLabelText(/RPE cible|RIR cible/)).toBeNull();
    fireEvent.change(screen.getAllByRole('combobox', { name: 'Répétitions maximales' })[0], {
      target: { value: '20' },
    });
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
    expect(submitted.days[0].exercises[0].target.reps_max).toBe(20);
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
