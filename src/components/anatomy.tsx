'use client';
import { useState } from 'react';
import { muscles, type Muscle } from '@/lib/domain';
const shapes: { muscle: Muscle; front?: string; back?: string }[] = [
  {
    muscle: 'Pectoraux',
    front: 'M37 46 Q49 38 59 48 L58 64 Q46 69 37 59Z M63 48 Q74 38 85 46 L85 59 Q74 69 64 64Z',
  },
  {
    muscle: 'Épaules',
    front: 'M26 45 Q31 38 39 43 L36 61 24 65Z M84 43 Q94 38 99 46 L101 65 88 61Z',
    back: 'M26 45 Q31 38 39 43 L36 61 24 65Z M84 43 Q94 38 99 46 L101 65 88 61Z',
  },
  { muscle: 'Biceps', front: 'M24 66 L35 63 30 91 19 91Z M88 63 L100 66 105 91 94 91Z' },
  { muscle: 'Triceps', back: 'M24 64 L35 62 30 92 18 92Z M89 62 L100 64 106 92 94 92Z' },
  {
    muscle: 'Dos',
    back: 'M40 44 L59 38 62 48 65 38 83 44 86 68 76 98 65 103 62 77 59 103 47 98 37 68Z',
  },
  {
    muscle: 'Abdominaux',
    front: 'M48 70 L59 70 59 108 50 112 44 98Z M64 70 L76 70 80 98 71 112 64 108Z',
  },
  {
    muscle: 'Fessiers',
    back: 'M40 107 Q52 103 60 109 L59 133 Q43 142 36 128Z M64 109 Q76 103 85 107 L88 128 Q80 142 65 133Z',
  },
  {
    muscle: 'Quadriceps',
    front:
      'M38 119 Q48 113 58 119 L56 158 45 174 34 160Z M66 119 Q77 113 87 119 L90 160 79 174 68 158Z',
  },
  {
    muscle: 'Ischio-jambiers',
    back: 'M37 137 Q47 143 58 136 L55 173 44 179 34 163Z M65 136 Q76 143 87 137 L90 163 79 179 68 173Z',
  },
  {
    muscle: 'Mollets',
    front: 'M36 185 L48 183 50 211 43 230 36 218Z M76 183 L88 185 88 218 81 230 74 211Z',
    back: 'M34 182 Q44 177 54 183 L49 217 43 230 35 215Z M70 183 Q80 177 90 182 L89 215 81 230 75 217Z',
  },
  {
    muscle: 'Adducteurs',
    front: 'M53 125 L59 122 59 151 53 166 49 152Z M65 122 L71 125 75 152 71 166 65 151Z',
  },
];
function BodyDiagram({
  back,
  label,
  color,
  description,
}: {
  back: boolean;
  label: string;
  color: (muscle: Muscle) => string;
  description?: (muscle: Muscle) => string;
}) {
  return (
    <svg
      viewBox="0 0 124 255"
      role="img"
      aria-label={`${back ? 'Vue arrière' : 'Vue avant'}, ${label}`}
    >
      <g fill="var(--border)">
        <ellipse cx="62" cy="19" rx="12" ry="15" />
        <path d="M54 31 L54 38 37 40 Q25 40 22 53 L14 88 8 116 14 120 23 93 31 72 34 104 29 135 31 176 31 211 32 238 29 248 46 248 48 238 50 210 55 175 62 144 69 175 74 210 76 238 78 248 95 248 92 238 93 211 93 176 95 135 90 104 93 72 101 93 110 120 116 116 110 88 102 53 Q99 40 87 40 L70 38 70 31Z" />
      </g>
      {shapes.map(({ muscle, front, back: rear }) => (
        <path
          key={muscle}
          d={(back ? rear : front) ?? ''}
          fill={color(muscle)}
          stroke="var(--bg)"
          strokeWidth="1.2"
        >
          <title>{description?.(muscle) ?? muscle}</title>
        </path>
      ))}
      <path d="M62 45V109" stroke="var(--bg)" strokeWidth="1.3" />
    </svg>
  );
}
export function Anatomy({
  primary,
  secondary = [],
  compact = false,
}: {
  primary: Muscle;
  secondary?: Muscle[];
  compact?: boolean;
}) {
  const draw = (back: boolean) => (
    <BodyDiagram
      back={back}
      label={`muscle principal : ${primary}`}
      color={(muscle) =>
        muscle === primary
          ? 'var(--accent)'
          : secondary.includes(muscle)
            ? '#a3b992'
            : 'var(--panel2)'
      }
    />
  );
  if (compact)
    return draw(
      primary === 'Dos' ||
        primary === 'Ischio-jambiers' ||
        primary === 'Fessiers' ||
        primary === 'Triceps',
    );
  return (
    <>
      <div className="anatomy-wrap">
        <figure>
          {draw(false)}
          <figcaption>AVANT</figcaption>
        </figure>
        <figure>
          {draw(true)}
          <figcaption>ARRIÈRE</figcaption>
        </figure>
      </div>
      <div className="legend">
        <span>
          <i style={{ background: 'var(--accent)' }} />
          Principal · {primary}
        </span>
        {secondary.length > 0 && (
          <span>
            <i style={{ background: '#a3b992' }} />
            Secondaires · {secondary.join(', ')}
          </span>
        )}
      </div>
      <p className="muted" style={{ fontSize: 10, marginTop: 14 }}>
        Schéma indicatif par groupe musculaire. Il ne mesure pas l’activation.
      </p>
    </>
  );
}

const activityLevels = [
  { label: '0 série', color: 'var(--panel2)' },
  { label: '1 à 5 séries', color: '#94bca4' },
  { label: '6 à 10 séries', color: '#e5b65c' },
  { label: '11 séries et plus', color: '#f18b54' },
];
const workoutLevels = [
  { label: '0 série', color: 'var(--panel2)' },
  { label: '1 à 2 séries', color: '#94bca4' },
  { label: '3 à 5 séries', color: '#e5b65c' },
  { label: '6 séries et plus', color: '#f18b54' },
];
export function MuscleActivity({
  direct,
  secondary,
  scope = 'period',
}: {
  direct: { name: Muscle; count: number }[];
  secondary: { name: Muscle; count: number }[];
  scope?: 'period' | 'workout';
}) {
  const [mode, setMode] = useState<'direct' | 'secondary'>('direct');
  const counts = new Map((mode === 'direct' ? direct : secondary).map((m) => [m.name, m.count]));
  const label = mode === 'direct' ? 'séries directes' : 'sollicitations secondaires';
  const levels = scope === 'workout' ? workoutLevels : activityLevels;
  const color = (muscle: Muscle) => {
    const count = counts.get(muscle) ?? 0;
    const low = scope === 'workout' ? 2 : 5;
    const medium = scope === 'workout' ? 5 : 10;
    return levels[count === 0 ? 0 : count <= low ? 1 : count <= medium ? 2 : 3].color;
  };
  const description = (muscle: Muscle) => `${muscle} : ${counts.get(muscle) ?? 0} ${label}`;
  return (
    <section
      className="card muscle-activity"
      aria-label="Zones musculaires travaillées"
      style={{ marginBottom: 22 }}
    >
      <div className="card-header">
        <h2>Vos zones travaillées</h2>
        <div className="period-tabs" role="group" aria-label="Type de sollicitation">
          <button
            type="button"
            aria-pressed={mode === 'direct'}
            className={mode === 'direct' ? 'active' : ''}
            onClick={() => setMode('direct')}
          >
            Séries directes
          </button>
          <button
            type="button"
            aria-pressed={mode === 'secondary'}
            className={mode === 'secondary' ? 'active' : ''}
            onClick={() => setMode('secondary')}
          >
            Secondaires
          </button>
        </div>
      </div>
      <p className="muted" style={{ fontSize: 12, marginBottom: 22 }}>
        {mode === 'direct'
          ? 'Séries validées pour le muscle principal de chaque exercice.'
          : 'Séries sollicitant ces muscles en complément, comptées séparément des séries directes.'}{' '}
        {scope === 'workout'
          ? 'Les couleurs concernent cette séance et le filtre d’échauffement choisi.'
          : 'Les couleurs suivent la période et le filtre d’échauffement choisis.'}
      </p>
      <div className="anatomy-wrap">
        {[false, true].map((back) => (
          <figure key={String(back)}>
            <BodyDiagram back={back} label={label} color={color} description={description} />
            <figcaption>{back ? 'ARRIÈRE' : 'AVANT'}</figcaption>
          </figure>
        ))}
      </div>
      <div className="legend" aria-label="Code couleur du nombre de séries">
        {levels.map((level) => (
          <span key={level.label}>
            <i style={{ background: level.color, border: '1px solid var(--border)' }} />
            {level.label}
          </span>
        ))}
      </div>
      {!Array.from(counts.values()).some((n) => n > 0) && (
        <p className="muted" style={{ marginTop: 16 }}>
          Aucune série validée de ce type{' '}
          {scope === 'workout' ? 'dans cette séance' : 'sur la période'}.
        </p>
      )}
      <details className="notes-details">
        <summary>Voir les séries par zone</summary>
        <ul>
          {muscles.map((muscle) => (
            <li key={muscle}>{description(muscle)}</li>
          ))}
        </ul>
      </details>
      <p className="muted" style={{ fontSize: 10, marginTop: 14 }}>
        Schéma indicatif des séries enregistrées par groupe musculaire.
      </p>
    </section>
  );
}
