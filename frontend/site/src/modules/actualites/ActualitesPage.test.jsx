// Tests des actualités : liste (date dans la langue), état vide, détail, produit lié, 404.
import { screen } from '@testing-library/react';

import { changerLangue } from '@/i18n/index.js';
import { page, reponse, rendreAvecRoutes, simulerApi } from '@/test/outils.jsx';

import ActualitePage from './ActualitePage.jsx';
import ActualitesPage from './ActualitesPage.jsx';

const ACTUALITE = {
  id: 1,
  slug: 'nouveau-terrazzo',
  titre: 'Nouveau terrazzo époxy',
  resume: 'Le YD-518 rejoint le catalogue.',
  texte: 'Premier paragraphe.\n\nSecond paragraphe.',
  image: { url: 'https://api.test/media/actu.webp', alt: 'Terrazzo' },
  produit: { slug: 'yd-518', nom: 'Terrazzo époxy' },
  publie_le: '2026-10-12T09:00:00Z',
};

const rendre = (chemin) => rendreAvecRoutes(chemin, {
  '/actualites': <ActualitesPage />,
  '/actualites/:slug': <ActualitePage />,
});

describe('ActualitesPage', () => {
  it('liste : titre en lien, résumé, date mise en forme selon la langue', async () => {
    simulerApi({ 'GET /api/actualites/': reponse(200, page([ACTUALITE])) });
    rendre('/actualites');
    expect(await screen.findByRole('link', { name: 'Nouveau terrazzo époxy' })).toHaveAttribute('href', '/actualites/nouveau-terrazzo');
    expect(screen.getByText('Le YD-518 rejoint le catalogue.')).toBeInTheDocument();
    expect(screen.getByText('12 octobre 2026')).toHaveAttribute('datetime', ACTUALITE.publie_le);
    await changerLangue('de');
    expect(await screen.findByText('12. Oktober 2026')).toBeInTheDocument();
  });

  it('aucune actualité : message traduit', async () => {
    simulerApi({ 'GET /api/actualites/': reponse(200, page([])) });
    rendre('/actualites');
    expect(await screen.findByRole('heading', { name: 'Aucune actualité pour le moment' })).toBeInTheDocument();
  });
});

describe('ActualitePage', () => {
  it('détail : titre, date, paragraphes, produit lié', async () => {
    simulerApi({ 'GET /api/actualites/nouveau-terrazzo/': reponse(200, ACTUALITE) });
    rendre('/actualites/nouveau-terrazzo');
    expect(await screen.findByRole('heading', { level: 1, name: 'Nouveau terrazzo époxy' })).toBeInTheDocument();
    expect(screen.getByText('Publié le 12 octobre 2026')).toBeInTheDocument();
    expect(screen.getByText('Second paragraphe.').tagName).toBe('P');
    expect(screen.getByRole('link', { name: 'Terrazzo époxy' })).toHaveAttribute('href', '/catalogue/yd-518');
    expect(screen.getByRole('img', { name: 'Terrazzo' })).toHaveAttribute('width', '1280');
  });

  it('actualité inconnue : message « introuvable »', async () => {
    simulerApi();
    rendre('/actualites/inconnue');
    expect(await screen.findByRole('heading', { level: 1, name: 'Actualité introuvable' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Toutes les actualités' })).toHaveAttribute('href', '/actualites');
  });
});
