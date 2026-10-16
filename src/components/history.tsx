'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Plus, History as HistoryIcon, Trash2, ArrowUpRight } from 'lucide-react';
import { useData } from './store';
import { useStartWorkout } from './dashboard';
import { Button, PageTitle, Empty, ErrorBox, api } from './ui';
import type { Workout } from '@/lib/domain';
import { workoutVolume, eligible, number, shortDate, cardioTotals, duration } from '@/lib/metrics';
export function History() {
  const { data, reload } = useData();
  const launch = useStartWorkout();
  const [rows, setRows] = useState(data.workouts),
    [page, setPage] = useState(0),
    [more, setMore] = useState(data.workouts.length === 30),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(''),
    [error, setError] = useState<string | null>(null);
  const filtered = rows.filter((w) => !status || w.status === status);
  return (
    <>
      <PageTitle
        eyebrow="CHAQUE EFFORT LAISSE UNE TRACE"
        title="Historique"
        description="Retrouvez vos séances, vos sensations et vos performances exactes."
        actions={
          <Button busy={launch.busy} onClick={() => launch.start()}>
            <Plus size={16} />
            Séance libre
          </Button>
        }
      />
      <ErrorBox message={error ?? launch.error} />
      <div className="search-bar">
        <select
          aria-label="État des séances"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Tous les entraînements</option>
          <option value="completed">Terminés</option>
          <option value="draft">Brouillons</option>
          <option value="active">En cours</option>
        </select>
        <span className="muted" style={{ fontSize: 11, alignSelf: 'center' }}>
          {rows.length} séances chargées
        </span>
      </div>
      <section className="card">
        {!filtered.length ? (
          <Empty
            icon={<HistoryIcon />}
            title="Votre histoire s’écrit à l’entraînement"
            description="Les séances correspondant à ce filtre apparaîtront ici. Chargez davantage de séances si nécessaire."
          />
        ) : (
          <div className="table-scroll">
            <table className="history-table">
              <thead>
                <tr>
                  <th>SÉANCE</th>
                  <th>DATE</th>
                  <th>EXERCICES / SÉRIES</th>
                  <th>VOLUME EXTERNE</th>
                  <th>DURÉE</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((w) => (
                  <tr key={w.id}>
                    <td>
                      <Link href={`/seances/${w.id}`}>
                        <strong>
                          {w.name} <ArrowUpRight size={13} style={{ display: 'inline' }} />
                        </strong>
                      </Link>
                      <br />
                      <span
                        className={`badge ${w.status === 'completed' ? 'badge-green' : 'badge-orange'}`}
                        style={{ marginTop: 7 }}
                      >
                        {w.status === 'completed'
                          ? 'Terminée'
                          : w.status === 'draft'
                            ? 'Brouillon'
                            : 'En cours'}
                      </span>
                    </td>
                    <td>
                      {shortDate(w.started_at)}
                      <br />
                      <small>{new Date(w.started_at).getFullYear()}</small>
                    </td>
                    <td>
                      {w.exercises.length} exercices
                      <br />
                      <small>
                        {w.exercises.flatMap((e) => e.sets).filter((s) => eligible(s)).length}{' '}
                        séries de travail
                      </small>
                    </td>
                    <td>
                      {number(workoutVolume(w))} kg
                      {cardioTotals(w).seconds > 0 && (
                        <>
                          <br />
                          <small>
                            {duration(cardioTotals(w).seconds)} cardio ·{' '}
                            {number(cardioTotals(w).distance, 2)} km renseignés
                          </small>
                        </>
                      )}
                    </td>
                    <td>
                      {w.finished_at
                        ? `${Math.round((Date.parse(w.finished_at) - Date.parse(w.started_at)) / 60000)} min`
                        : '—'}
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        disabled={busy}
                        aria-label={`Supprimer ${w.name}`}
                        onClick={async () => {
                          if (
                            !confirm(
                              `Supprimer définitivement « ${w.name} » ? Les records seront recalculés.`,
                            )
                          )
                            return;
                          setBusy(true);
                          try {
                            await api('/api/workouts', {
                              method: 'DELETE',
                              body: JSON.stringify({ id: w.id, revision: w.revision }),
                            });
                            // Restart pagination after a deletion so an offset cannot skip a row.
                            const firstPage = await api<Workout[]>('/api/workouts?page=0');
                            setRows(firstPage);
                            setPage(0);
                            setMore(firstPage.length === 30);
                            try {
                              localStorage.removeItem(`forge:recovery:${data.user_id}:${w.id}`);
                            } catch {
                              /* La base reste la source de vérité. */
                            }
                            await reload();
                          } catch (e) {
                            setError((e as Error).message);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        <Trash2 size={15} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {more && (
        <div className="pagination">
          <Button
            variant="secondary"
            busy={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await api<Workout[]>(`/api/workouts?page=${page + 1}`);
                setRows((current) => [
                  ...current,
                  ...r.filter((w) => !current.some((x) => x.id === w.id)),
                ]);
                setPage(page + 1);
                setMore(r.length === 30);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Charger les séances précédentes
          </Button>
        </div>
      )}
    </>
  );
}
