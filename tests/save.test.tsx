// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { startWorkout } from '../src/lib/domain';
import { useWorkoutSave } from '../src/lib/use-workout-save';
const mock = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock('../src/components/ui', () => ({ api: mock.api }));
const user = '30000000-0000-4000-8000-000000000001';
beforeEach(() => {
  localStorage.clear();
  mock.api.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
describe('sauvegarde et reprise côté navigateur', () => {
  it('ne marque enregistré qu’après confirmation serveur', async () => {
    let resolve!: (v: { revision: number }) => void;
    mock.api.mockReturnValue(new Promise((r) => (resolve = r)));
    const w = { ...startWorkout(), revision: 1 };
    const { result } = renderHook(() => useWorkoutSave(w, user, () => {}));
    act(() => result.current.change({ ...w, name: 'Nouvelle saisie' }));
    expect(result.current.status).toBe('dirty');
    let saving!: Promise<void>;
    act(() => {
      saving = result.current.save();
    });
    expect(result.current.status).toBe('saving');
    await act(async () => {
      resolve({ revision: 2 });
      await saving;
    });
    expect(result.current.status).toBe('saved');
    expect(result.current.workout.revision).toBe(2);
  });
  it('conserve la saisie après un échec et permet de réessayer', async () => {
    mock.api.mockRejectedValueOnce(new Error('Hors ligne')).mockResolvedValueOnce({ revision: 2 });
    const w = { ...startWorkout(), revision: 1 };
    const { result } = renderHook(() => useWorkoutSave(w, user, () => {}));
    act(() => result.current.change({ ...w, notes: 'Notes conservées' }));
    await act(async () => {
      await result.current.save().catch(() => {});
    });
    expect(result.current.status).toBe('error');
    const stored = JSON.parse(localStorage.getItem(`forge:recovery:${user}:${w.id}`)!);
    expect(stored.pending).toBe(true);
    expect(stored.workout.notes).toBe('Notes conservées');
    await act(async () => {
      await result.current.save();
    });
    expect(result.current.status).toBe('saved');
  });
  it('sérialise deux modifications pendant un enregistrement', async () => {
    let first!: (v: { revision: number }) => void;
    mock.api
      .mockReturnValueOnce(new Promise((r) => (first = r)))
      .mockResolvedValueOnce({ revision: 3 });
    const w = { ...startWorkout(), revision: 1 };
    const { result } = renderHook(() => useWorkoutSave(w, user, () => {}));
    act(() => result.current.change({ ...w, notes: 'A' }));
    let job!: Promise<void>;
    act(() => {
      job = result.current.save();
    });
    act(() => result.current.change({ ...result.current.workout, notes: 'B' }));
    await act(async () => {
      first({ revision: 2 });
      await job;
    });
    expect(mock.api).toHaveBeenCalledTimes(2);
    const last = JSON.parse(mock.api.mock.calls[1][1].body);
    expect(last).toMatchObject({ notes: 'B', revision: 2 });
    expect(result.current.status).toBe('saved');
  });
  it('récupère un brouillon non synchronisé au rechargement', async () => {
    const w = { ...startWorkout(), revision: 1 };
    localStorage.setItem(
      `forge:recovery:${user}:${w.id}`,
      JSON.stringify({ pending: true, workout: { ...w, notes: 'Reprise' } }),
    );
    mock.api.mockResolvedValue({ revision: 2 });
    const { result } = renderHook(() => useWorkoutSave(w, user, () => {}));
    expect(result.current.workout.notes).toBe('Reprise');
    await act(async () => {
      await result.current.save();
    });
    expect(result.current.status).toBe('saved');
  });
  it('bloque un conflit au lieu d’écraser les données', async () => {
    const w = { ...startWorkout(), revision: 1 };
    mock.api.mockRejectedValue(Object.assign(new Error('Conflit'), { status: 409 }));
    const { result } = renderHook(() => useWorkoutSave(w, user, () => {}));
    act(() => result.current.change({ ...w, notes: 'Conserver' }));
    await act(async () => {
      await result.current.save().catch(() => {});
    });
    expect(result.current.status).toBe('conflict');
    await expect(result.current.save()).rejects.toThrow('Conflit');
    expect(mock.api).toHaveBeenCalledTimes(1);
  });
  it('ne restaure pas le brouillon d’un autre utilisateur', () => {
    const w = { ...startWorkout(), revision: 1 };
    localStorage.setItem(
      `forge:recovery:autre:${w.id}`,
      JSON.stringify({ pending: true, workout: { ...w, notes: 'Privé' } }),
    );
    const { result } = renderHook(() => useWorkoutSave(w, user, () => {}));
    expect(result.current.workout.notes).toBe('');
  });
  it('enregistre automatiquement après le délai de saisie', async () => {
    mock.api.mockResolvedValue({ revision: 2 });
    const w = { ...startWorkout(), revision: 1 };
    const { result } = renderHook(() => useWorkoutSave(w, user, () => {}));
    act(() => result.current.change({ ...w, notes: 'Automatique' }));
    await waitFor(() => expect(result.current.status).toBe('saved'), { timeout: 2000 });
    expect(mock.api).toHaveBeenCalledTimes(1);
  });
});
