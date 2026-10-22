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
    const lien = await screen.findByRole('link', { name: /Produit 1/ });
    expect(lien).toHaveAttribute('href', '/catalogue/produit-1');
    // Maquette : grande image carrée sans cadre, nom centré, prix dessous (la carte est un seul lien)
    expect(within(lien).getByText('Prix sur devis')).toBeInTheDocument();
    const image = lien.querySelector('img');
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveAttribute('width');
    expect(image).toHaveAttribute('src', 'https://api.test/media/p1.webp');
    const seconde = screen.getByRole('link', { name: /Produit 2/ });
    expect(within(seconde).getByText(/12\s500 FCFA \/ m²/)).toBeInTheDocument();
    expect(seconde.querySelector('.ref-neutre')).toHaveTextContent('Produit 2'); // carré neutre portant le nom
    // Familles : liste (comme la maquette), noms sans nombre de produits
    expect(screen.getByRole('button', { name: 'Sols autolissants' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Toutes les familles' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('filtres : usage, famille et recherche passent dans l’adresse et dans la requête', async () => {
    const fetch = simulerApi({
      'GET /api/catalogue/familles/': reponse(200, FAMILLES),
      'GET /api/catalogue/produits/': reponse(200, page([carte(1)])),
    });
    rendre();
    await screen.findByRole('link', { name: /Produit 1/ });
    const u = userEvent.setup();

    await u.click(screen.getByRole('button', { name: 'Industrie' }));
    await waitFor(() => expect(emplacement()).toBe('/catalogue?usage=industrie'));
    expect(screen.getByRole('button', { name: 'Industrie' })).toHaveAttribute('aria-pressed', 'true');

    await u.click(screen.getByRole('button', { name: 'Primaires' }));
    await waitFor(() => expect(emplacement()).toBe('/catalogue?usage=industrie&famille=primaires'));

    await u.type(screen.getByRole('searchbox', { name: 'Rechercher un produit' }), 'YD-500');
    await u.keyboard('{Enter}');
    await waitFor(() => expect(emplacement()).toContain('q=YD-500'));

    await waitFor(() => {
      const derniers = parametresDes(fetch, '/api/catalogue/produits/').at(-1);
      expect(Object.fromEntries(derniers)).toEqual({ usage: 'industrie', famille: 'primaires', search: 'YD-500', taille: '10' });
    });
  });

  it('lit les critères d’une adresse partagée et ignore un usage inconnu', async () => {
    const fetch = simulerApi({
      'GET /api/catalogue/familles/': reponse(200, FAMILLES),
      'GET /api/catalogue/produits/': reponse(200, page([carte(1)])),
    });
    rendre('/catalogue?famille=sols-autolissants&usage=piscine');
    await screen.findByRole('link', { name: /Produit 1/ });
    expect(Object.fromEntries(parametresDes(fetch, '/api/catalogue/produits/')[0])).toEqual({ famille: 'sols-autolissants', taille: '10' });
    expect(await screen.findByText('Sols lisses et continus.')).toBeInTheDocument();
  });

  it('pagination numérotée de la maquette : 10 produits par page, « Suivant → », adresse ?page=', async () => {
    const fetch = simulerApi({
      'GET /api/catalogue/familles/': reponse(200, FAMILLES),
      'GET /api/catalogue/produits/': (corps, init, url) => (url.searchParams.get('page') === '2'
        ? reponse(200, page([carte(13)], { count: 13 }))
        : reponse(200, page([carte(1), carte(2)], { count: 13, next: 'https://api.test/api/catalogue/produits/?page=2' }))),
    });
    rendre();
    await screen.findByRole('link', { name: /Produit 2/ });
    expect(Object.fromEntries(parametresDes(fetch, '/api/catalogue/produits/')[0])).toEqual({ taille: '10' });
    const pagination = screen.getByRole('navigation', { name: 'Pages du catalogue' });
    expect(within(pagination).getByRole('link', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');
    expect(within(pagination).getAllByRole('link').map((l) => l.textContent)).toEqual(['1', '2', 'Suivant →']);
    await userEvent.click(within(pagination).getByRole('link', { name: 'Suivant →' }));
    expect(await screen.findByRole('link', { name: /Produit 13/ })).toBeInTheDocument();
    expect(emplacement()).toBe('/catalogue?page=2');
    expect(screen.queryByRole('link', { name: /Produit 2/ })).toBeNull();
    expect(within(screen.getByRole('navigation', { name: 'Pages du catalogue' })).getByRole('link', { name: '← Précédent' })).toBeInTheDocument();
    expect(parametresDes(fetch, '/api/catalogue/produits/').at(-1).get('page')).toBe('2');
    // un filtre ramène à la première page
    await userEvent.click(screen.getByRole('button', { name: 'Industrie' }));
    await waitFor(() => expect(emplacement()).toBe('/catalogue?usage=industrie'));
  });

  it('une seule page : pas de pagination', async () => {
    simulerApi({
      'GET /api/catalogue/familles/': reponse(200, FAMILLES),
      'GET /api/catalogue/produits/': reponse(200, page([carte(1)])),
    });
    rendre();
    await screen.findByRole('link', { name: /Produit 1/ });
    expect(screen.queryByRole('navigation', { name: 'Pages du catalogue' })).toBeNull();
  });

  it('maquette : titre « Catalogue », sous-titre, filtres « Pour quel sol ? » et « Famille » avec point corail sur le choix actif', async () => {
    simulerApi({
      'GET /api/catalogue/familles/': reponse(200, FAMILLES),
      'GET /api/catalogue/produits/': reponse(200, page([carte(1)])),
    });
    rendre();
    expect(await screen.findByRole('heading', { level: 1, name: 'Catalogue' })).toBeInTheDocument();
    expect(screen.getByText('Des sols durables, des sols uniques.')).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Rechercher un produit' })).toHaveAttribute('placeholder', 'Rechercher…');
    expect(screen.getByRole('group', { name: 'Pour quel sol ?' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Famille' })).toBeInTheDocument();
    ['Tous les sols', 'Maison', 'Industrie', 'Entreprise', 'Extérieur'].forEach((n) => expect(screen.getByRole('button', { name: n })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Tous les sols' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('catalogue vide : message traduit, aucun produit inventé', async () => {
    simulerApi({
      'GET /api/catalogue/familles/': reponse(200, []),
      'GET /api/catalogue/produits/': reponse(200, page([])),
    });
    rendre();
    expect(await screen.findByRole('heading', { name: 'Le catalogue est en préparation' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Produit/ })).toBeNull();
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
    expect(await screen.findByRole('link', { name: /Produit 1/ })).toBeInTheDocument();
  });

  it('requêtes publiques : sans jeton, avec la langue de l’interface', async () => {
    localStorage.setItem('cir-site.jetons', JSON.stringify({ acces: 'A1', rafraichissement: 'R1' }));
    const fetch = simulerApi({
      'GET /api/comptes/moi/': reponse(401, {}),
      'GET /api/catalogue/familles/': reponse(200, FAMILLES),
      'GET /api/catalogue/produits/': reponse(200, page([carte(1)])),
    });
    rendre();
    await screen.findByRole('link', { name: /Produit 1/ });
    const appel = fetch.mock.calls.find(([url]) => url.includes('/api/catalogue/produits/'));
    expect(appel[1].headers.Authorization).toBeUndefined();
    expect(appel[1].headers['Accept-Language']).toBe('fr');
  });
});
