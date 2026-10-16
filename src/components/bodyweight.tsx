'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Scale, Trash2, Pencil, Plus } from 'lucide-react';
import { useData } from './store';
import { Button, PageTitle, Empty, ErrorBox, Field, api } from './ui';
import { number, shortDate } from '@/lib/metrics';
import type { Bodyweight } from '@/lib/domain';
const ProgressChart = dynamic(() => import('./charts').then((m) => m.ProgressChart), {
  ssr: false,
});
const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
export function BodyweightPage() {
  const { data, reload } = useData();
  const [date, setDate] = useState(today),
    [weight, setWeight] = useState(''),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState(''),
    [older, setOlder] = useState<Bodyweight[]>([]),
    [more, setMore] = useState(data.bodyweights.length === 1000);
  const all = [
    ...data.bodyweights,
    ...older.filter((o) => !data.bodyweights.some((b) => b.id === o.id)),
  ];
  const chart = all.toReversed().map((b) => ({ date: `${b.date}T12:00:00Z`, value: b.weight }));
  return (
    <>
      <PageTitle
        eyebrow="UN AUTRE REGARD SUR VOTRE PARCOURS"
        title="Poids corporel"
        description="Un suivi facultatif, indépendant des charges de vos entraînements."
      />
      <div className="grid-2">
        <section className="card stack">
          <div className="flex">
            <Scale size={20} className="orange" />
            <h2>Ajouter une mesure</h2>
          </div>
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              setSuccess('');
              try {
                await api('/api/bodyweight', {
                  method: 'POST',
                  body: JSON.stringify({ date, weight: Number(weight) }),
                });
                await reload();
                setSuccess('Mesure enregistrée.');
                setWeight('');
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="grid-2">
              <Field label="Date">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </Field>
              <Field label="Poids (kg)">
                <input
                  aria-label="Poids corporel"
                  type="number"
                  inputMode="decimal"
                  min="0.1"
                  max="700"
                  step="0.1"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="Ex. 75,4"
                  required
                />
              </Field>
            </div>
            <p className="muted" style={{ fontSize: 11 }}>
              Une mesure par date. Saisir une date déjà utilisée met à jour sa mesure.
            </p>
            <ErrorBox message={error} />
            {success && (
              <p className="green" role="status">
                {success}
              </p>
            )}
            <Button busy={busy}>
              <Plus size={16} />
              Enregistrer la mesure
            </Button>
          </form>
        </section>
        <section className="card">
          <div className="eyebrow">DERNIÈRE MESURE</div>
          <div className="metric-value">
            {all[0] ? number(all[0].weight, 1) : '—'} <small>kg</small>
          </div>
          <p className="muted" style={{ fontSize: 11, marginTop: 10 }}>
            {all[0] ? shortDate(`${all[0].date}T12:00:00Z`) : 'Ajoutez une mesure pour commencer.'}
          </p>
        </section>
      </div>
      <section className="card" style={{ marginTop: 22 }}>
        <h2>Évolution du poids</h2>
        {chart.length ? (
          <ProgressChart rows={chart} />
        ) : (
          <Empty
            icon={<Scale />}
            title="Chaque parcours est différent"
            description="Votre courbe apparaîtra ici après votre première mesure."
          />
        )}
      </section>
      {all.length > 0 && (
        <section className="card" style={{ marginTop: 22 }}>
          <h2>Vos mesures</h2>
          <table className="history-table">
            <thead>
              <tr>
                <th>DATE</th>
                <th>POIDS</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {all.map((b) => (
                <tr key={b.id}>
                  <td>
                    {shortDate(`${b.date}T12:00:00Z`)} {b.date.slice(0, 4)}
                  </td>
                  <td>{number(b.weight, 1)} kg</td>
                  <td>
                    <div className="actions">
                      <Button
                        variant="ghost"
                        aria-label={`Modifier la mesure du ${b.date}`}
                        onClick={() => {
                          setDate(b.date);
                          setWeight(String(b.weight));
                          setSuccess('');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        <Pencil size={15} />
                      </Button>
                      <Button
                        variant="ghost"
                        busy={busy}
                        aria-label={`Supprimer la mesure du ${b.date}`}
                        onClick={async () => {
                          if (!confirm('Supprimer cette mesure ?')) return;
                          setBusy(true);
                          try {
                            await api('/api/bodyweight', {
                              method: 'DELETE',
                              body: JSON.stringify({ id: b.id }),
                            });
                            setOlder(older.filter((x) => x.id !== b.id));
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
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {more && (
            <Button
              variant="secondary"
              busy={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const rows = await api<Bodyweight[]>(`/api/bodyweight?offset=${all.length}`);
                  setOlder([...older, ...rows]);
                  setMore(rows.length === 200);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Mesures précédentes
            </Button>
          )}
        </section>
      )}
    </>
  );
}
