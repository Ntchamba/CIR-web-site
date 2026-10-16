// Tests (site-testeur) du catalogue : « Voir plus » en erreur, langue, critères (paramètres conservés, retour
// arrière), requête envoyée, carte produit (usage inconnu, prix), requêtes publiques sans jeton.
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

import { changerLangue } from '@/i18n/index.js';
import {
  appels, connecterLocalement, emplacement, page, parametresDes, reponse, rendreAvecRoutes, simulerApi, UTILISATEUR,
} from '@/test/outils.jsx';

import { requete } from '../api.js';
import CataloguePage from '../CataloguePage.jsx';
import { lireCriteres } from '../useCatalogue.js';
import CarteProduit from './CarteProduit.jsx';

const carte = (id, champs = {}) => ({
  id, slug: `p-${id}`, reference: '', nom: `Produit ${id}`, accroche: '', famille: { slug: 'f', nom: 'Famille' },
  usages: [], prix: null, unite_prix: 'm2', image: null, est_nouveau: false, a_la_une: false, ...champs,
});

const rendre = (chemin = '/catalogue') => rendreAvecRoutes(chemin, { '/catalogue': <CataloguePage /> });

describe('Catalogue : « Voir plus »', () => {
  it('erreur sur la page 2 : produits gardés, message, « Réessayer » charge la page 2', async () => {
    let echec = true;
    const fetch = simulerApi({
      'GET /api/catalogue/familles/': reponse(200, []),
      'GET /api/catalogue/produits/': (corps, init, url) => {
        if (url.searchParams.get('page') !== '2') return reponse(200, page([carte(1)], { count: 2, next: 'x' }));
        if (echec) {
          echec = false;
          return reponse(503, null);
        }
        return reponse(200, page([carte(2)], { count: 2 }));
      },
    });
    rendre();
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Voir plus' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Produit 1' })).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('link', { name: 'Produit 2' })).toBeInTheDocument();
    expect(parametresDes(fetch, '/api/catalogue/produits/').map((p) => p.get('page'))).toEqual([null, '2', '2']);
    expect(screen.getByText('2 éléments affichés sur 2')).toBeInTheDocument();
  });
});

describe('Catalogue : langue et requêtes', () => {
  it('changement de langue : familles et produits redemandés (page 1) dans la nouvelle langue', async () => {
    const fetch = simulerApi({
      'GET /api/catalogue/familles/': (c, init) => reponse(200, [
        { id: 1, slug: 'f', nom: init.headers['Accept-Language'] === 'en' ? 'Self-levelling' : 'Autolissants', description: '', nombre_produits: 1 },
      ]),
      'GET /api/catalogue/produits/': (c, init) => reponse(200, page([
        carte(1, { nom: init.headers['Accept-Language'] === 'en' ? 'Floor' : 'Sol' }),
      ])),
    });
    rendre();
    expect(await screen.findByRole('link', { name: 'Sol' })).toBeInTheDocument();
    await act(() => changerLangue('en'));
    expect(await screen.findByRole('link', { name: 'Floor' })).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: 'Self-levelling (1)' })).toBeInTheDocument();
    expect(screen.getByText('Price on quotation')).toBeInTheDocument();
    expect(appels(fetch, 'GET', '/api/catalogue/produits/').map(([, i]) => i.headers['Accept-Language'])).toEqual(['fr', 'en']);
  });

  it('client connecté : familles et produits demandés sans jeton', async () => {
    connecterLocalement();
    const fetch = simulerApi({
      'GET /api/comptes/moi/': reponse(200, UTILISATEUR),
      'GET /api/catalogue/familles/': reponse(200, []),
      'GET /api/catalogue/produits/': reponse(200, page([carte(1)])),
    });
    rendre();
    await screen.findByRole('link', { name: 'Produit 1' });
    [...appels(fetch, 'GET', '/api/catalogue/familles/'), ...appels(fetch, 'GET', '/api/catalogue/produits/')]
      .forEach(([, init]) => expect(init.headers.Authorization).toBeUndefined());
  });

  it('les autres paramètres de l’adresse (?lang=) sont gardés ; la recherche est envoyée en « search »', async () => {
    const fetch = simulerApi({
      'GET /api/catalogue/familles/': reponse(200, []),
      'GET /api/catalogue/produits/': reponse(200, page([])),
    });
    rendre('/catalogue?lang=fr&usage=exterieur');
    const u = userEvent.setup();
    const champ = await screen.findByRole('searchbox', { name: 'Rechercher un produit' });
    await u.type(champ, '  terrazzo  ');
    await u.keyboard('{Enter}');
    await waitFor(() => expect(emplacement()).toBe('/catalogue?lang=fr&usage=exterieur&q=terrazzo'));
    await waitFor(() => {
      const p = parametresDes(fetch, '/api/catalogue/produits/').at(-1);
      expect(Object.fromEntries(p)).toEqual({ usage: 'exterieur', search: 'terrazzo' });
    });
    // « Tous les usages » retire le critère de l'adresse
    await u.click(within(screen.getByRole('group', { name: 'Usage' })).getByRole('button', { name: 'Tous' }));
    await waitFor(() => expect(emplacement()).toBe('/catalogue?lang=fr&q=terrazzo'));
  });
});

describe('Catalogue : fonctions et carte', () => {
  it('requete() ignore les critères vides ; lireCriteres() nettoie l’adresse', () => {
    expect(requete({ famille: '', usage: undefined, nouveau: false, a_la_une: 1, page: '' })).toBe('?a_la_une=1');
    expect(requete({ search: 'a&b=c' })).toBe('?search=a%26b%3Dc');
    expect(requete()).toBe('');
    expect(lireCriteres(new URLSearchParams('usage=piscine&q=%20yd%20&famille=sols'))).toEqual({ famille: 'sols', usage: '', q: 'yd' });
  });

  it('carte : 0 FCFA est un prix fixé (pas « Prix sur devis ») ; usage inconnu jamais affiché en clé brute', () => {
    render(<MemoryRouter><CarteProduit produit={carte(1, { prix: '0', usages: ['maison', 'piscine'] })} /></MemoryRouter>);
    expect(screen.queryByText('Prix sur devis')).toBeNull();
    expect(screen.getByText('Maison')).toBeInTheDocument();
    expect(screen.queryByText(/usages\.piscine/)).toBeNull();
  });

  it('carte : prix absent, vide ou non numérique → « Prix sur devis »', () => {
    for (const prix of [null, undefined, '', 'abc']) {
      const { unmount } = render(<MemoryRouter><CarteProduit produit={carte(1, { prix })} /></MemoryRouter>);
      expect(screen.getByText('Prix sur devis')).toBeInTheDocument();
      unmount();
    }
  });
});
