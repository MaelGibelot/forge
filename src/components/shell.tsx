'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  Dumbbell,
  BookOpen,
  ClipboardList,
  ChartNoAxesCombined,
  Trophy,
  Scale,
  Settings,
  LogOut,
  ArrowUpRight,
  Ellipsis,
} from 'lucide-react';
import { api, Modal, Button } from './ui';
const links = [
  ['/tableau-de-bord', 'Vue d’ensemble', LayoutDashboard],
  ['/programmes', 'Mes programmes', Dumbbell],
  ['/historique', 'Séances', ClipboardList],
  ['/exercices', 'Exercices', BookOpen],
  ['/statistiques', 'Statistiques', ChartNoAxesCombined],
  ['/records', 'Records', Trophy],
  ['/poids', 'Poids corporel', Scale],
] as const;
export function Shell({ children, name }: { children: React.ReactNode; name: string }) {
  const path = usePathname();
  const active = (href: string) =>
    path.startsWith(href) || (href === '/historique' && path.startsWith('/seances/'));
  const [error, setError] = useState('');
  const [menu, setMenu] = useState(false);
  async function logout() {
    try {
      await api('/api/auth/logout', { method: 'POST' });
      window.location.href = '/connexion';
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Aller au contenu
      </a>
      <aside className="sidebar">
        <Link href="/tableau-de-bord" className="brand">
          F<span className="brand-cut">/</span> FORGE<span className="brand-dot">®</span>
        </Link>
        <div className="nav-caption">VOTRE ESPACE</div>
        <nav aria-label="Navigation principale">
          {links.map(([href, label, Icon]) => (
            <Link
              href={href}
              key={href}
              className={active(href) ? 'active' : ''}
              aria-current={active(href) ? 'page' : undefined}
            >
              <Icon size={20} />
              <span>{label}</span>
              {path.startsWith(href) && <span className="nav-active-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-motto">
            <div className="eyebrow">LE BON OBJECTIF</div>
            <p>
              Un peu plus fort
              <br />
              qu’hier<span className="orange">.</span>
            </p>
            <ArrowUpRight className="orange" />
          </div>
          <Link
            href="/parametres"
            className={`settings-link ${path === '/parametres' ? 'active' : ''}`}
          >
            <Settings size={19} />
            Paramètres
          </Link>
          <div className="profile">
            <span className="avatar">{name.slice(0, 2).toUpperCase()}</span>
            <div>
              <strong>{name}</strong>
              <small>Espace personnel</small>
            </div>
            <button aria-label="Se déconnecter" onClick={logout}>
              <LogOut size={18} />
            </button>
          </div>
          {error && <p role="alert">{error}</p>}
        </div>
      </aside>
      <div className="app-content">
        <div className="topbar">
          <span>
            <span className="status-dot" /> CHAQUE SÉRIE COMPTE
          </span>
          <Link href="/parametres">
            <span className="avatar small">{name.slice(0, 2).toUpperCase()}</span>
            <span>{name}</span>
          </Link>
        </div>
        <main id="main">{children}</main>
        <footer className="app-footer">
          FORGE <span>Votre progression, série après série.</span>
          <span>FAIT POUR DURER.</span>
        </footer>
      </div>
      <nav className="mobile-nav" aria-label="Navigation mobile">
        {[links[2], links[3], links[5], links[4]].map(([href, label, Icon]) => (
          <Link
            key={href}
            href={href}
            className={active(href) ? 'active' : ''}
            aria-current={active(href) ? 'page' : undefined}
          >
            <Icon size={22} />
            <span>{label}</span>
          </Link>
        ))}
        <button
          aria-label="Plus de rubriques"
          aria-expanded={menu}
          className={
            ['/tableau-de-bord', '/programmes', '/poids', '/parametres'].some((p) =>
              path.startsWith(p),
            )
              ? 'active'
              : ''
          }
          onClick={() => setMenu(true)}
        >
          <Ellipsis size={22} />
          <span>Plus</span>
        </button>
      </nav>
      {menu && (
        <Modal title="Votre espace" onClose={() => setMenu(false)}>
          <nav className="more-nav" aria-label="Toutes les rubriques">
            {links.map(([href, label, Icon]) => (
              <Link href={href} key={href} onClick={() => setMenu(false)}>
                <Icon size={20} />
                {label}
              </Link>
            ))}
            <Link href="/parametres" onClick={() => setMenu(false)}>
              <Settings size={20} />
              Paramètres
            </Link>
            <Button variant="ghost" onClick={logout}>
              <LogOut size={18} />
              Se déconnecter
            </Button>
            {error && <p role="alert">{error}</p>}
          </nav>
        </Modal>
      )}
    </div>
  );
}
