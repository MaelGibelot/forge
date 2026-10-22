'use client';
import { forwardRef, useEffect, type ReactNode, type ButtonHTMLAttributes } from 'react';
import { X, LoaderCircle, ArrowUpRight } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
export const cn = (...args: Parameters<typeof clsx>) => twMerge(clsx(...args));
export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    busy?: boolean;
  }
>(function Button({ className, variant = 'primary', busy, children, disabled, ...p }, ref) {
  return (
    <button
      ref={ref}
      className={cn('btn', `btn-${variant}`, className)}
      disabled={disabled || busy}
      {...p}
    >
      {busy && <LoaderCircle size={16} className="spin" />}
      {children}
    </button>
  );
});
export function PageTitle({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-title">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>
          {title}
          <span className="orange">.</span>
        </h1>
        {description && <p className="muted">{description}</p>}
      </div>
      <div className="actions">{actions}</div>
    </header>
  );
}
export function Empty({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon ?? <ArrowUpRight />}</div>
      <h3>{title}</h3>
      <p className="muted">{description}</p>
      {action}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  useEffect(() => {
    const prior = document.activeElement as HTMLElement | null;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      prior?.focus();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop">
      <dialog
        open
        ref={(el) => {
          if (el && !el.dataset.focused) {
            el.dataset.focused = 'true';
            el.querySelector<HTMLElement>('input,button,select')?.focus();
          }
        }}
        aria-modal="true"
        aria-label={title}
        className={cn('modal', wide && 'modal-wide')}
        onKeyDown={(e) => {
          if (e.key === 'Tab') {
            const list = e.currentTarget.querySelectorAll<HTMLElement>(
              'button:not(:disabled),input:not(:disabled),select,textarea,a[href]',
            );
            const first = list[0],
              last = list[list.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <header>
          <h2>{title}</h2>
          <Button variant="ghost" aria-label="Fermer" onClick={onClose}>
            <X size={20} />
          </Button>
        </header>
        {children}
      </dialog>
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small className="muted">{hint}</small>}
    </label>
  );
}
export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 2000,
  step = 0.5,
  nullable = false,
}: {
  label: string;
  value: number | null;
  onChange: (n: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  nullable?: boolean;
}) {
  return (
    <input
      aria-label={label}
      type="number"
      inputMode={step === 1 ? 'numeric' : 'decimal'}
      min={min}
      max={max}
      step={step}
      value={value ?? ''}
      onChange={(e) =>
        onChange(e.target.value === '' ? (nullable ? null : 0) : e.target.valueAsNumber)
      }
      placeholder="—"
    />
  );
}
const repetitionOptions = Array.from({ length: 30 }, (_, i) => i + 1);
export function RepetitionSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  const legacy = !repetitionOptions.includes(value);
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {legacy && (
        <option value={value} disabled>
          {value} · ancienne valeur
        </option>
      )}
      {repetitionOptions.map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
  );
}
export function RestInput({
  value,
  onChange,
  label = 'Repos réalisé',
  maxMinutes = 120,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  label?: string;
  maxMinutes?: number;
}) {
  return (
    <div className="rest-input">
      <input
        aria-label={`${label}, minutes`}
        inputMode="numeric"
        type="number"
        min="0"
        max={maxMinutes}
        value={value === null ? '' : Math.floor(value / 60)}
        placeholder="min"
        onChange={(e) =>
          onChange(
            e.target.value === ''
              ? null
              : Math.max(0, Number(e.target.value)) * 60 + ((value ?? 0) % 60),
          )
        }
      />
      <span>:</span>
      <input
        aria-label={`${label}, secondes`}
        inputMode="numeric"
        type="number"
        min="0"
        max="59"
        value={value === null ? '' : value % 60}
        placeholder="sec"
        onChange={(e) =>
          onChange(
            e.target.value === ''
              ? null
              : Math.floor((value ?? 0) / 60) * 60 +
                  Math.min(59, Math.max(0, Number(e.target.value))),
          )
        }
      />
    </div>
  );
}
export async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const r = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    cache: 'no-store',
  });
  const data = await r.json();
  if (!r.ok)
    throw Object.assign(new Error(data.error ?? 'Connexion impossible.'), { status: r.status });
  return data as T;
}
export function ErrorBox({ message }: { message: string | null }) {
  return message ? (
    <div role="alert" className="error-box">
      {message}
    </div>
  ) : null;
}
