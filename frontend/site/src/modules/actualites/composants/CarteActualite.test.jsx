// Tests (site-testeur) des actualités : « Voir plus » (y compris en erreur), langue, requêtes sans jeton,
// accueil (3 dernières), détail (image, produit lié, texte non interprété).
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { changerLangue } from '@/i18n/index.js';
import {
  appels, connecterLocalement, page, parametresDes, reponse, rendreAvecRoutes, simulerApi, UTILISATEUR,
} from '@/test/outils.jsx';

import ActualitePage from '../ActualitePage.jsx';
import ActualitesPage from '../ActualitesPage.jsx';
import SectionActualites from './SectionActualites.jsx';

const actu = (id, champs = {}) => ({
  id, slug: `a-${id}`, titre: `Actualité ${id}`, resume: '', texte: '', image: null, produit: null,
  publie_le: '2026-10-0' + ((id % 9) + 1) + 'T08:00:00Z', ...champs,
});

describe('ActualitesPage (compléments)', () => {
  it('« Voir plus » : page 2 ajoutée ; en erreur, la liste reste et « Réessayer » reprend', async () => {
    let echec = true;
    const fetch = simulerApi({
      'GET /api/actualites/': (c, i, url) => {
        if (url.searchParams.get('page') !== '2') return reponse(200, page([actu(1)], { count: 2, next: 'x' }));
        if (echec) {
          echec = false;
          return reponse(502, null);
        }
        return reponse(200, page([actu(2)], { count: 2 }));
      },
    });
    rendreAvecRoutes('/actualites', { '/actualites': <ActualitesPage /> });
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Voir plus' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Actualité 1' })).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('link', { name: 'Actualité 2' })).toBeInTheDocument();
    expect(parametresDes(fetch, '/api/actualites/').map((p) => p.get('page'))).toEqual([null, '2', '2']);
  });

  it('changement de langue : liste redemandée et dates mises en forme dans la langue', async () => {
    const fetch = simulerApi({
      'GET /api/actualites/': (c, init) => reponse(200, page([actu(1, {
        titre: init.headers['Accept-Language'] === 'de' ? 'Neuigkeit' : 'Actualité 1', publie_le: '2026-10-16T08:00:00Z',
      })])),
    });
    rendreAvecRoutes('/actualites', { '/actualites': <ActualitesPage /> });
    expect(await screen.findByText('16 octobre 2026')).toBeInTheDocument();
    await act(() => changerLangue('de'));
    expect(await screen.findByRole('link', { name: 'Neuigkeit' })).toBeInTheDocument();
    expect(screen.getByText('16. Oktober 2026')).toBeInTheDocument();
    expect(appels(fetch, 'GET', '/api/actualites/').map(([, i]) => i.headers['Accept-Language'])).toEqual(['fr', 'de']);
  });

  it('client connecté : liste et détail demandés sans jeton', async () => {
    connecterLocalement();
    const fetch = simulerApi({
      'GET /api/comptes/moi/': reponse(200, UTILISATEUR),
      'GET /api/actualites/a-1/': reponse(200, actu(1)),
    });
    rendreAvecRoutes('/actualites/a-1', { '/actualites/:slug': <ActualitePage /> });
    await screen.findByRole('heading', { level: 1, name: 'Actualité 1' });
    appels(fetch, 'GET', '/api/actualites/a-1/').forEach(([, init]) => expect(init.headers.Authorization).toBeUndefined());
  });
});

describe('SectionActualites (accueil)', () => {
  it('trois dernières (taille=3), titres en h3, lien vers toutes', async () => {
    const fetch = simulerApi({ 'GET /api/actualites/': reponse(200, page([actu(1), actu(2), actu(3)], { count: 8, next: 'x' })) });
    rendreAvecRoutes('/', { '/': <SectionActualites /> });
    expect(await screen.findAllByRole('heading', { level: 3 })).toHaveLength(3);
    expect(screen.getByRole('link', { name: /Toutes les actualités|Voir toutes/ })).toHaveAttribute('href', '/actualites');
    expect(parametresDes(fetch, '/api/actualites/')[0].get('taille')).toBe('3');
  });

  it('erreur ou aucune actualité : rien n’est affiché', async () => {
    const fetch = simulerApi({ 'GET /api/actualites/': reponse(500, null) });
    const { container } = rendreAvecRoutes('/', { '/': <SectionActualites /> });
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container.querySelector('section')).toBeNull();
  });
});

describe('ActualitePage (compléments)', () => {
  it('image prioritaire, produit lié, texte non interprété comme du HTML', async () => {
    simulerApi({
      'GET /api/actualites/a-1/': reponse(200, actu(1, {
        texte: '<script>alert(1)</script>Lancement.',
        image: { url: 'https://api.test/media/n.webp', alt: 'Nouveau sol' },
        produit: { slug: 'yd-518', nom: 'Terrazzo époxy' },
      })),
    });
    const { container } = rendreAvecRoutes('/actualites/a-1', { '/actualites/:slug': <ActualitePage /> });
    expect(await screen.findByRole('img', { name: 'Nouveau sol' })).toHaveAttribute('loading', 'eager');
    expect(screen.getByRole('link', { name: /Terrazzo époxy/ })).toHaveAttribute('href', '/catalogue/yd-518');
    expect(screen.getByText('<script>alert(1)</script>Lancement.')).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();
  });
});
