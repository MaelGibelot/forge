'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Plus, Dumbbell, Layers, Weight, Trophy, CalendarDays } from 'lucide-react';
import { useData, allWorkouts } from './store';
import { Button, PageTitle, Empty, ErrorBox, api } from './ui';
import { type Workout, type ProgramDay, startWorkout } from '@/lib/domain';
import { workoutVolume, records, number, shortDate, eligible } from '@/lib/metrics';
export function useStartWorkout() {
  const { data, setWorkout } = useData();
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  return {
    busy,
    error,
    start: async (day?: ProgramDay) => {
      setBusy(true);
      setError(null);
      try {
        const existing = data.workouts.find((w) => w.status === 'active');
        if (existing) {
          router.push(`/seances/${existing.id}`);
          return;
        }
        const w = startWorkout(day, data.workouts);
        const r = await api<{ revision: number }>('/api/workouts', {
          method: 'POST',
          body: JSON.stringify(w),
        });
        w.revision = r.revision;
        setWorkout(w);
        router.push(`/seances/${w.id}`);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
  };
}
export function SessionRow({ workout: w }: { workout: Workout }) {
  const sets = w.exercises.flatMap((e) => e.sets).filter((s) => eligible(s));
  return (
    <Link className="session-row" href={`/seances/${w.id}`}>
      <div className="date-tile">{shortDate(w.started_at)}</div>
      <div className="session-info">
        <strong>{w.name}</strong>
        <p>
          {w.exercises.length} exercices · {sets.length} séries{' '}
          <span className="orange">
            {w.status === 'draft' ? '· Brouillon' : w.status === 'active' ? '· En cours' : ''}
          </span>
        </p>
      </div>
      <div className="session-volume">
        {number(workoutVolume(w))} <small>kg de volume externe</small>
      </div>
      <ArrowUpRight size={16} className="muted" />
    </Link>
  );
}
export function Dashboard() {
  const { data } = useData();
  const launch = useStartWorkout();
  const [workouts, setWorkouts] = useState<Workout[] | null>(null),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    allWorkouts(new Date(Date.now() - 30 * 864e5).toISOString())
      .then(setWorkouts)
      .catch((e) => setError(e.message));
  }, [data.workouts]);
  const completed = workouts?.filter((w) => w.status === 'completed') ?? [];
  const volume = completed.reduce((v, w) => v + workoutVolume(w), 0);
  const sets = completed
    .flatMap((w) => w.exercises.flatMap((e) => e.sets))
    .filter((s) => eligible(s)).length;
  const prs = records(completed);
  const active = data.programs.find((p) => p.active) ?? data.programs[0];
  const resume = data.workouts.find((w) => w.status !== 'completed');
  return (
    <>
      <PageTitle
        eyebrow="VOTRE PROGRESSION COMMENCE ICI"
        title={`Bonjour, ${data.preferences.display_name}`}
        description={new Intl.DateTimeFormat('fr-FR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          timeZone: 'Europe/Paris',
        }).format(new Date())}
        actions={
          <Button busy={launch.busy} onClick={() => launch.start()}>
            <Plus size={17} />
            Séance libre
          </Button>
        }
      />
      <ErrorBox message={launch.error ?? error} />
      <section className="hero-card">
        <div>
          <div className="eyebrow">
            {resume ? 'VOTRE SÉANCE VOUS ATTEND' : 'LE PROCHAIN PAS VOUS APPARTIENT'}
          </div>
          <h2>{resume ? 'Reprenez là où vous en étiez.' : 'La régularité fait la différence.'}</h2>
          <p>
            {resume
              ? `${resume.name} · Retrouvez vos séries enregistrées.`
              : 'Pas besoin de battre un record à chaque séance. Continuez à construire votre progression.'}
          </p>
          {resume ? (
            <Link className="btn" href={`/seances/${resume.id}`}>
              Reprendre ma séance <ArrowUpRight size={16} />
            </Link>
          ) : active?.days[0] ? (
            <Button busy={launch.busy} onClick={() => launch.start(active.days[0])}>
              Démarrer {active.days[0].name}
              <ArrowUpRight size={16} />
            </Button>
          ) : (
            <Link href="/programmes/nouveau" className="btn">
              Créer mon premier programme <ArrowUpRight size={16} />
            </Link>
          )}
        </div>
        <svg className="hero-art" viewBox="0 0 260 300" aria-hidden="true">
          <g fill="none" stroke="#bed19d" strokeWidth="1">
            <circle cx="130" cy="150" r="118" opacity=".3" />
            <circle cx="130" cy="150" r="91" opacity=".3" />
            <circle cx="130" cy="150" r="64" opacity=".3" />
            <path d="M20 210L73 178 109 190 146 130 184 144 235 68" strokeWidth="2.5" />
            <path d="M213 72L235 68 234 92" strokeWidth="2.5" />
          </g>
          <circle cx="146" cy="130" r="5" fill="#bed19d" />
          <text x="115" y="275" fill="#a5bc99" fontSize="8" letterSpacing="3">
            KEEP BUILDING
          </text>
        </svg>
      </section>
      <div className="section-label">
        <div className="eyebrow" style={{ margin: 0 }}>
          LES 30 DERNIERS JOURS
        </div>
        <Link className="text-link" href="/statistiques">
          Voir mes statistiques
          <ArrowUpRight size={14} />
        </Link>
      </div>
      <div className="metrics">
        {[
          [Dumbbell, 'Séances', completed.length, 'entraînements terminés'],
          [Layers, 'Séries de travail', sets, 'échauffements exclus'],
          [Weight, 'Volume soulevé', volume, 'charges externes uniquement'],
          [Trophy, 'Exercices avec records', prs.length, 'sur cette période'],
        ].map(([Icon, label, value, foot], i) => {
          const I = Icon as typeof Dumbbell;
          return (
            <div className="card metric" key={i}>
              <div className="metric-top">
                <span>{String(label)}</span>
                <span className="metric-icon">
                  <I size={17} />
                </span>
              </div>
              <div className="metric-value">
                {workouts ? number(value as number) : '—'} {i === 2 && <small>kg</small>}
              </div>
              <div className="metric-foot">{String(foot)}</div>
            </div>
          );
        })}
      </div>
      <div className="dashboard-grid">
        <section className="card">
          <div className="card-header">
            <h2>Vos dernières séances</h2>
            <Link href="/historique" className="text-link">
              Tout voir
              <ArrowUpRight size={14} />
            </Link>
          </div>
          {data.workouts.length ? (
            data.workouts.slice(0, 4).map((w) => <SessionRow key={w.id} workout={w} />)
          ) : (
            <Empty
              icon={<Dumbbell />}
              title="Le début de votre histoire"
              description="Votre première séance apparaîtra ici. Choisissez un programme ou commencez une séance libre."
              action={
                <Button variant="secondary" busy={launch.busy} onClick={() => launch.start()}>
                  Commencer une séance
                </Button>
              }
            />
          )}
        </section>
        <section className="card">
          <div className="card-header">
            <h2>Votre programme</h2>
            <Link href="/programmes" className="text-link">
              Gérer
              <ArrowUpRight size={14} />
            </Link>
          </div>
          {active ? (
            <div className="stack">
              <div>
                <span className="badge badge-orange">
                  {active.active ? 'ACTIF' : 'PRÊT À DÉMARRER'}
                </span>
                <h2 style={{ marginTop: 12 }}>{active.name}</h2>
                <p className="muted" style={{ fontSize: 12, marginTop: 7 }}>
                  {active.description || `${active.days.length} séances, à votre rythme.`}
                </p>
              </div>
              {active.days.slice(0, 3).map((d) => (
                <div key={d.id} className="quick-program">
                  <div>
                    <h3>{d.name}</h3>
                    <p>
                      {d.exercises.length} exercices ·{' '}
                      {d.exercises.reduce((n, e) => n + e.target.sets, 0)} séries
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    aria-label={`Démarrer ${d.name}`}
                    busy={launch.busy}
                    onClick={() => launch.start(d)}
                  >
                    <ArrowUpRight size={18} />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              icon={<CalendarDays />}
              title="Un cap pour vos entraînements"
              description="Construisez des séances adaptées à vos objectifs."
              action={
                <Link href="/programmes/nouveau" className="text-link">
                  Créer un programme
                  <Plus size={14} />
                </Link>
              }
            />
          )}
        </section>
      </div>
    </>
  );
}
