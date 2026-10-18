// Nouvelle commande : adresse incomplète (formulaire masqué, lien vers /compte), refus 403 du serveur, 429,
// commande depuis la sélection ou depuis un produit, erreurs sous les champs.
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { appels, emplacement, reponse, rendreApp, routesClient, simulerApi, UTILISATEUR } from '@/test/outils.jsx';

import { COMMANDE } from './fixtures.js';

const ELEMENTS = {
  count: 1,
  elements: [{
    id: 1, ajoute_le: '2026-10-16', disponible: true,
    produit: { id: 3, slug: 'yd-306', reference: 'YD-306', nom: 'Sable coloré', famille: { slug: 'f', nom: 'F' }, image: null, prix: null, unite_prix: null },
    design: { id: 2, nom: 'Gris', couleur: '#444', image: null },
  }],
};
const PRODUIT = { id: 3, slug: 'yd-306', reference: 'YD-306', nom: 'Sable coloré', designs: [{ id: 2, nom: 'Gris', couleur: '#444', image: null }] };

const remplir = async (u) => {
  await u.selectOptions(screen.getByLabelText(/Type de bâtiment/), 'maison');
  await u.type(screen.getByLabelText('Surface (m²)'), '42.5');
};

describe('NouvelleCommandePage', () => {
  it('adresse incomplète : pas de formulaire, message clair et lien vers /compte', async () => {
    simulerApi(routesClient({ 'GET /api/selection/': reponse(200, ELEMENTS) }, {
      utilisateur: { ...UTILISATEUR, rue_ou_repere: '', adresse_complete: false },
    }));
    rendreApp('/commandes/nouvelle');
    expect(await screen.findByRole('heading', { level: 1, name: 'Complétez votre adresse pour commander' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Compléter mon adresse' })).toHaveAttribute('href', '/compte');
    expect(screen.queryByLabelText(/Type de bâtiment/)).toBeNull();
  });

  it('depuis la sélection : envoie depuis_selection, surface en nombre, puis ouvre la commande', async () => {
    const fetch = simulerApi(routesClient({
      'GET /api/selection/': reponse(200, ELEMENTS),
      'POST /api/commandes/': reponse(201, COMMANDE),
      'GET /api/commandes/7/': reponse(200, COMMANDE),
    }));
    rendreApp('/commandes/nouvelle');
    await screen.findByText('Sable coloré');
    expect(screen.getByText('Près de la pharmacie, Bonapriso, Douala')).toBeInTheDocument();
    const u = userEvent.setup();
    await remplir(u);
    await u.click(screen.getByRole('button', { name: 'Envoyer ma commande' }));
    await waitFor(() => expect(emplacement()).toBe('/commandes/7'));
    const [[corps]] = appels(fetch, 'POST', '/api/commandes/');
    expect(corps).toEqual({ type_batiment: 'maison', surface_m2: 42.5, depuis_selection: true });
  });

  it('depuis la fiche produit : une ligne directe avec le design choisi', async () => {
    const fetch = simulerApi(routesClient({
      'GET /api/catalogue/produits/yd-306/': reponse(200, PRODUIT),
      'POST /api/commandes/': reponse(201, COMMANDE),
      'GET /api/commandes/7/': reponse(200, COMMANDE),
    }));
    rendreApp('/commandes/nouvelle?produit=yd-306&design=2');
    await screen.findByText('Sable coloré');
    const u = userEvent.setup();
    await u.selectOptions(screen.getByLabelText(/Type de bâtiment/), 'industrie');
    await u.click(screen.getByRole('button', { name: 'Envoyer ma commande' }));
    await waitFor(() => expect(emplacement()).toBe('/commandes/7'));
    expect(appels(fetch, 'POST', '/api/commandes/')[0][0]).toEqual({ type_batiment: 'industrie', lignes: [{ produit: 3, design: 2 }] });
  });

  it('contrôles locaux : type obligatoire, surface invalide, rien n’est envoyé', async () => {
    const fetch = simulerApi(routesClient({ 'GET /api/selection/': reponse(200, ELEMENTS) }));
    rendreApp('/commandes/nouvelle');
    await screen.findByText('Sable coloré');
    const u = userEvent.setup();
    await u.type(screen.getByLabelText('Surface (m²)'), '0');
    await u.click(screen.getByRole('button', { name: 'Envoyer ma commande' }));
    expect(await screen.findByText('Choisissez le type de bâtiment.')).toBeInTheDocument();
    expect(screen.getByText('Indiquez une surface valide, supérieure à 0.')).toBeInTheDocument();
    expect(appels(fetch, 'POST', '/api/commandes/')).toHaveLength(0);
  });

  it('403 adresse_incomplete du serveur : même message que l’adresse incomplète, lien vers /compte', async () => {
    simulerApi(routesClient({
      'GET /api/selection/': reponse(200, ELEMENTS),
      'POST /api/commandes/': reponse(403, { detail: 'Adresse incomplète.', code: 'adresse_incomplete' }),
    }));
    rendreApp('/commandes/nouvelle');
    await screen.findByText('Sable coloré');
    const u = userEvent.setup();
    await remplir(u);
    await u.click(screen.getByRole('button', { name: 'Envoyer ma commande' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Complétez votre adresse pour commander' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Compléter mon adresse' })).toHaveAttribute('href', '/compte');
  });

  it('429 : message de quota traduit, le formulaire reste', async () => {
    simulerApi(routesClient({
      'GET /api/selection/': reponse(200, ELEMENTS),
      'POST /api/commandes/': reponse(429, { detail: 'Request was throttled.' }),
    }));
    rendreApp('/commandes/nouvelle');
    await screen.findByText('Sable coloré');
    const u = userEvent.setup();
    await remplir(u);
    await u.click(screen.getByRole('button', { name: 'Envoyer ma commande' }));
    expect(await screen.findByText(/nombre de commandes autorisé pour aujourd/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Type de bâtiment/)).toBeInTheDocument();
  });

  it('erreur de champ du serveur affichée sous le champ', async () => {
    simulerApi(routesClient({
      'GET /api/selection/': reponse(200, ELEMENTS),
      'POST /api/commandes/': reponse(400, { surface_m2: ['Surface trop grande.'] }),
    }));
    rendreApp('/commandes/nouvelle');
    await screen.findByText('Sable coloré');
    const u = userEvent.setup();
    await remplir(u);
    await u.click(screen.getByRole('button', { name: 'Envoyer ma commande' }));
    await waitFor(() => expect(screen.getByLabelText('Surface (m²)')).toHaveAttribute('aria-invalid', 'true'));
  });

  it('sélection vide : aucun formulaire, invitation à choisir des produits', async () => {
    simulerApi(routesClient({ 'GET /api/selection/': reponse(200, { count: 0, elements: [] }) }));
    rendreApp('/commandes/nouvelle');
    expect(await screen.findByRole('heading', { name: 'Aucun produit à commander' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Envoyer ma commande' })).toBeNull();
  });

  it('produit hors ligne dans la sélection : envoi bloqué', async () => {
    simulerApi(routesClient({
      'GET /api/selection/': reponse(200, { count: 1, elements: [{ ...ELEMENTS.elements[0], disponible: false }] }),
    }));
    rendreApp('/commandes/nouvelle');
    await screen.findByText('Sable coloré');
    expect(screen.getByRole('button', { name: 'Envoyer ma commande' })).toBeDisabled();
  });
});
