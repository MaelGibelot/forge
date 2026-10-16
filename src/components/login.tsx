'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowUpRight, Dumbbell, ShieldCheck, Activity } from 'lucide-react';
import { Button, ErrorBox, Field, api } from './ui';
export function Login({ configured }: { configured: boolean }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  return (
    <main className="login">
      <section className="login-story">
        <Link href="/" className="brand">
          F<span className="brand-cut">/</span> FORGE<span className="brand-dot">®</span>
        </Link>
        <div className="login-story-content">
          <div className="pill">
            <span className="status-dot" /> VOTRE ESPACE D’ENTRAÎNEMENT
          </div>
          <h1>
            La force se
            <br />
            construit<span className="orange">.</span>
            <br />
            <span className="outline-text">Série après série.</span>
          </h1>
          <p>
            Un programme clair. Chaque effort enregistré.
            <br />
            Votre progression, enfin visible.
          </p>
          <div className="story-grid">
            <div>
              <Dumbbell />
              <strong>Entraînez-vous.</strong>
              <span>Vos séances, à votre rythme.</span>
            </div>
            <div>
              <Activity />
              <strong>Progressez.</strong>
              <span>Des décisions guidées par vos données.</span>
            </div>
          </div>
        </div>
        <footer>
          MOINS D’APPROXIMATION. PLUS DE PROGRESSION.<span>01 / 01</span>
        </footer>
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
      </section>
      <section className="login-form-side">
        <div className="login-form-wrap">
          <div className="eyebrow">BIENVENUE CHEZ FORGE</div>
          <h2>Prêt pour la suite ?</h2>
          <p className="muted">Connectez-vous à votre espace personnel.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              const f = new FormData(e.currentTarget);
              try {
                await api('/api/auth/login', {
                  method: 'POST',
                  body: JSON.stringify({
                    username: f.get('username'),
                    password: f.get('password'),
                  }),
                });
                window.location.href = '/tableau-de-bord';
              } catch (e) {
                setError((e as Error).message);
                setBusy(false);
              }
            }}
          >
            <Field label="Identifiant">
              <input
                name="username"
                autoComplete="username"
                placeholder="Votre identifiant"
                required
                minLength={3}
                maxLength={32}
                autoCapitalize="none"
                spellCheck={false}
              />
            </Field>
            <Field label="Mot de passe">
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Votre mot de passe"
                required
                maxLength={128}
              />
            </Field>
            <ErrorBox message={error} />
            {!configured && (
              <div className="setup-notice">
                <strong>Première mise en route</strong>
                <p>
                  La connexion sera disponible après configuration de Supabase. Le fichier README du
                  projet détaille les étapes.
                </p>
              </div>
            )}
            <Button className="w-full" type="submit" busy={busy} disabled={!configured}>
              Se connecter <ArrowUpRight size={18} />
            </Button>
          </form>
          <p className="login-help">
            Un problème d’accès ? Contactez le propriétaire pour réinitialiser votre mot de passe.
          </p>
          <div className="privacy-note">
            <ShieldCheck size={17} />
            <span>Un espace privé. Vos données vous appartiennent.</span>
          </div>
        </div>
        <div className="login-bottom">
          CONSTRUISEZ VOTRE PROPRE PROGRESSION <span>FORGE © 2026</span>
        </div>
      </section>
    </main>
  );
}
