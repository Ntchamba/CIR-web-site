// Outils communs aux tests du site : faux back-end (fetch simulé) et rendu avec routeur + session.
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';

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
 * Remplace fetch par un faux back-end. `routes` : { 'POST /api/comptes/connexion/': (corps, init) => reponse(...) }.
 * Renvoie le vi.fn() ; une route absente répond 404.
 */
export function simulerApi(routes = {}) {
  const fetch = vi.fn(async (url, init = {}) => {
    const chemin = new URL(url).pathname;
    const gestion = routes[`${init.method || 'GET'} ${chemin}`];
    if (!gestion) return reponse(404, { detail: 'Introuvable.' });
    const corps = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
    return typeof gestion === 'function' ? gestion(corps, init) : gestion;
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
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
