// Outils de test des pages de gestion : API simulée (fetch) et rendu de l'application connectée.
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';

import App from '@/app/App.jsx';

export const MEMBRE = { id: 2, email: 'm@cir.cm', nom_complet: 'Jean Mbarga', role: 'membre', est_equipe: true, langue: 'fr' };

export function reponse(statut, corps) {
  return Promise.resolve(new Response(corps == null ? null : JSON.stringify(corps), {
    status: statut, headers: { 'Content-Type': 'application/json' },
  }));
}

export const page = (results) => ({ count: results.length, next: null, previous: null, results });

/**
 * `routes` : [[méthode, motif, (url, options) => Promise<Response> | corps]] ; la première qui correspond répond
 * (motif : chaîne contenue dans l'adresse ou expression régulière). Sinon 200 avec une liste vide.
 */
export function simulerApi(routes = []) {
  const simule = vi.fn((url, options = {}) => {
    const u = String(url);
    const methode = options.method || 'GET';
    if (u.includes('/api/comptes/moi/')) return reponse(200, MEMBRE);
    for (const [m, motif, rappel] of routes) {
      const ok = motif instanceof RegExp ? motif.test(u) : u.includes(motif);
      if (ok && m === methode) {
        const r = typeof rappel === 'function' ? rappel(u, options) : rappel;
        return r instanceof Promise ? r : reponse(methode === 'POST' ? 201 : 200, r);
      }
    }
    return reponse(200, page([]));
  });
  vi.stubGlobal('fetch', simule);
  return simule;
}

/** Appels faits avec cette méthode vers une adresse qui contient `motif`. */
export const appels = (simule, methode, motif) => simule.mock.calls
  .filter(([u, o = {}]) => (o.method || 'GET') === methode && String(u).includes(motif));

export function rendre(chemin) {
  localStorage.setItem('cir-tdb.jetons', JSON.stringify({ acces: 'a', rafraichissement: 'r' }));
  return render(<MemoryRouter initialEntries={[chemin]}><App /></MemoryRouter>);
}
