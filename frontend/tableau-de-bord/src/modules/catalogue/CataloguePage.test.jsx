// Catalogue : liste filtrée, création d'un produit (prix facultatif, couches), erreurs 400, familles.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { appels, page, rendre, reponse, simulerApi } from '@/test/api-simulee.jsx';

import { versDonnees, versFormulaire } from './composants/TiroirProduit.jsx';

const FAMILLES = [
  { id: 1, nom: 'Sols autolissants', slug: 'sols', description: '', ordre: 1, traductions: {}, langues_incompletes: ['en', 'zh', 'de', 'ja'], nombre_produits: 1 },
  { id: 2, nom: 'Primaires', slug: 'primaires', description: '', ordre: 2, traductions: {}, langues_incompletes: [], nombre_produits: 0 },
];
const PRODUIT = {
  id: 10, famille: 1, reference: 'YD-500', nom: 'Sol autolissant', accroche: '', description: '', prix: null,
  unite_prix: 'm2', en_ligne: true, a_la_une: true, est_nouveau: false, ordre: 0, traductions: {},
  langues_incompletes: ['en'], caracteristiques: [], couches: [], images: [], designs: [],
};

describe('versDonnees', () => {
  it("envoie un prix null (« Prix sur devis ») et ignore les lignes vides", () => {
    const form = versFormulaire({ ...PRODUIT, couches: [{ nom: 'Finition', epaisseur: '1 mm', traductions: {} }] });
    form.couches.push({ cle: 'x', nom: ' ', epaisseur: '', traductions: {} });
    const donnees = versDonnees(form);
    expect(donnees.prix).toBeNull();
    expect(donnees.famille).toBe(1);
    expect(donnees.couches).toEqual([{ nom: 'Finition', epaisseur: '1 mm', traductions: {} }]);
  });
});

describe('CataloguePage', () => {
  it('liste les produits avec « Prix sur devis » et filtre par statut', async () => {
    const simule = simulerApi([
      ['GET', '/catalogue/familles/', FAMILLES],
      ['GET', '/catalogue/produits/', page([PRODUIT])],
    ]);
    rendre('/catalogue');
    const table = await screen.findByRole('table', { name: 'Liste des produits' });
    expect(within(table).getByText('Prix sur devis')).toBeInTheDocument();
    expect(within(table).getByText('Sols autolissants')).toBeInTheDocument();
    expect(within(table).getByText('Traductions à compléter : English')).toBeInTheDocument();
    await userEvent.setup().selectOptions(screen.getByLabelText('Statut'), '0');
    await waitFor(() => expect(appels(simule, 'GET', 'en_ligne=0').length).toBe(1));
  });

  it('crée un produit puis affiche les erreurs du serveur sous les champs', async () => {
    let essai = 0;
    const simule = simulerApi([
      ['GET', '/catalogue/familles/', FAMILLES],
      ['POST', '/catalogue/produits/', () => {
        essai += 1;
        return essai === 1 ? reponse(400, { reference: ['Cette référence existe déjà.'] })
          : reponse(201, { ...PRODUIT, id: 11, nom: 'Primaire YD-103', reference: 'YD-103', famille: 2 });
      }],
      ['GET', '/catalogue/produits/', page([])],
    ]);
    rendre('/catalogue');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Nouveau produit' }));
    const tiroir = screen.getByRole('dialog', { name: 'Nouveau produit' });
    await u.click(within(tiroir).getByRole('button', { name: 'Créer le produit' }));
    expect(within(tiroir).getByLabelText(/^Nom/)).toHaveAccessibleDescription('Indiquez le nom du produit.');
    expect(appels(simule, 'POST', '/produits/')).toHaveLength(0);

    await u.type(within(tiroir).getByLabelText(/^Nom/), 'Primaire YD-103');
    await u.selectOptions(within(tiroir).getByLabelText(/^Famille/), '2');
    await u.type(within(tiroir).getByLabelText('Référence'), 'YD-103');
    await u.click(within(tiroir).getByRole('button', { name: 'Ajouter une couche' }));
    await u.type(within(tiroir).getByLabelText('Couche (Couche 1)'), 'Primaire');
    await u.click(within(tiroir).getByRole('button', { name: 'Créer le produit' }));
    await waitFor(() => expect(within(tiroir).getByLabelText('Référence')).toHaveAccessibleDescription('Cette référence existe déjà.'));

    await u.click(within(tiroir).getByRole('button', { name: 'Créer le produit' }));
    expect(await within(tiroir).findByText(/Produit créé/, { selector: 'p:not([role])' })).toBeInTheDocument();
    const corps = JSON.parse(appels(simule, 'POST', '/produits/')[1][1].body);
    expect(corps).toMatchObject({ nom: 'Primaire YD-103', famille: 2, prix: null, couches: [{ nom: 'Primaire', epaisseur: '', traductions: {} }] });
    // Après la création, photos et designs deviennent disponibles.
    expect(within(tiroir).getByRole('group', { name: 'Photos' })).toBeInTheDocument();
    expect(within(tiroir).getByRole('group', { name: 'Designs' })).toBeInTheDocument();
  });

  it("refuse de supprimer une famille qui a des produits (message du serveur)", async () => {
    simulerApi([
      ['GET', '/catalogue/familles/', FAMILLES],
      ['DELETE', '/familles/1/', () => reponse(400, { detail: 'Cette famille contient encore des produits.' })],
    ]);
    rendre('/catalogue/familles');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Supprimer Sols autolissants' }));
    await u.click(screen.getByRole('button', { name: 'Confirmer la suppression' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cette famille contient encore des produits.');
    expect(screen.getByText('1 produit')).toBeInTheDocument();
  });
});
