'use client';
import { useState } from 'react';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import { Moon, Sun, Monitor, Save, LockKeyhole, Trash2 } from 'lucide-react';
import { useData } from './store';
import { Button, PageTitle, Field, NumberField, ErrorBox, api } from './ui';
import { goalLabels } from '@/lib/training-knowledge';
import { preferencesSchema, type Preferences } from '@/lib/domain';
export function Settings() {
  const { data, reload } = useData();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [p, setP] = useState(data.preferences),
    [error, setError] = useState<string | null>(null),
    [success, setSuccess] = useState(''),
    [busy, setBusy] = useState(false),
    [deleting, setDeleting] = useState(false);
  const coaching = preferencesSchema.shape.coaching.parse(p.coaching ?? {})!;
  const coach = (change: Partial<NonNullable<Preferences['coaching']>>) =>
    setP({ ...p, coaching: { ...coaching, ...change } });
  async function run(job: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError(null);
    setSuccess('');
    try {
      await job();
      setSuccess(message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="UN ESPACE À VOTRE IMAGE"
        title="Paramètres"
        description="Votre compte, vos préférences et votre façon de progresser."
      />
      <ErrorBox message={error} />
      {success && (
        <div className="success-box" role="status" style={{ marginBottom: 20 }}>
          {success}
        </div>
      )}
      <div className="settings-grid">
        <div className="stack">
          <section className="card stack">
            <h2>Votre profil</h2>
            <Field label="Pseudo">
              <input
                value={p.display_name}
                minLength={1}
                maxLength={60}
                onChange={(e) => setP({ ...p, display_name: e.target.value })}
              />
            </Field>
            <h3>Recommandations de progression</h3>
            <div className="grid-2">
              <Field label="Objectif principal">
                <select
                  aria-label="Objectif principal"
                  value={coaching.goal ?? ''}
                  onChange={(e) =>
                    coach({ goal: (e.target.value as typeof coaching.goal) || null })
                  }
                >
                  <option value="">Non renseigné</option>
                  {Object.entries(goalLabels).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Niveau de pratique">
                <select
                  aria-label="Niveau de pratique"
                  value={coaching.level ?? ''}
                  onChange={(e) =>
                    coach({ level: (e.target.value as typeof coaching.level) || null })
                  }
                >
                  <option value="">Non renseigné</option>
                  <option value="beginner">Débutant</option>
                  <option value="intermediate">Intermédiaire</option>
                  <option value="advanced">Avancé</option>
                </select>
              </Field>
              <Field label="Séances souhaitées par semaine">
                <NumberField
                  label="Séances souhaitées par semaine"
                  value={coaching.sessions_per_week}
                  min={1}
                  max={14}
                  nullable
                  onChange={(n) => coach({ sessions_per_week: n })}
                />
              </Field>
              <Field label="Durée habituelle (min)">
                <NumberField
                  label="Durée habituelle"
                  value={coaching.session_minutes}
                  min={10}
                  max={300}
                  nullable
                  onChange={(n) => coach({ session_minutes: n })}
                />
              </Field>
            </div>
            <Field label="Préférence de volume">
              <select
                aria-label="Préférence de volume"
                value={coaching.volume_preference}
                onChange={(e) =>
                  coach({ volume_preference: e.target.value as typeof coaching.volume_preference })
                }
              >
                <option value="minimal">Volume minimal à consolider</option>
                <option value="balanced">Équilibré</option>
                <option value="more">Davantage de volume si récupéré</option>
              </select>
            </Field>
            <details>
              <summary>Préférences et contraintes personnelles (facultatif)</summary>
              <Field label="Préférences, matériel et récupération">
                <textarea
                  maxLength={1000}
                  value={coaching.preferences}
                  onChange={(e) => coach({ preferences: e.target.value })}
                />
              </Field>
              <Field label="Mobilité, inconforts et difficultés techniques">
                <textarea
                  maxLength={1000}
                  value={coaching.limitations}
                  onChange={(e) => coach({ limitations: e.target.value })}
                />
              </Field>
              <p className="muted">
                Ces notes vous servent de repère. Signalez aussi l’inconfort sur l’exercice concerné
                pour suspendre sa proposition de charge.
              </p>
            </details>
            <label className="check-label">
              <input
                type="checkbox"
                checked={p.recommendations}
                onChange={(e) => setP({ ...p, recommendations: e.target.checked })}
              />
              Activer les suggestions explicables
            </label>
            <Field
              label="Nombre de séances analysées"
              hint="Le moteur compare uniquement les séances avec le même exercice et des objectifs similaires."
            >
              <NumberField
                label="Nombre de séances historiques"
                value={p.history_count}
                min={2}
                max={20}
                step={1}
                onChange={(n) => setP({ ...p, history_count: n ?? 3 })}
              />
            </Field>
            <div className="grid-2">
              <Field label="RPE maximal accepté" hint="Vide : aucun seuil RPE.">
                <NumberField
                  label="Seuil RPE"
                  value={p.max_rpe}
                  min={1}
                  max={10}
                  onChange={(n) => setP({ ...p, max_rpe: n })}
                  nullable
                />
              </Field>
              <Field label="RIR minimal accepté" hint="Vide : aucun seuil RIR.">
                <NumberField
                  label="Seuil RIR"
                  value={p.min_rir}
                  min={0}
                  max={10}
                  onChange={(n) => setP({ ...p, min_rir: n })}
                  nullable
                />
              </Field>
            </div>
            <p className="muted" style={{ fontSize: 11 }}>
              Les incréments et fourchettes se règlent sur la fiche de chaque exercice et dans vos
              programmes. Une recommandation ne modifie jamais vos données sans action de votre
              part.
            </p>
            <Button
              busy={busy}
              onClick={() =>
                run(async () => {
                  await api('/api/preferences', { method: 'PUT', body: JSON.stringify(p) });
                  await reload();
                  router.refresh();
                }, 'Préférences enregistrées.')
              }
            >
              <Save size={15} />
              Enregistrer mes préférences
            </Button>
          </section>
          <section className="card stack">
            <h2>Apparence</h2>
            <div className="theme-buttons">
              {[
                [Sun, 'light', 'Clair'],
                [Moon, 'dark', 'Sombre'],
                [Monitor, 'system', 'Système'],
              ].map(([Icon, value, label]) => {
                const I = Icon as typeof Sun;
                return (
                  <button
                    key={String(value)}
                    className={theme === value ? 'active' : ''}
                    onClick={() => setTheme(String(value))}
                    aria-pressed={theme === value}
                  >
                    <I size={24} />
                    {String(label)}
                  </button>
                );
              })}
            </div>
            <p className="muted" style={{ fontSize: 11 }}>
              Votre choix est mémorisé sur ce navigateur.
            </p>
          </section>
        </div>
        <div className="stack">
          <section className="card stack">
            <div className="flex">
              <LockKeyhole size={19} className="orange" />
              <h2>Sécurité du compte</h2>
            </div>
            <p className="muted" style={{ fontSize: 12 }}>
              Changez votre mot de passe depuis votre espace. Pour réinitialiser un accès perdu,
              contactez le propriétaire.
            </p>
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const f = new FormData(form);
                if (f.get('new_password') !== f.get('confirm')) {
                  setError('Les nouveaux mots de passe ne correspondent pas.');
                  return;
                }
                run(async () => {
                  await api('/api/account', {
                    method: 'PATCH',
                    body: JSON.stringify({
                      password: f.get('password'),
                      new_password: f.get('new_password'),
                    }),
                  });
                  form.reset();
                }, 'Mot de passe modifié.');
              }}
            >
              <Field label="Mot de passe actuel">
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  required
                  maxLength={128}
                />
              </Field>
              <Field label="Nouveau mot de passe" hint="12 caractères minimum.">
                <input
                  type="password"
                  name="new_password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={128}
                />
              </Field>
              <Field label="Confirmer le nouveau mot de passe">
                <input
                  type="password"
                  name="confirm"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={128}
                />
              </Field>
              <Button variant="secondary" busy={busy}>
                Modifier mon mot de passe
              </Button>
            </form>
          </section>
          <section className="card stack">
            <div className="flex">
              <Trash2 size={19} className="muted" />
              <h2>Supprimer mon compte</h2>
            </div>
            <p className="muted" style={{ fontSize: 12 }}>
              Votre compte, vos programmes, séances et mesures seront supprimés définitivement.
            </p>
            {!deleting ? (
              <Button variant="danger" onClick={() => setDeleting(true)}>
                Supprimer mon compte…
              </Button>
            ) : (
              <form
                className="stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  if (!confirm('Supprimer définitivement ce compte et toutes ses données ?'))
                    return;
                  run(async () => {
                    await api('/api/account', {
                      method: 'DELETE',
                      body: JSON.stringify({
                        password: f.get('password'),
                        confirmation: f.get('confirmation'),
                      }),
                    });
                    for (const key of Object.keys(localStorage))
                      if (key.startsWith(`forge:recovery:${data.user_id}:`))
                        localStorage.removeItem(key);
                    window.location.href = '/connexion';
                  }, 'Compte supprimé.');
                }}
              >
                <Field label="Mot de passe actuel">
                  <input type="password" name="password" required autoComplete="current-password" />
                </Field>
                <Field label="Saisissez SUPPRIMER">
                  <input name="confirmation" required pattern="SUPPRIMER" />
                </Field>
                <Button variant="danger" busy={busy}>
                  Confirmer la suppression définitive
                </Button>
                <Button variant="ghost" type="button" onClick={() => setDeleting(false)}>
                  Annuler
                </Button>
              </form>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
