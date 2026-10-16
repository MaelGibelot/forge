'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { workoutSchema, type Workout } from './domain';
import { api } from '@/components/ui';
const content = (w: Workout) => JSON.stringify({ ...w, revision: 0 });
export function useWorkoutSave(initial: Workout, userId: string, onSaved: (w: Workout) => void) {
  const key = `forge:recovery:${userId}:${initial.id}`;
  const [recovery] = useState(() => {
    try {
      const local = JSON.parse(localStorage.getItem(key) ?? 'null') as {
        version?: number;
        workout: Workout;
        pending: boolean;
      } | null;
      const parsed = workoutSchema.safeParse(local?.workout);
      return local?.pending && parsed.success && parsed.data.id === initial.id
        ? { ...local, workout: parsed.data }
        : null;
    } catch {
      return null;
    }
  });
  const [workout, setWorkout] = useState(recovery?.workout ?? initial);
  const [status, setStatus] = useState<
    'saved' | 'dirty' | 'saving' | 'error' | 'conflict' | 'deleting' | 'deleted' | 'delete-error'
  >(recovery ? (recovery.workout.revision !== initial.revision ? 'conflict' : 'dirty') : 'saved');
  const [error, setError] = useState<string | null>(
    recovery && recovery.workout.revision !== initial.revision
      ? 'Une saisie locale a été retrouvée, mais la version du serveur a changé. Copiez vos notes si nécessaire puis rechargez la version du serveur.'
      : null,
  );
  const [localWarning, setLocalWarning] = useState(false);
  const latest = useRef(workout),
    revision = useRef(initial.revision),
    saved = useRef(content(initial)),
    running = useRef<Promise<void> | null>(null),
    blocked = useRef(status === 'conflict'),
    stopped = useRef(false),
    onSavedRef = useRef(onSaved);
  useEffect(() => {
    onSavedRef.current = onSaved;
  }, [onSaved]);
  const store = useCallback(
    (w: Workout, pending: boolean) => {
      try {
        localStorage.setItem(key, JSON.stringify({ version: 1, workout: w, pending }));
      } catch {
        setLocalWarning(true);
      }
    },
    [key],
  );
  const change = useCallback(
    (next: Workout) => {
      if (stopped.current) return;
      const w = { ...next, revision: revision.current };
      latest.current = w;
      setWorkout(w);
      store(w, true);
      if (!blocked.current) setStatus('dirty');
    },
    [store],
  );
  const save = useCallback(
    async function flush(): Promise<void> {
      if (stopped.current) return;
      if (blocked.current)
        throw new Error('Conflit de versions : rechargez la version du serveur.');
      if (running.current) {
        await running.current;
        if (content(latest.current) !== saved.current) return flush();
        return;
      }
      if (content(latest.current) === saved.current) return;
      const snapshot = { ...latest.current, revision: revision.current };
      setStatus('saving');
      setError(null);
      const job = (async () => {
        try {
          const response = await api<{ revision: number }>('/api/workouts', {
            method: 'POST',
            body: JSON.stringify(snapshot),
          });
          revision.current = response.revision;
          saved.current = content(snapshot);
          const next = { ...latest.current, revision: response.revision };
          latest.current = next;
          setWorkout(next);
          const dirty = content(next) !== saved.current;
          store(next, dirty);
          if (!stopped.current) setStatus(dirty ? 'dirty' : 'saved');
          onSavedRef.current({ ...snapshot, revision: response.revision });
        } catch (e) {
          const err = e as Error & { status?: number };
          if (err.status === 409) {
            blocked.current = true;
            if (!stopped.current) setStatus('conflict');
          } else if (!stopped.current) setStatus('error');
          if (!stopped.current) setError(err.message);
          store(latest.current, true);
          throw e;
        }
      })();
      running.current = job;
      try {
        await job;
      } finally {
        running.current = null;
      }
      if (content(latest.current) !== saved.current) await flush();
    },
    [store],
  );
  const remove = useCallback(async () => {
    if (stopped.current) return;
    stopped.current = true;
    setStatus('deleting');
    setError(null);
    try {
      // Finish the request already in flight, then delete its confirmed revision.
      // Unsaved edits need not be persisted to discard a session.
      await running.current?.catch(() => {});
      await api('/api/workouts', {
        method: 'DELETE',
        body: JSON.stringify({ id: initial.id, revision: revision.current }),
      });
    } catch (e) {
      stopped.current = false;
      const err = e as Error & { status?: number };
      if (err.status === 409) blocked.current = true;
      setStatus(blocked.current ? 'conflict' : 'delete-error');
      setError(err.message);
      throw e;
    }
    try {
      localStorage.removeItem(key);
    } catch {
      // The server has deleted the session; a local cleanup failure cannot undo it.
    }
    setStatus('deleted');
  }, [initial.id, key]);
  useEffect(() => {
    if (status !== 'dirty') return;
    const t = setTimeout(() => {
      save().catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [workout, status, save]);
  useEffect(() => {
    const reconnect = () => {
      save().catch(() => {});
    };
    const leave = (e: BeforeUnloadEvent) => {
      if (!stopped.current && content(latest.current) !== saved.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('online', reconnect);
    window.addEventListener('beforeunload', leave);
    return () => {
      window.removeEventListener('online', reconnect);
      window.removeEventListener('beforeunload', leave);
    };
  }, [save]);
  const reloadServer = () => {
    if (
      confirm('Abandonner les modifications locales et charger la dernière version du serveur ?')
    ) {
      localStorage.removeItem(key);
      window.location.reload();
    }
  };
  return { workout, change, save, remove, status, error, localWarning, reloadServer };
}
