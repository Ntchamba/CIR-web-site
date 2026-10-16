// Fiche produit (testeur) : lecture de la réponse réelle de ProduitAdminSerializer (prix en chaîne, famille en id,
// épaisseur texte), corps envoyé (prix entier ou null, listes ordonnées), contrôles avant l'envoi.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { appels, page, rendre, reponse, simulerApi } from '@/test/api-simulee.jsx';

import { TEXTES_PRODUIT, validerProduit, versDonnees, versFormulaire } from './TiroirProduit.jsx';

// Réponse réelle du back-end (GET /api/admin/catalogue/produits/1/), relevée avec le client de test DRF.
const PRODUIT_REEL = {
  id: 1, famille: 1, reference: 'YD-500', nom: 'Sol autolissant', slug: 'sol-autolissant-yd-500', accroche: '',
  description: '', domaine_application: '', performances: '', preparation: '', methode_application: '', dosage: '',
  conditions_chantier: '', pour_maison: true, pour_industrie: false, pour_entreprise: false, pour_exterieur: false,
  prix: '12500', unite_prix: 'kg', en_ligne: true, a_la_une: false, est_nouveau: true, ordre: 3,
  cree_le: '2026-10-16T11:28:38.773600+01:00', modifie_le: '2026-10-16T11:28:38.773642+01:00', traductions: {},
  caracteristiques: [
    { libelle: 'Dureté', valeur: '3H', traductions: {}, langues_incompletes: ['en', 'zh', 'de', 'ja'] },
    { libelle: 'Séchage', valeur: '24 h', traductions: { en: { libelle: 'Drying' } }, langues_incompletes: [] },
  ],
  couches: [{ nom: 'Finition', epaisseur: '2 à 3 mm', traductions: { en: { nom: 'Top' } }, langues_incompletes: ['zh', 'de', 'ja'] }],
  images: [{ id: 3, url: 'http://testserver/media/catalogue/produits/a.webp', alt: 'x', ordre: 2, traductions: {}, langues_incompletes: [] }],
  designs: [{ id: 1, nom: 'Gris', image: null, couleur: '#AABBCC', ordre: 0, traductions: {}, langues_incompletes: [] }],
  langues_incompletes: ['en', 'zh', 'de', 'ja'],
};
const FAMILLES = [{ id: 1, nom: 'Sols autolissants', slug: 'sols', description: '', ordre: 0, traductions: {}, nombre_produits: 1, langues_incompletes: [] }];

describe('versFormulaire / versDonnees (format réel du back-end)', () => {
  it('lit le prix en chaîne, la famille en id et garde les listes dans leur ordre', () => {
    const form = versFormulaire(PRODUIT_REEL);
    expect(form.prix).toBe('12500');
    expect(form.famille).toBe('1');
    expect(form.unite_prix).toBe('kg');
    expect(form.ordre).toBe('3');
    expect(form.pour_maison).toBe(true);
    const donnees = versDonnees(form);
    expect(donnees.prix).toBe(12500);
    expect(donnees.famille).toBe(1);
    expect(donnees.caracteristiques).toEqual([
      { libelle: 'Dureté', valeur: '3H', traductions: {} },
      { libelle: 'Séchage', valeur: '24 h', traductions: { en: { libelle: 'Drying' } } },
    ]);
    expect(donnees.couches).toEqual([{ nom: 'Finition', epaisseur: '2 à 3 mm', traductions: { en: { nom: 'Top' } } }]);
    // Champs en lecture seule ou gérés par d'autres routes : jamais renvoyés.
    ['id', 'slug', 'images', 'designs', 'langues_incompletes', 'cree_le', 'modifie_le'].forEach((c) => expect(donnees).not.toHaveProperty(c));
    // Aucune clé locale (`cle`) ni `langues_incompletes` dans les lignes envoyées.
    donnees.caracteristiques.forEach((l) => expect(Object.keys(l).sort()).toEqual(['libelle', 'traductions', 'valeur']));
  });

  it('envoie tous les champs traduits du contrat', () => {
    const donnees = versDonnees(versFormulaire(PRODUIT_REEL));
    TEXTES_PRODUIT.forEach((c) => expect(donnees).toHaveProperty(c));
    expect(TEXTES_PRODUIT).toEqual(['nom', 'accroche', 'description', 'domaine_application', 'performances', 'preparation',
      'methode_application', 'dosage', 'conditions_chantier']);
  });

  it('un prix vide part en null (« Prix sur devis »), jamais en 0', () => {
    const form = { ...versFormulaire(PRODUIT_REEL), prix: '   ' };
    expect(versDonnees(form).prix).toBeNull();
    expect(validerProduit(form)).toEqual({});
  });

  it('refuse un prix décimal, négatif ou non numérique, une accroche trop longue, une famille absente', () => {
    const base = versFormulaire(PRODUIT_REEL);
    expect(validerProduit({ ...base, prix: '12,5' })).toHaveProperty('prix');
    expect(validerProduit({ ...base, prix: '-5' })).toHaveProperty('prix');
    expect(validerProduit({ ...base, prix: 'abc' })).toHaveProperty('prix');
    expect(validerProduit({ ...base, accroche: 'a'.repeat(201) })).toHaveProperty('accroche');
    expect(validerProduit({ ...base, famille: '' })).toHaveProperty('famille');
    expect(validerProduit({ ...base, prix: '12 500' })).toEqual({});
  });

  it('nouveau produit : en ligne par défaut, sans prix, famille par défaut', () => {
    const form = versFormulaire(null, 4);
    expect(form).toMatchObject({ famille: '4', prix: '', en_ligne: true, unite_prix: 'm2', caracteristiques: [], couches: [] });
  });
});

describe('TiroirProduit (fiche ouverte)', () => {
  it('ouvre la fiche réelle, affiche l’aperçu du prix et enregistre par PATCH JSON', async () => {
    const simule = simulerApi([
      ['GET', '/catalogue/familles/', FAMILLES],
      ['GET', /\/catalogue\/produits\/1\/$/, PRODUIT_REEL],
      ['GET', '/catalogue/produits/', page([PRODUIT_REEL])],
      ['PATCH', '/catalogue/produits/1/', (u, o) => ({ ...PRODUIT_REEL, ...JSON.parse(o.body), prix: null })],
    ]);
    rendre('/catalogue');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Sol autolissant' }));
    const tiroir = await screen.findByRole('dialog', { name: 'Sol autolissant' });
    expect(await within(tiroir).findByDisplayValue('12500')).toBeInTheDocument();
    expect(within(tiroir).getByText(/^Affiché sur le site : 12/)).toBeInTheDocument();
    expect(within(tiroir).getByDisplayValue('2 à 3 mm')).toBeInTheDocument();

    await u.clear(within(tiroir).getByLabelText(/^Prix en FCFA/));
    expect(within(tiroir).getByText('Affiché sur le site : Prix sur devis')).toBeInTheDocument();
    await u.click(within(tiroir).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(appels(simule, 'PATCH', '/produits/1/')).toHaveLength(1));
    const options = appels(simule, 'PATCH', '/produits/1/')[0][1];
    expect(options.body).not.toBeInstanceOf(FormData);
    expect(JSON.parse(options.body)).toMatchObject({ prix: null, unite_prix: 'kg', famille: 1 });
    expect(await within(tiroir).findByText('Modifications enregistrées.', { selector: 'p:not([role])' })).toBeInTheDocument();
  });

  it("affiche l'erreur du serveur sur une ligne de caractéristique (liste imbriquée)", async () => {
    simulerApi([
      ['GET', '/catalogue/familles/', FAMILLES],
      ['GET', /\/catalogue\/produits\/1\/$/, PRODUIT_REEL],
      ['GET', '/catalogue/produits/', page([PRODUIT_REEL])],
      ['PATCH', '/catalogue/produits/1/', () => reponse(400, { caracteristiques: [{}, { libelle: ['Assurez-vous que ce champ comporte au plus 120 caractères.'] }] })],
    ]);
    rendre('/catalogue');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Sol autolissant' }));
    const tiroir = await screen.findByRole('dialog', { name: 'Sol autolissant' });
    await within(tiroir).findByDisplayValue('12500');
    await u.click(within(tiroir).getByRole('button', { name: 'Enregistrer' }));
    expect(await within(tiroir).findByText('Assurez-vous que ce champ comporte au plus 120 caractères.')).toBeInTheDocument();
  });

  it('recharge les familles (nombre de produits) après la création d’un produit', async () => {
    const simule = simulerApi([
      ['GET', '/catalogue/familles/', FAMILLES],
      ['GET', '/catalogue/produits/', page([])],
      ['POST', '/catalogue/produits/', { ...PRODUIT_REEL, id: 2, nom: 'Primaire' }],
    ]);
    rendre('/catalogue');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Nouveau produit' }));
    const tiroir = screen.getByRole('dialog', { name: 'Nouveau produit' });
    await waitFor(() => expect(appels(simule, 'GET', '/catalogue/familles/')).toHaveLength(1));
    await u.type(within(tiroir).getByLabelText(/^Nom/), 'Primaire');
    await u.selectOptions(within(tiroir).getByLabelText(/^Famille/), '1');
    await u.click(within(tiroir).getByRole('button', { name: 'Créer le produit' }));
    await waitFor(() => expect(appels(simule, 'GET', '/catalogue/familles/')).toHaveLength(2));
  });
});
