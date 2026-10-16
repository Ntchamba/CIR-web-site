// Tests de la page catalogue : cartes, « Prix sur devis », filtres dans l'adresse, « Voir plus », états vides.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { emplacement, page, parametresDes, reponse, rendreAvecRoutes, simulerApi } from '@/test/outils.jsx';

import CataloguePage from './CataloguePage.jsx';

const FAMILLES = [
  { id: 1, nom: 'Sols autolissants', slug: 'sols-autolissants', description: 'Sols lisses et continus.', nombre_produits: 2 },
  { id: 2, nom: 'Primaires', slug: 'primaires', description: '', nombre_produits: 1 },
];

const carte = (id, champs = {}) => ({
  id,
  slug: `produit-${id}`,
  reference: `YD-${id}`,
  nom: `Produit ${id}`,
  accroche: `Accroche ${id}`,
  famille: { slug: 'sols-autolissants', nom: 'Sols autolissants' },
  usages: ['maison', 'industrie'],
  prix: null,
  unite_prix: 'm2',
  image: null,
  est_nouveau: false,
  a_la_une: false,
  ...champs,
});

const rendre = (chemin = '/catalogue') => rendreAvecRoutes(chemin, { '/catalogue': <CataloguePage /> });

describe('CataloguePage', () => {
  it('affiche les produits : prix absent → « Prix sur devis », prix fixé mis en forme, usages traduits', async () => {
    simulerApi({
      'GET /api/catalogue/familles/': reponse(200, FAMILLES),
      'GET /api/catalogue/produits/': reponse(200, page([
        carte(1, { est_nouveau: true, image: { url: 'https://api.test/media/p1.webp', alt: 'Sol gris' } }),
        carte(2, { prix: '12500', unite_prix: 'm2' }),
      ])),
    });
    rendre();
    expect(await screen.findByRole('heading', { level: 1, name: 'Catalogue' })).toBeInTheDocument();
    const lien = await screen.findByRole('link', { name: 'Produit 1' });
    expect(lien).toHaveAttribute('href', '/catalogue/produit-1');
    const premiere = lien.closest('article');
    expect(within(premiere).getByText('Prix sur devis')).toBeInTheDocument();
    expect(within(premiere).getByText('Nouveau')).toBeInTheDocument();
    const image = within(premiere).getByRole('img', { name: 'Sol gris' });
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveAttribute('width');
    const seconde = screen.getByRole('link', { name: 'Produit 2' }).closest('article');
    expect(within(seconde).getByText(/12\s500 FCFA \/ m²/)).toBeInTheDocument();
    expect(within(seconde).getByText('Industrie')).toBeInTheDocument();
    // Familles avec leur nombre de produits
    expect(screen.getByRole('option', { name: 'Sols autolissants (2)' })).toBeInTheDocument();
  });

  it('filtres : usage, famille et recherche passent dans l’adresse et dans la requête', async () => {
    const fetch = simulerApi({
      'GET /api/catalogue/familles/': reponse(200, FAMILLES),
      'GET /api/catalogue/produits/': reponse(200, page([carte(1)])),
    });
    rendre();
    await screen.findByRole('link', { name: 'Produit 1' });
    const u = userEvent.setup();

    await u.click(screen.getByRole('button', { name: 'Industrie' }));
    await waitFor(() => expect(emplacement()).toBe('/catalogue?usage=industrie'));
    expect(screen.getByRole('button', { name: 'Industrie' })).toHaveAttribute('aria-pressed', 'true');

    await u.selectOptions(screen.getByLabelText('Famille'), 'primaires');
    await waitFor(() => expect(emplacement()).toBe('/catalogue?usage=industrie&famille=primaires'));

    await u.type(screen.getByRole('searchbox', { name: 'Rechercher un produit' }), 'YD-500');
    await u.click(screen.getByRole('button', { name: 'Rechercher' }));
    await waitFor(() => expect(emplacement()).toContain('q=YD-500'));

    await waitFor(() => {
      const derniers = parametresDes(fetch, '/api/catalogue/produits/').at(-1);
      expect(Object.fromEntries(derniers)).toEqual({ usage: 'industrie', famille: 'primaires', search: 'YD-500' });
    });
  });

  it('lit les critères d’une adresse partagée et ignore un usage inconnu', async () => {
    const fetch = simulerApi({
      'GET /api/catalogue/familles/': reponse(200, FAMILLES),
      'GET /api/catalogue/produits/': reponse(200, page([carte(1)])),
    });
    rendre('/catalogue?famille=sols-autolissants&usage=piscine');
    await screen.findByRole('link', { name: 'Produit 1' });
    expect(Object.fromEntries(parametresDes(fetch, '/api/catalogue/produits/')[0])).toEqual({ famille: 'sols-autolissants' });
    expect(await screen.findByText('Sols lisses et continus.')).toBeInTheDocument();
  });

  it('« Voir plus » ajoute la page suivante', async () => {
    const fetch = simulerApi({
      'GET /api/catalogue/familles/': reponse(200, FAMILLES),
      'GET /api/catalogue/produits/': (corps, init, url) => (url.searchParams.get('page') === '2'
        ? reponse(200, page([carte(3)], { count: 3 }))
        : reponse(200, page([carte(1), carte(2)], { count: 3, next: 'https://api.test/api/catalogue/produits/?page=2' }))),
    });
    rendre();
    await screen.findByRole('link', { name: 'Produit 2' });
    expect(screen.getByText('2 éléments affichés sur 3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Voir plus' }));
    expect(await screen.findByRole('link', { name: 'Produit 3' })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(screen.queryByRole('button', { name: 'Voir plus' })).toBeNull();
    expect(parametresDes(fetch, '/api/catalogue/produits/').map((p) => p.get('page'))).toEqual([null, '2']);
  });

  it('catalogue vide : message traduit, aucun produit inventé', async () => {
    simulerApi({
      'GET /api/catalogue/familles/': reponse(200, []),
      'GET /api/catalogue/produits/': reponse(200, page([])),
    });
    rendre();
    expect(await screen.findByRole('heading', { name: 'Le catalogue est en préparation' })).toBeInTheDocument();
    expect(screen.queryByRole('article')).toBeNull();
  });

  it('aucun résultat avec des filtres : bouton pour les effacer', async () => {
    simulerApi({
      'GET /api/catalogue/familles/': reponse(200, FAMILLES),
      'GET /api/catalogue/produits/': reponse(200, page([])),
    });
    rendre('/catalogue?usage=exterieur');
    expect(await screen.findByRole('heading', { name: 'Aucun produit ne correspond' })).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Effacer les filtres' })[0]);
    await waitFor(() => expect(emplacement()).toBe('/catalogue'));
  });

  it('erreur du serveur : message et « Réessayer »', async () => {
    let echec = true;
    simulerApi({
      'GET /api/catalogue/familles/': reponse(200, FAMILLES),
      'GET /api/catalogue/produits/': () => (echec ? reponse(500, {}) : reponse(200, page([carte(1)]))),
    });
    rendre();
    expect(await screen.findByRole('alert')).toHaveTextContent('Le serveur rencontre un problème');
    echec = false;
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('link', { name: 'Produit 1' })).toBeInTheDocument();
  });

  it('requêtes publiques : sans jeton, avec la langue de l’interface', async () => {
    localStorage.setItem('cir-site.jetons', JSON.stringify({ acces: 'A1', rafraichissement: 'R1' }));
    const fetch = simulerApi({
      'GET /api/comptes/moi/': reponse(401, {}),
      'GET /api/catalogue/familles/': reponse(200, FAMILLES),
      'GET /api/catalogue/produits/': reponse(200, page([carte(1)])),
    });
    rendre();
    await screen.findByRole('link', { name: 'Produit 1' });
    const appel = fetch.mock.calls.find(([url]) => url.includes('/api/catalogue/produits/'));
    expect(appel[1].headers.Authorization).toBeUndefined();
    expect(appel[1].headers['Accept-Language']).toBe('fr');
  });
});
