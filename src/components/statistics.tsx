'use client';
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ChartNoAxesCombined, Trophy } from 'lucide-react';
import { useData, allWorkouts } from './store';
import { PageTitle, Empty, ErrorBox, NumberField, api } from './ui';
import { MuscleActivity } from './anatomy';
import { type Workout, type WorkoutExercise, newEntry } from '@/lib/domain';
import {
  eligible,
  workoutVolume,
  exerciseVolume,
  estimated1RM,
  records,
  number,
  shortDate,
  recommendation,
  cardioTotals,
  muscleSeries,
  weeklyFrequency,
} from '@/lib/metrics';
const ProgressChart = dynamic(() => import('./charts').then((m) => m.ProgressChart), {
  ssr: false,
  loading: () => <div className="chart-placeholder">Chargement du graphique…</div>,
});
export function Statistics() {
  const { data } = useData();
  const [now] = useState(() => Date.now());
  const [period, setPeriod] = useState(90),
    [exerciseId, setExerciseId] = useState(data.exercises[0]?.id ?? ''),
    [selectedMetric, setMetric] = useState('weight'),
    [warmup, setWarmup] = useState(false),
    [atWeight, setAtWeight] = useState<number | null>(20),
    [workouts, setWorkouts] = useState<Workout[] | null>(null),
    [firstCompletedAt, setFirstCompletedAt] = useState<string | null>(null),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    const since = period ? new Date(now - period * 864e5).toISOString() : undefined;
    Promise.all([
      allWorkouts(since),
      api<{ started_at: string | null }>(
        `/api/workouts/first-completed?until=${encodeURIComponent(new Date(now).toISOString())}`,
      ),
    ])
      .then(([w, first]) => {
        if (live) {
          setWorkouts(w);
          setFirstCompletedAt(first.started_at);
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [period, data.workouts, now]);
  const completed = useMemo(
    () =>
      workouts?.filter((w) => w.status === 'completed' && Date.parse(w.started_at) <= now) ?? [],
    [workouts, now],
  );
  const frequency = weeklyFrequency(completed, period, firstCompletedAt, now);
  const exercise = data.exercises.find((e) => e.id === exerciseId);
  const isCardio = exercise?.load_kind === 'cardio';
  const metric = isCardio
    ? ['duration', 'distance'].includes(selectedMetric)
      ? selectedMetric
      : 'duration'
    : ['duration', 'distance'].includes(selectedMetric)
      ? 'weight'
      : selectedMetric;
  const rows = completed.toReversed().flatMap((w) => {
    const es = w.exercises.filter((e) => e.exercise_id === exerciseId);
    if (!es.length) return [];
    const e = es[0];
    const sets = es.flatMap((e) => e.sets).filter((s) => eligible(s, warmup));
    let value: number | null = null;
    if (e.load_kind === 'cardio' && ['duration', 'distance'].includes(metric)) {
      const intervals = es
        .flatMap((x) => x.sets)
        .filter(
          (s) => s.completed && (s.duration_seconds ?? 0) > 0 && (warmup || s.type !== 'warmup'),
        );
      value =
        metric === 'duration'
          ? intervals.reduce((n, s) => n + (s.duration_seconds ?? 0), 0) / 60
          : intervals.some((s) => s.distance_km != null)
            ? intervals.reduce((n, s) => n + (s.distance_km ?? 0), 0)
            : null;
      if (!intervals.length) value = null;
    }
    if (metric === 'weight' && e.load_kind === 'external') {
      const weights = sets.flatMap((s) => (s.weight === null ? [] : [s.weight]));
      value = weights.length ? Math.max(...weights) : null;
    }
    if (metric === 'volume' && e.load_kind === 'external')
      value = es.reduce((a, e) => a + exerciseVolume(e, warmup), 0);
    if (metric === 'sets') value = sets.length;
    if (metric === 'reps') {
      const matched = sets.filter((s) => s.weight === atWeight);
      value = matched.length ? Math.max(...matched.map((s) => s.reps)) : null;
    }
    if (metric === 'e1rm') {
      const rms = sets.map((s) => estimated1RM(s, e)).filter((n): n is number => n !== null);
      value = rms.length ? Math.max(...rms) : null;
    }
    return [{ date: w.started_at, value }];
  });
  const total = completed.reduce((v, w) => v + workoutVolume(w, warmup), 0),
    sets = completed
      .flatMap((w) => w.exercises.flatMap((e) => e.sets))
      .filter((s) => eligible(s, warmup)).length;
  const { direct, secondary } = muscleSeries(completed, data.exercises, warmup);
  const cardio = completed.reduce(
    (sum, w) => {
      const c = cardioTotals(w, warmup);
      return { seconds: sum.seconds + c.seconds, distance: sum.distance + c.distance };
    },
    { seconds: 0, distance: 0 },
  );
  const latest = completed.flatMap((w) => w.exercises).find((e) => e.exercise_id === exerciseId);
  const entry: WorkoutExercise | undefined =
    latest ??
    (exercise
      ? {
          ...newEntry(
            exercise,
            0,
            data.progression.find((s) => s.exercise_id === exerciseId),
          ),
          sets: [],
          technique_ok: false,
        }
      : undefined);
  const suggestion =
    entry && workouts ? recommendation(entry, workouts, data.preferences) : undefined;
  return (
    <>
      <PageTitle
        eyebrow="LES DONNÉES QUI DONNENT LE CAP"
        title="Statistiques"
        description="Regardez votre progression sur la durée, un exercice à la fois."
      />
      <div className="flex between" style={{ marginBottom: 22 }}>
        <div className="period-tabs">
          {[
            [7, '7 jours'],
            [30, '30 jours'],
            [90, '90 jours'],
            [180, '6 mois'],
            [365, '1 an'],
            [0, 'Tout'],
          ].map(([n, label]) => (
            <button
              key={n}
              className={period === n ? 'active' : ''}
              aria-pressed={period === n}
              onClick={() => {
                if (period === Number(n)) return;
                setPeriod(Number(n));
                setWorkouts(null);
                setError(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="check-label">
          <input type="checkbox" checked={warmup} onChange={(e) => setWarmup(e.target.checked)} />
          Inclure les échauffements
        </label>
      </div>
      <ErrorBox message={error} />
      <div className="metrics">
        {[
          ['Séances terminées', completed.length, 'sur la période'],
          ['Séries de travail', sets, warmup ? 'échauffements inclus' : 'échauffements exclus'],
          ['Volume externe', total, 'kg cumulés'],
          [
            'Moyenne hebdomadaire',
            frequency.rate,
            `séances / semaine · sur ${number(frequency.days, 1)} jours de suivi`,
          ],
          ['Durée cardio', cardio.seconds / 60, 'minutes sur la période'],
          ['Distance cardio', cardio.distance, 'km renseignés'],
        ].map(([label, v, foot], i) => (
          <div className="card metric" key={i}>
            <div className="metric-top">{label}</div>
            <div className="metric-value">{workouts ? number(Number(v), i >= 3 ? 2 : 0) : '—'}</div>
            <div className="metric-foot">{foot}</div>
          </div>
        ))}
      </div>
      {workouts ? (
        <MuscleActivity direct={direct} secondary={secondary} />
      ) : (
        <p role="status" className="muted" style={{ marginBottom: 22 }}>
          Chargement des zones travaillées…
        </p>
      )}
      <section className="card">
        <div className="card-header">
          <h2>Progression par exercice</h2>
          <ChartNoAxesCombined size={19} className="muted" />
        </div>
        <div className="stat-controls">
          <select
            aria-label="Exercice analysé"
            value={exerciseId}
            onChange={(e) => setExerciseId(e.target.value)}
          >
            {data.exercises.map((e) => (
              <option value={e.id} key={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Indicateur"
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
          >
            {isCardio ? (
              <>
                <option value="duration">Durée cardio</option>
                <option value="distance">Distance cardio</option>
              </>
            ) : (
              <>
                <option value="weight">Charge maximale</option>
                <option value="reps">Répétitions à charge donnée</option>
                <option value="volume">Volume de travail</option>
                <option value="e1rm">1RM estimé</option>
                <option value="sets">Nombre de séries</option>
              </>
            )}
          </select>
          {metric === 'reps' && (
            <div style={{ width: 100 }}>
              <NumberField
                label="Charge comparée (kg)"
                value={atWeight}
                onChange={setAtWeight}
                nullable
              />
            </div>
          )}
        </div>
        {rows.some((r) => r.value !== null) ? (
          <ProgressChart
            rows={rows}
            unit={
              metric === 'duration'
                ? 'min'
                : metric === 'distance'
                  ? 'km'
                  : metric === 'sets'
                    ? 'séries'
                    : metric === 'reps'
                      ? 'rép.'
                      : 'kg'
            }
          />
        ) : (
          <Empty
            icon={<ChartNoAxesCombined />}
            title={workouts ? 'Votre courbe se construit avec vous' : 'Chargement de l’historique…'}
            description="Enregistrez des séances avec cet exercice pour voir apparaître ses données comparables."
          />
        )}
        <p className="muted" style={{ fontSize: 10, marginTop: 12 }}>
          {isCardio
            ? 'Durée réellement effectuée et distance renseignée sur cet appareil. Les intervalles cardio ne comptent pas dans les séries musculaires, le volume externe ou les records de charge.'
            : metric === 'e1rm'
              ? 'Estimation Epley : charge × (1 + répétitions / 30). Séries normales de 1 à 10 répétitions, exercices compatibles uniquement. Une répétition utilise la charge réelle.'
              : 'Les charges externes, le poids du corps et les séries assistées sont traités séparément. Les haltères sont consignés par haltère, sans doublement automatique.'}
        </p>
        {suggestion && (
          <div className="suggestion" style={{ marginTop: 20, marginBottom: 0 }}>
            <ChartNoAxesCombined size={17} />
            <div>
              <strong>{suggestion.title}</strong>
              <p>{suggestion.reason} Analyse limitée à la période affichée.</p>
            </div>
          </div>
        )}
        <details className="notes-details">
          <summary>Consulter les valeurs du graphique</summary>
          <table className="history-table">
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{shortDate(r.date)}</td>
                  <td>{r.value === null ? 'Non applicable' : number(r.value, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>
      <div className="grid-2" style={{ marginTop: 22 }}>
        <section className="card">
          <h2>Séries directes par groupe</h2>
          <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>
            Chaque série compte pour son muscle principal.
          </p>
          {direct.some((m) => m.count) ? (
            direct.map((m) => (
              <div className="muscle-row" key={m.name}>
                <span>{m.name}</span>
                <div className="muscle-bar">
                  <div
                    style={{
                      width: `${(m.count / Math.max(1, ...direct.map((x) => x.count))) * 100}%`,
                    }}
                  />
                </div>
                <strong>{m.count}</strong>
              </div>
            ))
          ) : (
            <Empty
              title="Un équilibre à construire"
              description="La répartition de vos séances s’affichera ici."
            />
          )}
        </section>
        <section className="card">
          <h2>Sollicitations secondaires</h2>
          <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>
            Comptées séparément, sans équivalence avec des séries directes.
          </p>
          {secondary.map((m) => (
            <div className="muscle-row" key={m.name}>
              <span>{m.name}</span>
              <div className="muscle-bar">
                <div
                  style={{
                    width: `${(m.count / Math.max(1, ...secondary.map((x) => x.count))) * 100}%`,
                    background: 'var(--green)',
                  }}
                />
              </div>
              <strong>{m.count}</strong>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
export function Records() {
  const { data } = useData();
  const [workouts, setWorkouts] = useState<Workout[] | null>(null),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    allWorkouts()
      .then(setWorkouts)
      .catch((e) => setError(e.message));
  }, [data.workouts]);
  const prs = records(workouts ?? []);
  return (
    <>
      <PageTitle
        eyebrow="VOS EFFORTS FONT LEUR CHEMIN"
        title="Records personnels"
        description="Recalculés à partir de toutes vos séances terminées, après chaque correction ou suppression."
      />
      <ErrorBox message={error} />
      {!prs.length ? (
        <section className="card">
          <Empty
            icon={<Trophy />}
            title={
              workouts
                ? 'Le premier record est un point de départ'
                : 'Chargement de tous vos records…'
            }
            description="Vos meilleures charges, estimations du 1RM et volumes apparaîtront ici après vos entraînements."
          />
        </section>
      ) : (
        <div className="grid-3">
          {prs.map((r) => (
            <section className="card record-card" key={r.exercise_id}>
              <div className="flex between">
                <span className="trophy">
                  <Trophy size={20} />
                </span>
                <span className="badge">CHARGE MAX.</span>
              </div>
              <div className="record-value">
                {number(r.max_weight, 2)} <small>kg</small>
              </div>
              <h3>
                <Link href={`/exercices/${r.exercise_id}`}>{r.name} ↗</Link>
              </h3>
              <small>{shortDate(r.date)}</small>
              <hr />
              <div className="stack gap-sm">
                <div className="flex between">
                  <small>1RM estimé</small>
                  <strong>{r.e1rm === null ? '—' : `${number(r.e1rm, 1)} kg`}</strong>
                </div>
                <div className="flex between">
                  <small>Volume maximal / séance</small>
                  <strong>{number(r.volume)} kg</strong>
                </div>
                <details className="notes-details">
                  <summary>Records par nombre de répétitions</summary>
                  {Object.entries(r.by_reps).map(([reps, weight]) => (
                    <p key={reps}>
                      {reps} répétitions : {number(weight, 2)} kg
                    </p>
                  ))}
                </details>
                <Link className="text-link" href={`/seances/${r.workout_id}`}>
                  Voir la séance du record ↗
                </Link>
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
