// Outils communs aux tests du site : faux back-end (fetch simulé) et rendu avec routeur + session.
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';

import App from '@/app/App.jsx';
import { AuthProvider } from '@/modules/compte/AuthContext.jsx';

export const CLE_JETONS = 'cir-site.jetons';

export const UTILISATEUR = {
  id: 1,
  email: 'awa@exemple.cm',
  nom_complet: 'Awa Ngono',
  telephone: '+237699000000',
  role: 'client',
  est_equipe: false,
  ville: 'Douala',
  quartier: 'Bonapriso',
  rue_ou_repere: 'Près de la pharmacie',
  adresse_complete: true,
  adresse_formatee: 'Près de la pharmacie, Bonapriso, Douala',
  date_inscription: '2026-10-16T10:00:00Z',
};

export function reponse(status, corps) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => corps,
  };
}

/**
 * Remplace fetch par un faux back-end. `routes` : { 'POST /api/comptes/connexion/': (corps, init, url) => reponse(...) }.
 * La clé ne contient pas la chaîne de requête : `url` (objet URL) permet de lire ?page=, ?usage=…
 * Renvoie le vi.fn() ; une route absente répond 404.
 */
export function simulerApi(routes = {}) {
  const fetch = vi.fn(async (url, init = {}) => {
    const adresse = new URL(url);
    const gestion = routes[`${init.method || 'GET'} ${adresse.pathname}`];
    if (!gestion) return reponse(404, { detail: 'Introuvable.' });
    const corps = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
    return typeof gestion === 'function' ? gestion(corps, init, adresse) : gestion;
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

/** Réponse paginée DRF : { count, next, previous, results }. */
export function page(results, { count = results.length, next = null, previous = null } = {}) {
  return { count, next, previous, results };
}

/** Paramètres de requête des appels GET à une route (un URLSearchParams par appel). */
export function parametresDes(fetch, chemin) {
  return fetch.mock.calls
    .filter(([url, init = {}]) => (init.method || 'GET') === 'GET' && new URL(url).pathname === chemin)
    .map(([url]) => new URL(url).searchParams);
}

/** Simule le réglage « mouvement réduit » du système (window.matchMedia). */
export function simulerMouvementReduit(reduit = true) {
  vi.stubGlobal('matchMedia', (requete) => ({
    matches: reduit && requete.includes('prefers-reduced-motion'),
    media: requete,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

/** Appels faits à une route ([corps, init] pour chacun). */
export function appels(fetch, methode, chemin) {
  return fetch.mock.calls
    .filter(([url, init = {}]) => (init.method || 'GET') === methode && new URL(url).pathname === chemin)
    .map(([, init]) => [typeof init.body === 'string' ? JSON.parse(init.body) : init.body, init]);
}

export function connecterLocalement(jetons = { acces: 'A1', rafraichissement: 'R1' }) {
  localStorage.setItem(CLE_JETONS, JSON.stringify(jetons));
}

function Emplacement() {
  const { pathname, search } = useLocation();
  return <output data-testid="emplacement">{pathname + search}</output>;
}

export const emplacement = () => screen.getByTestId('emplacement').textContent;

/** Rendu sous AuthProvider et MemoryRouter ; `pages` : { chemin: élément }. */
export function rendreAvecRoutes(chemin, pages, { protegees = {}, Protection } = {}) {
  return render(
    <MemoryRouter initialEntries={[chemin]}>
      <AuthProvider>
        <Routes>
          {Object.entries(pages).map(([p, el]) => <Route key={p} path={p} element={el} />)}
          {Protection && (
            <Route element={<Protection />}>
              {Object.entries(protegees).map(([p, el]) => <Route key={p} path={p} element={el} />)}
            </Route>
          )}
          <Route path="*" element={<p>Autre page</p>} />
        </Routes>
        <Emplacement />
      </AuthProvider>
    </MemoryRouter>,
  );
}

/** Rendu de l'application entière (session, sélection, routes, en-tête) à l'adresse donnée. */
export function rendreApp(chemin = '/') {
  return render(
    <MemoryRouter initialEntries={[chemin]}>
      <App />
      <Emplacement />
    </MemoryRouter>,
  );
}

/** Routes de base d'un client connecté : profil complet et sélection vide. */
export function routesClient(extra = {}, { utilisateur = UTILISATEUR, produits = [] } = {}) {
  connecterLocalement();
  return {
    'GET /api/comptes/moi/': reponse(200, utilisateur),
    'GET /api/selection/resume/': reponse(200, { count: produits.length, produits }),
    ...extra,
  };
}
