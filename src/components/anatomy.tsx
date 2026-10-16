import type { Muscle } from '@/lib/domain';
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
];
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
    <svg
      viewBox="0 0 124 255"
      role="img"
      aria-label={`${back ? 'Vue arrière' : 'Vue avant'}, muscle principal : ${primary}`}
    >
      <g fill="var(--border)">
        <ellipse cx="62" cy="19" rx="12" ry="15" />
        <path d="M54 31 L54 38 37 40 Q25 40 22 53 L14 88 8 116 14 120 23 93 31 72 34 104 29 135 31 176 31 211 32 238 29 248 46 248 48 238 50 210 55 175 62 144 69 175 74 210 76 238 78 248 95 248 92 238 93 211 93 176 95 135 90 104 93 72 101 93 110 120 116 116 110 88 102 53 Q99 40 87 40 L70 38 70 31Z" />
      </g>
      {shapes.map(({ muscle, front, back: rear }) => (
        <path
          key={muscle}
          d={(back ? rear : front) ?? ''}
          fill={
            muscle === primary
              ? 'var(--accent)'
              : secondary.includes(muscle)
                ? '#a3b992'
                : 'var(--panel2)'
          }
          stroke="var(--bg)"
          strokeWidth="1.2"
        />
      ))}
      <path d="M62 45V109" stroke="var(--bg)" strokeWidth="1.3" />
    </svg>
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
