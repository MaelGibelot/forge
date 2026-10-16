// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { Shell } from '../src/components/shell';
import { ProgramEditor } from '../src/components/programs';
import { defaults, programSchema } from '../src/lib/domain';
import { catalog } from '../src/lib/catalog';
const state = vi.hoisted(() => ({
  push: vi.fn(),
  api: vi.fn(),
  reload: vi.fn(async () => {}),
  setWorkout: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/poids',
  useRouter: () => ({ push: state.push }),
}));
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
  allWorkouts: async () => [],
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
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
});
