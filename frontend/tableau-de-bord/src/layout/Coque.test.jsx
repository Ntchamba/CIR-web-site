// Coque du tableau de bord : tiroir mobile, menu, modules à venir, page 404, déconnexion.
// Plus quelques vérifications statiques : isolement vis-à-vis du site public, non-indexation,
// cibles tactiles et prefers-reduced-motion.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { vi } from 'vitest';

import App from '@/app/App.jsx';

import { initiales } from './Entete.jsx';
import { MODULES_A_VENIR, MODULES_ACTIFS, modulesVisibles } from './menu.js';

const MEMBRE = { id: 2, email: 'm@cir.cm', nom_complet: 'Jean Mbarga', role: 'membre', est_equipe: true };
const SUPER_ADMIN = { id: 1, email: 'a@cir.cm', nom_complet: 'Awa Nana', role: 'super_admin', est_equipe: true };

function reponse(statut, corps) {
  return Promise.resolve(new Response(corps == null ? null : JSON.stringify(corps), {
    status: statut,
    headers: { 'Content-Type': 'application/json' },
  }));
}

let adresse;
function Adresse() {
  const { pathname, search } = useLocation();
  adresse = pathname + search;
  return null;
}

function rendre(chemin = '/', utilisateur = MEMBRE, autres = () => reponse(200, { count: 0, next: null, previous: null, results: [] })) {
  localStorage.setItem('cir-tdb.jetons', JSON.stringify({ acces: 'a', rafraichissement: 'r' }));
  const simule = vi.fn((url) => {
    const u = String(url);
    if (u.includes('/api/comptes/moi/')) return reponse(200, utilisateur);
    if (u.includes('/api/comptes/deconnexion/')) return reponse(204, null);
    return autres(u);
  });
  vi.stubGlobal('fetch', simule);
  render(<MemoryRouter initialEntries={[chemin]}><App /><Adresse /></MemoryRouter>);
  return simule;
}

describe('menu', () => {
  it("réserve l'entrée Équipe au super-administrateur", () => {
    expect(modulesVisibles(false).map((m) => m.chemin)).toEqual(['/', '/clients']);
    expect(modulesVisibles(true).map((m) => m.chemin)).toEqual(['/', '/clients', '/equipe']);
  });

  it('a des chemins uniques', () => {
    const chemins = [...MODULES_ACTIFS, ...MODULES_A_VENIR].map((m) => m.chemin);
    expect(new Set(chemins).size).toBe(chemins.length);
  });

  it('calcule les initiales', () => {
    expect(initiales('Jean Mbarga Ekotto')).toBe('JM');
    expect(initiales('  awa ')).toBe('A');
    expect(initiales('')).toBe('CIR');
    expect(initiales(undefined)).toBe('CIR');
  });
});

describe('Coque', () => {
  it("affiche l'identité, le rôle et un lien d'évitement vers le contenu", async () => {
    rendre('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Bonjour Jean' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Aller au contenu' })).toHaveAttribute('href', '#contenu');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'contenu');
    expect(screen.getByText("Membre de l'équipe")).toBeInTheDocument();
    expect(screen.getByText('JM')).toHaveAttribute('aria-hidden', 'true');
    // Raccourcis de l'accueil : pas d'Équipe pour un simple membre.
    const raccourcis = within(screen.getByRole('main')).getAllByRole('link').map((l) => l.textContent);
    expect(raccourcis).toEqual(['Clients']);
  });

  it('ouvre et ferme le tiroir avec le bouton et la touche Échap', async () => {
    rendre('/');
    const u = userEvent.setup();
    const bouton = await screen.findByRole('button', { name: 'Ouvrir le menu' });
    expect(bouton).toHaveAttribute('aria-expanded', 'false');
    expect(bouton).toHaveAttribute('aria-controls', 'menu-tableau-de-bord');
    expect(screen.getByRole('navigation', { name: 'Menu du tableau de bord' })).toHaveAttribute('id', 'menu-tableau-de-bord');
    await u.click(bouton);
    expect(screen.getByRole('button', { name: 'Fermer le menu' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('navigation', { name: 'Menu du tableau de bord' }).className).toMatch(/menuOuvert/);
    await u.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Ouvrir le menu' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('referme le tiroir au changement de page', async () => {
    rendre('/');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Ouvrir le menu' }));
    const menu = screen.getByRole('navigation', { name: 'Menu du tableau de bord' });
    await u.click(within(menu).getByRole('link', { name: 'Clients' }));
    await waitFor(() => expect(adresse).toBe('/clients'));
    expect(screen.getByRole('button', { name: 'Ouvrir le menu' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('liste les modules à venir et affiche « Bientôt disponible » sur leur page', async () => {
    rendre('/commandes');
    expect(await screen.findByRole('heading', { level: 1, name: 'Commandes' })).toBeInTheDocument();
    expect(screen.getByText('Le suivi des commandes et des négociations arrive bientôt.')).toBeInTheDocument();
    const menu = screen.getByRole('navigation', { name: 'Menu du tableau de bord' });
    expect(within(menu).getAllByText('Bientôt disponible')).toHaveLength(MODULES_A_VENIR.length);
    expect(within(menu).getByRole('link', { name: /Commandes/ })).toHaveAttribute('aria-current', 'page');
  });

  it('affiche une page 404 dans la coque', async () => {
    rendre('/nimporte-quoi');
    expect(await screen.findByRole('heading', { level: 1, name: "Cette page n'existe pas" })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Menu du tableau de bord' })).toBeInTheDocument();
  });

  it('déconnecte et renvoie vers la page de connexion', async () => {
    const simule = rendre('/', SUPER_ADMIN);
    await userEvent.setup().click(await screen.findByRole('button', { name: /Se déconnecter/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Connexion' })).toBeInTheDocument();
    expect(adresse).toBe('/connexion');
    expect(localStorage.getItem('cir-tdb.jetons')).toBeNull();
    expect(simule.mock.calls.some(([u]) => String(u).includes('/api/comptes/deconnexion/'))).toBe(true);
  });

  it('renvoie vers la connexion quand la session expire en cours de route', async () => {
    rendre('/clients', MEMBRE, () => reponse(401, { detail: 'Jeton expiré.' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Connexion' })).toBeInTheDocument();
    expect(localStorage.getItem('cir-tdb.jetons')).toBeNull();
  });
});

// --- Vérifications statiques ---

const RACINE_TDB = resolve(__dirname, '../..');
const RACINE_SITE = resolve(RACINE_TDB, '../site');

function fichiers(dossier, extensions) {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (nom === 'node_modules' || nom === 'dist') return [];
    if (statSync(chemin).isDirectory()) return fichiers(chemin, extensions);
    return extensions.some((e) => nom.endsWith(e)) ? [chemin] : [];
  });
}

describe('isolement et non-indexation', () => {
  it("le site public ne contient aucun lien vers le tableau de bord", () => {
    const sources = [
      ...fichiers(join(RACINE_SITE, 'src'), ['.js', '.jsx', '.html']).filter((f) => !/\.test\.jsx?$/.test(f)),
      join(RACINE_SITE, 'index.html'),
      ...fichiers(join(RACINE_SITE, 'public'), ['.html', '.txt', '.xml', '.json']),
    ];
    expect(sources.length).toBeGreaterThan(5);
    const fautifs = sources.filter((f) => /admin\.revelation-sarl\.com|localhost:5174|href=["'{`][^"'`]*\/tableau-de-bord/i
      .test(readFileSync(f, 'utf8')));
    expect(fautifs).toEqual([]);
  });

  it('le tableau de bord interdit indexation et inclusion dans un cadre', () => {
    const serve = JSON.parse(readFileSync(join(RACINE_TDB, 'public/serve.json'), 'utf8'));
    const entetes = Object.fromEntries(serve.headers.flatMap((r) => r.headers).map((h) => [h.key, h.value]));
    expect(entetes['X-Robots-Tag']).toMatch(/noindex/);
    expect(entetes['X-Frame-Options']).toBe('DENY');
    expect(readFileSync(join(RACINE_TDB, 'public/robots.txt'), 'utf8')).toMatch(/Disallow:\s*\/\s*$/m);
    expect(readFileSync(join(RACINE_TDB, 'index.html'), 'utf8')).toMatch(/<meta name="robots" content="noindex/);
  });

  it("n'utilise jamais la clé de jetons du site public", () => {
    const sources = fichiers(join(RACINE_TDB, 'src'), ['.js', '.jsx']).filter((f) => !/\.test\.jsx?$/.test(f));
    expect(sources.filter((f) => readFileSync(f, 'utf8').includes('cir-site'))).toEqual([]);
  });
});

describe('accessibilité (CSS)', () => {
  const css = (chemin) => readFileSync(resolve(RACINE_TDB, chemin), 'utf8');

  it('les liens du menu, le bouton du menu, la déconnexion et le retour font au moins 44 px', () => {
    const coque = css('src/layout/Coque.module.css');
    expect(coque).toMatch(/\.lien\s*{[^}]*min-height:\s*var\(--cible-tactile\)/);
    expect(coque).toMatch(/\.boutonMenu\s*{[^}]*height:\s*var\(--cible-tactile\)/);
    expect(coque).toMatch(/\.sortie\s*{[^}]*min-height:\s*var\(--cible-tactile\)/);
    expect(css('src/modules/clients/Clients.module.css')).toMatch(/\.retour\s*{[^}]*min-height:\s*var\(--cible-tactile\)/);
    expect(css('../partage/styles/jetons.css')).toMatch(/--cible-tactile:\s*44px/);
  });

  it('les styles communs chargés par main.jsx respectent prefers-reduced-motion', () => {
    expect(css('src/app/main.jsx')).toContain("@partage/styles/base.css");
    expect(css('../partage/styles/base.css')).toMatch(/prefers-reduced-motion:\s*reduce/);
  });
});
