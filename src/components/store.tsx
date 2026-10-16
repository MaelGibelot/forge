'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { AppData, Workout } from '@/lib/domain';
import { api, Button, ErrorBox } from './ui';
interface Context {
  data: AppData;
  reload: () => Promise<void>;
  setWorkout: (w: Workout) => void;
}
const Store = createContext<Context | null>(null);
export function DataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData | null>(null),
    [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    const d = await api<AppData>('/api/data');
    setData(d);
    setError(null);
  }, []);
  useEffect(() => {
    let live = true;
    api<AppData>('/api/data')
      .then((d) => {
        if (live) setData(d);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, []);
  if (error)
    return (
      <div className="standalone">
        <h1>Connexion interrompue</h1>
        <ErrorBox message={error} />
        <Button onClick={() => reload().catch((e) => setError(e.message))}>Réessayer</Button>
      </div>
    );
  if (!data)
    return (
      <div className="page-loading" role="status">
        <div className="loading-line" />
        Chargement de votre espace…
      </div>
    );
  return (
    <Store.Provider
      value={{
        data,
        reload,
        setWorkout: (w) =>
          setData((d) =>
            d ? { ...d, workouts: [w, ...d.workouts.filter((x) => x.id !== w.id)] } : d,
          ),
      }}
    >
      {children}
    </Store.Provider>
  );
}
export function useData() {
  const s = useContext(Store);
  if (!s) throw new Error('Données indisponibles');
  return s;
}
export async function allWorkouts(since?: string, exercise?: string) {
  const result: Workout[] = [];
  for (let page = 0; ; page++) {
    const q = new URLSearchParams({
      page: String(page),
      ...(since ? { since } : {}),
      ...(exercise ? { exercise } : {}),
    });
    const rows = await api<Workout[]>(`/api/workouts?${q}`);
    result.push(...rows);
    if (rows.length < 30) return result;
  }
}
