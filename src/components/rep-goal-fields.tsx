'use client';
import { Field, RepetitionSelect } from './ui';
export function RepGoalFields({
  min,
  max,
  onChange,
}: {
  min: number;
  max: number;
  onChange: (min: number, max: number) => void;
}) {
  const fixed = min === max;
  return (
    <>
      <Field label="Type d’objectif">
        <select
          aria-label="Type d’objectif de répétitions"
          value={fixed ? 'fixed' : 'range'}
          onChange={(e) =>
            e.target.value === 'fixed'
              ? onChange(min, min)
              : onChange(Math.min(min, 29), Math.min(30, min + 2))
          }
        >
          <option value="fixed">Nombre fixe</option>
          <option value="range">Plage de répétitions</option>
        </select>
      </Field>
      <Field label={fixed ? 'Répétitions cibles' : 'Répétitions min.'}>
        <RepetitionSelect
          label={fixed ? 'Répétitions cibles' : 'Répétitions minimales'}
          value={min}
          onChange={(n) => onChange(n, fixed ? n : Math.max(n, max))}
        />
      </Field>
      {!fixed && (
        <Field label="Répétitions max.">
          <RepetitionSelect
            label="Répétitions maximales"
            value={max}
            onChange={(n) => onChange(Math.min(n, min), n)}
          />
        </Field>
      )}
    </>
  );
}
