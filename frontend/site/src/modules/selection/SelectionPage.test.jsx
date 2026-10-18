// Sélection : page (retrait, vidage confirmé, produit hors ligne), bouton d'ajout (visiteur, client, erreurs),
// compteur de l'en-tête.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { appels, emplacement, reponse, rendreApp, routesClient, simulerApi } from '@/test/outils.jsx';

const produit = (id, nom, extra = {}) => ({
  id, slug: `p-${id}`, reference: `R-${id}`, nom, famille: { slug: 'f', nom: 'Famille' }, image: null, prix: null, unite_prix: null, ...extra,
});
const ELEMENTS = {
  count: 2,
  elements: [
    { id: 1, produit: produit(3, 'Sable coloré', { prix: '8000', unite_prix: 'kg' }), design: { id: 2, nom: 'Gris', couleur: '#444', image: null }, ajoute_le: '2026-10-16', disponible: true },
    { id: 2, produit: produit(4, 'Primaire'), design: null, ajoute_le: '2026-10-16', disponible: true },
  ],
};

describe('SelectionPage', () => {
  it('visiteur : renvoyé vers la connexion', async () => {
    simulerApi();
    rendreApp('/selection');
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Se connecter' })).toBeInTheDocument());
  });

  it('liste : prix absent = « Prix sur devis », design, lien vers la commande', async () => {
    simulerApi(routesClient({ 'GET /api/selection/': reponse(200, ELEMENTS) }, { produits: [3, 4] }));
    rendreApp('/selection');
    const liste = await screen.findByRole('list', { name: 'Produits de votre sélection' });
    expect(within(liste).getAllByRole('listitem')).toHaveLength(2);
    expect(within(liste).getByText('Design : Gris')).toBeInTheDocument();
    expect(within(liste).getByText('Prix sur devis')).toBeInTheDocument();
    expect(within(liste).getByText(/8\s000 FCFA \/ kg/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Commander ma sélection' })).toHaveAttribute('href', '/commandes/nouvelle?depuis_selection=1');
  });

  it('retirer un élément : DELETE puis liste rechargée', async () => {
    let supprime = false;
    const fetch = simulerApi(routesClient({
      'GET /api/selection/': () => reponse(200, supprime ? { count: 1, elements: [ELEMENTS.elements[1]] } : ELEMENTS),
      'DELETE /api/selection/1/': () => { supprime = true; return reponse(204, null); },
    }, { produits: [3, 4] }));
    rendreApp('/selection');
    await screen.findByRole('list', { name: 'Produits de votre sélection' });
    await userEvent.click(screen.getByRole('button', { name: 'Retirer Sable coloré de la sélection' }));
    await waitFor(() => expect(screen.queryByText('Sable coloré')).toBeNull());
    expect(appels(fetch, 'DELETE', '/api/selection/1/')).toHaveLength(1);
    expect(screen.getByText('Sable coloré a été retiré de votre sélection.')).toBeInTheDocument();
  });

  it('vider : confirmation d’abord, puis état vide', async () => {
    let vide = false;
    const fetch = simulerApi(routesClient({
      'GET /api/selection/': () => reponse(200, vide ? { count: 0, elements: [] } : ELEMENTS),
      'DELETE /api/selection/': () => { vide = true; return reponse(204, null); },
    }, { produits: [3, 4] }));
    rendreApp('/selection');
    await screen.findByRole('list', { name: 'Produits de votre sélection' });
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Vider la sélection' }));
    expect(appels(fetch, 'DELETE', '/api/selection/')).toHaveLength(0);
    const confirmation = screen.getByRole('group', { name: 'Vider toute votre sélection ?' });
    await u.click(within(confirmation).getByRole('button', { name: 'Vider la sélection' }));
    expect(await screen.findByRole('heading', { name: 'Votre sélection est vide' })).toBeInTheDocument();
  });

  it('produit hors ligne : signalé, sans lien, commande impossible', async () => {
    simulerApi(routesClient({
      'GET /api/selection/': reponse(200, { count: 1, elements: [{ ...ELEMENTS.elements[1], disponible: false }] }),
    }, { produits: [4] }));
    rendreApp('/selection');
    expect(await screen.findByText("Ce produit n'est plus proposé.")).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Primaire' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Commander ma sélection' })).toBeDisabled();
  });

  it('en-tête : compteur de sélection pour un client, rien pour un visiteur', async () => {
    simulerApi(routesClient({}, { produits: [3, 4] }));
    rendreApp('/');
    expect(await screen.findByRole('link', { name: 'Ma sélection : 2 éléments' })).toHaveAttribute('href', '/selection');
  });

  it('en-tête : pas de lien de sélection pour un visiteur', async () => {
    simulerApi();
    rendreApp('/');
    await screen.findByRole('link', { name: 'Se connecter' });
    expect(screen.queryByRole('link', { name: /Ma sélection/ })).toBeNull();
  });
});

describe('BoutonSelection (fiche produit)', () => {
  const FICHE = {
    ...produit(3, 'Sable coloré'), accroche: '', usages: [], est_nouveau: false, a_la_une: false, images: [],
    designs: [{ id: 2, nom: 'Gris', image: null, couleur: '#888' }], caracteristiques: [], couches: [],
    description: '', domaine_application: '', performances: '',
    mise_en_oeuvre: { preparation: '', methode_application: '', dosage: '', conditions_chantier: '' },
  };

  it('visiteur : le bouton mène à la connexion avec ?suite= sur la fiche', async () => {
    simulerApi({ 'GET /api/catalogue/produits/p-3/': reponse(200, FICHE) });
    rendreApp('/catalogue/p-3');
    const lien = await screen.findByRole('link', { name: 'Ajouter Sable coloré à ma sélection' });
    expect(lien).toHaveAttribute('href', '/connexion?suite=%2Fcatalogue%2Fp-3');
  });

  it('client : ajoute le produit et le design choisi, annonce le résultat', async () => {
    const fetch = simulerApi(routesClient({
      'GET /api/catalogue/produits/p-3/': reponse(200, FICHE),
      'POST /api/selection/': reponse(201, { id: 9 }),
    }));
    rendreApp('/catalogue/p-3');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('radio', { name: /Gris/ }));
    await u.click(screen.getByRole('button', { name: 'Ajouter Sable coloré à ma sélection' }));
    expect(await screen.findByText('Ajouté à votre sélection.')).toBeInTheDocument();
    expect(appels(fetch, 'POST', '/api/selection/')[0][0]).toEqual({ produit: 3, design: 2 });
    expect(screen.getByRole('link', { name: 'Commander' }))
      .toHaveAttribute('href', '/commandes/nouvelle?produit=p-3&design=2');
  });

  it('refus du serveur (400, 50 éléments) : message affiché', async () => {
    simulerApi(routesClient({
      'GET /api/catalogue/produits/p-3/': reponse(200, FICHE),
      'POST /api/selection/': reponse(400, { detail: 'Sélection pleine (50 éléments).' }),
    }));
    rendreApp('/catalogue/p-3');
    await userEvent.click(await screen.findByRole('button', { name: 'Ajouter Sable coloré à ma sélection' }));
    expect(await screen.findByText('Sélection pleine (50 éléments).')).toBeInTheDocument();
  });

  it('compte de l’équipe : ni sélection ni bouton Commander', async () => {
    simulerApi(routesClient({ 'GET /api/catalogue/produits/p-3/': reponse(200, FICHE) }, {
      utilisateur: { ...JSON.parse('{"id":2,"email":"e@cir.cm","nom_complet":"Equipe","role":"admin","est_equipe":true,"adresse_complete":true}') },
    }));
    rendreApp('/catalogue/p-3');
    await screen.findByRole('heading', { level: 1, name: 'Sable coloré' });
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Se connecter' })).toBeNull());
    expect(screen.queryByRole('button', { name: /ma sélection/ })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Commander' })).toBeNull();
  });
});

describe('BoutonSelection (carte du catalogue)', () => {
  it('produit déjà sélectionné : lien « Dans ma sélection »', async () => {
    simulerApi(routesClient({
      'GET /api/catalogue/produits/': reponse(200, { count: 1, next: null, previous: null, results: [produit(3, 'Sable coloré', { usages: [], accroche: '' })] }),
      'GET /api/catalogue/familles/': reponse(200, []),
    }, { produits: [3] }));
    rendreApp('/catalogue');
    expect(await screen.findByRole('link', { name: 'Dans ma sélection' })).toHaveAttribute('href', '/selection');
    expect(emplacement()).toBe('/catalogue');
  });
});
