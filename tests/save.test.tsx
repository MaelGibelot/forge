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
  it('attend la sauvegarde en cours puis supprime sa version sans relancer les saisies en attente', async () => {
    vi.useFakeTimers();
    let saved!: (v: { revision: number }) => void;
    let deleted!: (v: { success: boolean }) => void;
    mock.api
      .mockReturnValueOnce(new Promise((r) => (saved = r)))
      .mockReturnValueOnce(new Promise((r) => (deleted = r)));
    const w = { ...startWorkout(), revision: 1 };
    const { result } = renderHook(() => useWorkoutSave(w, user, () => {}));
    act(() => result.current.change({ ...w, notes: 'A' }));
    let saving!: Promise<void>, removing!: Promise<void>;
    act(() => {
      saving = result.current.save();
    });
    act(() => result.current.change({ ...result.current.workout, notes: 'B' }));
    act(() => {
      removing = result.current.remove();
    });
    expect(result.current.status).toBe('deleting');
    expect(mock.api).toHaveBeenCalledTimes(1);
    await act(async () => {
      saved({ revision: 2 });
      await saving;
    });
    expect(mock.api).toHaveBeenCalledTimes(2);
    expect(mock.api.mock.calls[1][1]).toMatchObject({ method: 'DELETE' });
    expect(JSON.parse(mock.api.mock.calls[1][1].body)).toEqual({ id: w.id, revision: 2 });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(mock.api).toHaveBeenCalledTimes(2);
    await act(async () => {
      deleted({ success: true });
      await removing;
    });
    expect(result.current.status).toBe('deleted');
    expect(localStorage.getItem(`forge:recovery:${user}:${w.id}`)).toBeNull();
    act(() => {
      window.dispatchEvent(new Event('online'));
      result.current.change({ ...w, notes: 'Ne pas recréer' });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
      await result.current.save();
    });
    expect(mock.api).toHaveBeenCalledTimes(2);
  });
  it('garde la saisie et permet de sauvegarder ou supprimer à nouveau après un échec réseau', async () => {
    mock.api
      .mockRejectedValueOnce(new Error('Suppression hors ligne'))
      .mockResolvedValueOnce({ revision: 2 })
      .mockResolvedValueOnce({ success: true });
    const w = { ...startWorkout(), revision: 1 };
    const { result } = renderHook(() => useWorkoutSave(w, user, () => {}));
    act(() => result.current.change({ ...w, notes: 'À conserver' }));
    await act(async () => {
      await expect(result.current.remove()).rejects.toThrow('hors ligne');
    });
    expect(result.current.status).toBe('delete-error');
    expect(result.current.workout.notes).toBe('À conserver');
    expect(localStorage.getItem(`forge:recovery:${user}:${w.id}`)).not.toBeNull();
    await act(async () => {
      await result.current.save();
    });
    expect(result.current.status).toBe('saved');
    await act(async () => {
      await result.current.remove();
    });
    expect(JSON.parse(mock.api.mock.calls[2][1].body).revision).toBe(2);
    expect(result.current.status).toBe('deleted');
  });
  it('conserve la récupération et bloque les sauvegardes après un conflit de suppression', async () => {
    mock.api.mockRejectedValue(Object.assign(new Error('La séance a changé'), { status: 409 }));
    const w = { ...startWorkout(), revision: 1 };
    const { result } = renderHook(() => useWorkoutSave(w, user, () => {}));
    act(() => result.current.change({ ...w, notes: 'À conserver' }));
    await act(async () => {
      await result.current.remove().catch(() => {});
    });
    expect(result.current.status).toBe('conflict');
    expect(localStorage.getItem(`forge:recovery:${user}:${w.id}`)).not.toBeNull();
    await expect(result.current.save()).rejects.toThrow('Conflit');
    expect(mock.api).toHaveBeenCalledTimes(1);
  });
});
