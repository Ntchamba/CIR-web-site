// Devis et demandes de rendu (testeur, vague 2) : réponses relevées sur le vrai back-end (client de test DRF) :
// lignes en chaînes décimales, `produit` en identifiant, aperçu `calculer/` (indice de ligne à partir de 0),
// 400 imbriquées, envoi d'un devis incomplet, demande de rendu sans commande.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { appels, page, rendre, reponse, simulerApi } from '@/test/api-simulee.jsx';

const COMMANDE = {
  id: 3, reference: 'CIR-2026-0003', surface_m2: '20.00', client: { id: 2, nom_complet: 'Awa Nana' },
  lignes: [{ id: 4, produit: { id: 1, slug: 'sol', reference: 'YD-500', nom: 'Sol autolissant', image: null }, design: null }],
};
const PRODUITS = page([
  { id: 1, nom: 'Sol autolissant', reference: 'YD-500', prix: '1800', unite_prix: 'kg' },
  { id: 2, nom: 'Primaire', reference: 'YD-103', prix: null, unite_prix: 'm2' },
]);
// Brouillon réel (POST /api/admin/devis/).
const BROUILLON = {
  id: 1, reference: 'DEV-2026-0001', commande: 3, commande_reference: 'CIR-2026-0003', etat: 'brouillon', expire: false, total: '39400',
  valide_jusqu_au: null, envoye_le: null, client: { id: 2, nom_complet: 'Awa Nana' }, validite_jours: 30, demande: null,
  cree_le: '2026-10-18T12:07:34.393082+01:00',
  lignes: [
    { id: 1, ordre: 0, type_ligne: 'materiau', libelle: 'Sol autolissant', surface_m2: '20.00', dosage_kg_m2: '0.400', quantite_kg: '8.00', prix_kg: '1800', prix_m2: null, montant: '14400', produit: 1, montant_forfait: null },
    { id: 2, ordre: 1, type_ligne: 'forfait', libelle: 'Transport', surface_m2: null, dosage_kg_m2: null, quantite_kg: null, prix_kg: null, prix_m2: null, montant: '25000', produit: null, montant_forfait: '25000' },
  ],
  notes: 'Merci', cree_par: { id: 1, nom_complet: 'Jean Mbarga' }, complet: true, modifie_le: '2026-10-18T12:07:34.393100+01:00',
};
const APERCU_COMPLET = {
  lignes: [
    { id: null, ordre: 0, type_ligne: 'materiau', libelle: '', surface_m2: '20.00', dosage_kg_m2: '0.400', quantite_kg: '8.00', prix_kg: '1800', prix_m2: null, montant: '14400', produit: 1, montant_forfait: null },
    { id: null, ordre: 1, type_ligne: 'forfait', libelle: 'Transport', surface_m2: null, dosage_kg_m2: null, quantite_kg: null, prix_kg: null, prix_m2: null, montant: '25000', produit: null, montant_forfait: '25000' },
  ],
  total: '39400', complet: true, erreurs: [],
};

// Les routes de `extra` passent avant celles par défaut (la première qui correspond répond).
const base = (extra = []) => simulerApi([
  ...extra,
  ['GET', '/api/admin/commandes/3/', COMMANDE],
  ['GET', '/api/admin/catalogue/produits/', PRODUITS],
]);

describe('EditeurDevis : brouillon existant (format réel)', () => {
  it('relit les lignes du serveur et les renvoie sans les déformer à l’enregistrement', async () => {
    const simule = base([
      ['GET', /\/api\/admin\/devis\/1\/$/, BROUILLON],
      ['POST', '/api/admin/devis/calculer/', APERCU_COMPLET],
      ['PATCH', /\/api\/admin\/devis\/1\/$/, BROUILLON],
    ]);
    rendre('/devis/1');
    const u = userEvent.setup();
    expect(await screen.findByLabelText('Dosage (kg/m²)')).toHaveValue('0.400');
    expect(screen.getByLabelText('Prix au kg (FCFA)')).toHaveValue('1800');
    expect(screen.getByLabelText('Montant du forfait (FCFA)')).toHaveValue('25000');
    expect(screen.getByLabelText('Message au client')).toHaveValue('Merci');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Envoyer au client' })).toBeEnabled());
    // Le total affiché vient de l'aperçu du serveur.
    expect(screen.getByText(/39\s400 FCFA/, { selector: 'strong' })).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));
    await waitFor(() => expect(appels(simule, 'PATCH', '/devis/1/')).toHaveLength(1));
    const corps = JSON.parse(appels(simule, 'PATCH', '/devis/1/')[0][1].body);
    expect(corps).toMatchObject({ validite_jours: 30, notes: 'Merci' });
    expect(corps.lignes[0]).toMatchObject({ type_ligne: 'materiau', produit: 1, surface_m2: '20.00', dosage_kg_m2: '0.400', prix_kg: '1800' });
    expect(corps.lignes[1]).toMatchObject({ type_ligne: 'forfait', libelle: 'Transport', montant_forfait: '25000' });
    // Champs calculés ou en lecture seule : jamais renvoyés (le serveur les recalcule).
    corps.lignes.forEach((l) => ['montant', 'quantite_kg', 'id', 'ordre'].forEach((c) => expect(l).not.toHaveProperty(c)));
    expect(await screen.findByText('Devis enregistré.', { selector: 'p' })).toBeInTheDocument();
  });

  it('place l’erreur de l’aperçu (ligne à partir de 0) sous la bonne ligne, et bloque l’envoi', async () => {
    base([
      ['GET', /\/api\/admin\/devis\/1\/$/, { ...BROUILLON, lignes: [BROUILLON.lignes[0], { ...BROUILLON.lignes[1], type_ligne: 'surface', montant_forfait: null, surface_m2: '20.00', montant: null }] }],
      ['POST', '/api/admin/devis/calculer/', { lignes: [{}, {}], total: '14400', complet: false, erreurs: [{ ligne: 1, champ: 'prix_m2', message: 'Le prix au m² est obligatoire.' }] }],
    ]);
    rendre('/devis/1');
    await screen.findByLabelText('Dosage (kg/m²)');
    const prixM2 = await screen.findByLabelText('Prix au m² (FCFA)');
    await waitFor(() => expect(prixM2).toHaveAccessibleDescription('Le prix au m² est obligatoire.'));
    // La première ligne n'a aucune erreur.
    expect(screen.getByLabelText('Prix au kg (FCFA)')).not.toHaveAccessibleDescription(/obligatoire/);
    expect(screen.getByRole('button', { name: 'Envoyer au client' })).toBeDisabled();
    expect(screen.getByText(/Devis incomplet/)).toBeInTheDocument();
  });

  it('un total à 0 (aperçu complet) interdit aussi l’envoi', async () => {
    base([
      ['GET', /\/api\/admin\/devis\/1\/$/, { ...BROUILLON, lignes: [{ ...BROUILLON.lignes[1], montant_forfait: '0', montant: '0' }] }],
      ['POST', '/api/admin/devis/calculer/', { lignes: [{}], total: '0', complet: true, erreurs: [] }],
    ]);
    rendre('/devis/1');
    await screen.findByLabelText('Montant du forfait (FCFA)');
    await waitFor(() => expect(screen.getByText(/0 FCFA/, { selector: 'strong' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Envoyer au client' })).toBeDisabled();
  });

  it('envoi refusé par le serveur : le message s’affiche dans la confirmation, le devis reste un brouillon', async () => {
    base([
      ['GET', /\/api\/admin\/devis\/1\/$/, BROUILLON],
      ['POST', '/api/admin/devis/calculer/', APERCU_COMPLET],
      ['PATCH', /\/api\/admin\/devis\/1\/$/, BROUILLON],
      ['POST', '/api/admin/devis/1/envoyer/', () => reponse(400, {
        detail: "Le devis est incomplet : renseignez toutes les surfaces et tous les prix avant de l'envoyer.",
        erreurs: [{ ligne: '0', champ: 'prix_m2', message: 'Le prix au m² est obligatoire.' }],
      })],
    ]);
    rendre('/devis/1');
    const u = userEvent.setup();
    const envoyer = await screen.findByRole('button', { name: 'Envoyer au client' });
    await waitFor(() => expect(envoyer).toBeEnabled());
    await u.click(envoyer);
    await u.click(screen.getByRole('button', { name: "Confirmer l'envoi" }));
    expect((await screen.findAllByText(/Le devis est incomplet/)).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Enregistrer le brouillon' })).toBeInTheDocument();
    expect(screen.queryByText(/n'est plus un brouillon/)).toBeNull();
  });

  it('supprime le brouillon après confirmation (DELETE) et revient à la liste', async () => {
    const simule = base([
      ['GET', /\/api\/admin\/devis\/1\/$/, BROUILLON],
      ['POST', '/api/admin/devis/calculer/', APERCU_COMPLET],
      ['DELETE', /\/api\/admin\/devis\/1\/$/, () => Promise.resolve(new Response(null, { status: 204 }))],
      ['GET', '/api/admin/devis/', page([])],
      ['GET', 'demandes-rendu/resume/', { nouvelle: 0, en_etude: 0, devis_envoye: 0, close: 0, total: 0 }],
    ]);
    rendre('/devis/1');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Supprimer DEV-2026-0001' }));
    expect(appels(simule, 'DELETE', '/devis/1/')).toHaveLength(0);
    await u.click(screen.getByRole('button', { name: 'Confirmer la suppression' }));
    await waitFor(() => expect(appels(simule, 'DELETE', '/devis/1/')).toHaveLength(1));
    expect(await screen.findByRole('heading', { level: 1, name: 'Devis' })).toBeInTheDocument();
  });
});

describe('EditeurDevis : nouveau devis', () => {
  // Si l'envoi échoue après la création du brouillon, un second clic ne doit pas créer un second brouillon.
  it('ne crée pas un deuxième devis quand l’envoi échoue puis est relancé', async () => {
    let creations = 0;
    const simule = base([
      ['POST', '/api/admin/devis/calculer/', APERCU_COMPLET],
      ['POST', /\/api\/admin\/devis\/$/, () => { creations += 1; return reponse(201, { ...BROUILLON, id: 10 + creations }); }],
      ['POST', /\/api\/admin\/devis\/\d+\/envoyer\/$/, () => reponse(400, { detail: 'La commande est terminée ou annulée.' })],
      ['PATCH', /\/api\/admin\/devis\/\d+\/$/, BROUILLON],
    ]);
    rendre('/devis/nouveau?commande=3');
    const u = userEvent.setup();
    const envoyer = await screen.findByRole('button', { name: 'Envoyer au client' });
    await waitFor(() => expect(envoyer).toBeEnabled());
    await u.click(envoyer);
    await u.click(screen.getByRole('button', { name: "Confirmer l'envoi" }));
    expect((await screen.findAllByText('La commande est terminée ou annulée.')).length).toBeGreaterThan(0);
    await u.click(screen.getByRole('button', { name: "Confirmer l'envoi" }));
    await waitFor(() => expect(appels(simule, 'POST', '/envoyer/').length).toBeGreaterThanOrEqual(2));
    expect(creations).toBe(1);
  });

  it('ligne d’un produit retiré du catalogue (id null) : ni « null » envoyé, ni plantage', async () => {
    base([
      ['GET', '/api/admin/commandes/3/', { ...COMMANDE, lignes: [{ id: 4, produit: { id: null, slug: null, reference: 'YD-500', nom: 'Sol autolissant', image: null }, design: null }] }],
      ['POST', '/api/admin/devis/calculer/', { lignes: [{}], total: '0', complet: false, erreurs: [] }],
    ]);
    rendre('/devis/nouveau?commande=3');
    const produit = await screen.findByLabelText('Produit du catalogue');
    expect(produit).toHaveValue('');
  });

  it('préremplit seulement ce que la commande sait : surface de la commande, aucun prix quand le catalogue n’en a pas', async () => {
    base([
      ['GET', '/api/admin/commandes/3/', { ...COMMANDE, lignes: [{ id: 4, produit: { id: 2, slug: 'p', reference: 'YD-103', nom: 'Primaire', image: null }, design: null }] }],
      ['POST', '/api/admin/devis/calculer/', { lignes: [{}], total: '0', complet: false, erreurs: [{ ligne: 0, champ: 'dosage_kg_m2', message: 'Le dosage est obligatoire.' }] }],
    ]);
    rendre('/devis/nouveau?commande=3');
    expect(await screen.findByLabelText('Prix au kg (FCFA)')).toHaveValue('');
    expect(screen.getByLabelText('Dosage (kg/m²)')).toHaveValue('');
    expect(screen.getByLabelText('Surface (m²)')).toHaveValue('20.00');
  });
});

describe('Devis envoyé ou accepté (lecture seule, format réel)', () => {
  const ENVOYE = {
    ...BROUILLON, etat: 'envoye', valide_jusqu_au: '2026-11-17', envoye_le: '2026-10-18T12:07:34.417891+01:00',
  };

  it('affiche les lignes, les montants et la validité du serveur ; aucun appel à calculer', async () => {
    const simule = base([['GET', /\/api\/admin\/devis\/1\/$/, ENVOYE]]);
    rendre('/devis/1');
    expect(await screen.findByText(/n'est plus un brouillon/)).toBeInTheDocument();
    expect(screen.getByText(/Valable jusqu'au/)).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Lignes du devis envoyé' });
    expect(within(table).getByText('Sol autolissant')).toBeInTheDocument();
    expect(within(table).getByText('8 kg')).toBeInTheDocument();
    expect(within(table).getByText(/14\s400 FCFA/)).toBeInTheDocument();
    expect(screen.getByText(/Total : 39\s400 FCFA/)).toBeInTheDocument();
    expect(screen.getByText('Merci')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Envoyer au client' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Supprimer DEV-2026-0001' })).toBeNull();
    expect(appels(simule, 'POST', 'calculer')).toHaveLength(0);
  });

  it('devis expiré : la pastille « Expiré » est affichée', async () => {
    base([['GET', /\/api\/admin\/devis\/1\/$/, { ...ENVOYE, expire: true }]]);
    rendre('/devis/1');
    expect(await screen.findByText('Expiré')).toBeInTheDocument();
  });
});

describe('Liste des devis et filtres (format réel)', () => {
  it('lit la page réelle (commande = identifiant) et filtre par état auprès du serveur', async () => {
    const simule = simulerApi([
      ['GET', 'demandes-rendu/resume/', { nouvelle: 0, en_etude: 0, devis_envoye: 0, close: 0, total: 0 }],
      ['GET', '/api/admin/devis/', page([{
        id: 1, reference: 'DEV-2026-0001', commande: 3, commande_reference: 'CIR-2026-0003', etat: 'brouillon', expire: false, total: '39400',
        valide_jusqu_au: null, envoye_le: null, client: { id: 2, nom_complet: 'Awa Nana' }, validite_jours: 30, demande: null, cree_le: '2026-10-18T12:07:34Z',
      }])],
    ]);
    rendre('/devis');
    const u = userEvent.setup();
    expect(await screen.findByRole('link', { name: 'CIR-2026-0003' })).toHaveAttribute('href', '/commandes/3');
    expect(within(screen.getByRole('table', { name: 'Liste des devis' })).getByText('Brouillon')).toBeInTheDocument();
    // Brouillon : pas de date d'envoi.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    await u.selectOptions(screen.getByLabelText('État'), 'brouillon');
    await waitFor(() => expect(simule.mock.calls.some(([x]) => /\/api\/admin\/devis\/\?etat=brouillon/.test(String(x)))).toBe(true));
  });
});

describe('Demandes de rendu (format réel)', () => {
  const DEMANDE = {
    id: 2, reference: 'REN-2026-0002', description: 'Je voudrais un rendu de mon salon complet', type_batiment: 'maison', surface_m2: null,
    produit: null, commande: null, images: [], etat: 'nouvelle', reponse_equipe: '', devis: [], cree_le: '2026-10-18T12:07:34.511214+01:00',
    client: { id: 2, nom_complet: 'Awa Nana', email: 'awa@x.cm', telephone: '+237 677 00 11 22' }, notes_internes: '',
    modifie_le: '2026-10-18T12:07:34.511232+01:00',
  };
  const ouvrir = async (demande, extra = []) => {
    const simule = simulerApi([
      ['GET', 'demandes-rendu/resume/', { nouvelle: 1, en_etude: 0, devis_envoye: 0, close: 0, total: 1 }],
      ['GET', /demandes-rendu\/2\/$/, demande],
      ...extra,
      ['GET', 'demandes-rendu/', page([demande])],
    ]);
    rendre('/devis?onglet=demandes');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'REN-2026-0002' }));
    const tiroir = await screen.findByRole('dialog');
    await within(tiroir).findByText('Je voudrais un rendu de mon salon complet', { selector: 'p' });
    return { simule, u, tiroir };
  };

  it('demande sans commande liée : explique pourquoi aucun devis ne peut être créé, coordonnées en tel: / mailto:', async () => {
    const { tiroir } = await ouvrir(DEMANDE);
    expect(within(tiroir).queryByRole('link', { name: 'Créer un devis' })).toBeNull();
    expect(within(tiroir).getByText(/Aucune commande liée/)).toBeInTheDocument();
    expect(within(tiroir).getByRole('link', { name: '+237 677 00 11 22' })).toHaveAttribute('href', 'tel:+237677001122');
    expect(within(tiroir).getByRole('link', { name: 'awa@x.cm' })).toHaveAttribute('href', 'mailto:awa@x.cm');
    expect(within(tiroir).getByRole('link', { name: 'Awa Nana' })).toHaveAttribute('href', '/clients/2');
  });

  it('demande liée à une commande, avec images et produit : lien de création et images en grand', async () => {
    const liee = {
      ...DEMANDE, commande: 3, surface_m2: '30.00', produit: { id: 1, slug: 'sol', reference: 'YD-500', nom: 'Sol autolissant' },
      images: [{ url: 'http://testserver/media/devis/demandes/a.webp', alt: '' }, { url: 'http://testserver/media/devis/demandes/b.webp', alt: '' }],
      devis: [{ id: 5, reference: 'DEV-2026-0005', commande: 3, commande_reference: 'CIR-2026-0003', etat: 'envoye', expire: false, total: '1000', valide_jusqu_au: '2026-11-17', envoye_le: '2026-10-18T12:00:00Z' }],
    };
    const { tiroir } = await ouvrir(liee);
    expect(within(tiroir).getByRole('link', { name: 'Créer un devis' })).toHaveAttribute('href', '/devis/nouveau?commande=3&demande=2');
    expect(within(tiroir).getByRole('link', { name: 'Ouvrir la commande' })).toHaveAttribute('href', '/commandes/3');
    const images = within(tiroir).getAllByRole('img');
    expect(images).toHaveLength(2);
    expect(images[0]).toHaveAttribute('alt', 'Image jointe 1');
    expect(within(tiroir).getByText('Sol autolissant')).toBeInTheDocument();
    expect(within(tiroir).getByRole('link', { name: 'DEV-2026-0005' })).toHaveAttribute('href', '/devis/5');
  });

  it('enregistre l’état et la réponse (PATCH) et les notes à part ; la liste suit', async () => {
    const { simule, u, tiroir } = await ouvrir(DEMANDE, [
      ['PATCH', /demandes-rendu\/2\/$/, (url, o) => ({ ...DEMANDE, ...JSON.parse(o.body) })],
    ]);
    await u.selectOptions(within(tiroir).getByLabelText('État'), 'en_etude');
    await u.type(within(tiroir).getByLabelText("Réponse de l'équipe"), 'On regarde');
    await u.click(within(tiroir).getByRole('button', { name: 'Enregistrer la réponse' }));
    await waitFor(() => expect(appels(simule, 'PATCH', 'demandes-rendu/2/')).toHaveLength(1));
    expect(JSON.parse(appels(simule, 'PATCH', 'demandes-rendu/2/')[0][1].body)).toEqual({ etat: 'en_etude', reponse_equipe: 'On regarde' });
    expect(await within(tiroir).findByText('Réponse enregistrée.', { selector: 'p' })).toBeInTheDocument();
    await u.type(within(tiroir).getByLabelText('Notes'), 'Client VIP');
    await u.click(within(tiroir).getByRole('button', { name: 'Enregistrer les notes' }));
    await waitFor(() => expect(appels(simule, 'PATCH', 'demandes-rendu/2/')).toHaveLength(2));
    expect(JSON.parse(appels(simule, 'PATCH', 'demandes-rendu/2/')[1][1].body)).toEqual({ notes_internes: 'Client VIP' });
  });

  it('erreur 400 sur l’état affichée sous le champ', async () => {
    const { u, tiroir } = await ouvrir(DEMANDE, [
      ['PATCH', /demandes-rendu\/2\/$/, () => reponse(400, { etat: ['« zzz » n\'est pas un choix valide.'] })],
    ]);
    await u.click(within(tiroir).getByRole('button', { name: 'Enregistrer la réponse' }));
    await waitFor(() => expect(within(tiroir).getByLabelText('État')).toHaveAccessibleDescription(/pas un choix valide/));
  });
});

// Correction du point « libellé » : le serveur renvoie `libelle` (saisi) et `libelle_affiche` (nom du produit si vide).
describe('EditeurDevis : libellé saisi et libellé affiché (format réel)', () => {
  const AVEC_PRODUIT = {
    ...BROUILLON,
    lignes: [
      { ...BROUILLON.lignes[0], libelle: '', libelle_affiche: 'Sol autolissant' },
      { ...BROUILLON.lignes[1], libelle: 'Transport', libelle_affiche: 'Transport' },
    ],
  };

  it('renvoie `libelle` tel que saisi : jamais le nom du produit (libelle_affiche) quand il est vide', async () => {
    const simule = base([
      ['GET', /\/api\/admin\/devis\/1\/$/, AVEC_PRODUIT],
      ['POST', '/api/admin/devis/calculer/', APERCU_COMPLET],
      ['PATCH', /\/api\/admin\/devis\/1\/$/, AVEC_PRODUIT],
    ]);
    rendre('/devis/1');
    const u = userEvent.setup();
    const libelles = await screen.findAllByLabelText('Libellé');
    expect(libelles[0]).toHaveValue('');
    expect(libelles[0]).toHaveAttribute('placeholder', 'Sol autolissant');
    expect(libelles[1]).toHaveValue('Transport');
    await u.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));
    await waitFor(() => expect(appels(simule, 'PATCH', '/devis/1/')).toHaveLength(1));
    const corps = JSON.parse(appels(simule, 'PATCH', '/devis/1/')[0][1].body);
    expect(corps.lignes[0]).not.toHaveProperty('libelle');
    expect(corps.lignes[0].produit).toBe(1);
    expect(corps.lignes[1].libelle).toBe('Transport');
    corps.lignes.forEach((l) => expect(l).not.toHaveProperty('libelle_affiche'));
  });

  it('produit retiré du catalogue (id null) : le nom d’origine devient le libellé, aucun produit envoyé', async () => {
    const simule = base([
      ['GET', '/api/admin/commandes/3/', { ...COMMANDE, lignes: [{ id: 4, produit: { id: null, slug: null, reference: 'YD-500', nom: 'Sol autolissant', image: null }, design: null }] }],
      ['POST', '/api/admin/devis/calculer/', { lignes: [{}], total: '0', complet: false, erreurs: [] }],
    ]);
    rendre('/devis/nouveau?commande=3');
    expect(await screen.findByLabelText('Libellé')).toHaveValue('Sol autolissant');
    await waitFor(() => expect(appels(simule, 'POST', 'calculer').length).toBeGreaterThan(0));
    const lignes = JSON.parse(appels(simule, 'POST', 'calculer')[0][1].body).lignes;
    expect(lignes[0]).toMatchObject({ libelle: 'Sol autolissant' });
    expect(lignes[0]).not.toHaveProperty('produit');
  });
});

describe('EditeurDevis : un échec d’envoi ne s’affiche qu’une fois', () => {
  it('une seule alerte dans le bloc de confirmation', async () => {
    base([
      ['GET', /\/api\/admin\/devis\/1\/$/, BROUILLON],
      ['POST', '/api/admin/devis/calculer/', APERCU_COMPLET],
      ['PATCH', /\/api\/admin\/devis\/1\/$/, BROUILLON],
      ['POST', '/api/admin/devis/1/envoyer/', () => reponse(400, { detail: 'Devis incomplet.', erreurs: [{ ligne: 1, champ: 'prix_m2', message: 'Le prix au m² est obligatoire.' }] })],
    ]);
    rendre('/devis/1');
    const u = userEvent.setup();
    const envoyer = await screen.findByRole('button', { name: 'Envoyer au client' });
    await waitFor(() => expect(envoyer).toBeEnabled());
    await u.click(envoyer);
    await u.click(screen.getByRole('button', { name: "Confirmer l'envoi" }));
    await screen.findByText('Devis incomplet.');
    expect(screen.getAllByText('Devis incomplet.')).toHaveLength(1);
  });
});

describe('Demande de rendu sans commande liée : choix d’une commande ouverte du client', () => {
  const DEMANDE = {
    id: 2, reference: 'REN-2026-0002', description: 'Je voudrais un rendu de mon salon complet', type_batiment: 'maison', surface_m2: null,
    produit: null, commande: null, images: [], etat: 'nouvelle', reponse_equipe: '', devis: [], cree_le: '2026-10-18T12:07:34+01:00',
    client: { id: 2, nom_complet: 'Awa Nana', email: 'awa@x.cm', telephone: '+237 677 00 11 22' }, notes_internes: '', modifie_le: '2026-10-18T12:07:34+01:00',
  };
  const COMMANDE_LISTE = (id, reference, etat) => ({
    id, reference, type_batiment: 'maison', etat, surface_m2: '20.00', nombre_lignes: 1, montant_convenu: null,
    client: { id: 2, nom_complet: 'Awa Nana', email: 'awa@x.cm', telephone: '+237 677 00 11 22', ville: 'Douala' },
    action_requise: false, modifie_le: '2026-10-18T12:00:00Z', cree_le: '2026-10-18T12:00:00Z',
  });
  const ouvrir = async (commandes) => {
    const simule = simulerApi([
      ['GET', 'demandes-rendu/resume/', { nouvelle: 1, en_etude: 0, devis_envoye: 0, close: 0, total: 1 }],
      ['GET', /demandes-rendu\/2\/$/, DEMANDE],
      ['GET', '/api/admin/commandes/?client=2', page(commandes)],
      ['GET', 'demandes-rendu/', page([DEMANDE])],
    ]);
    rendre('/devis?onglet=demandes');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'REN-2026-0002' }));
    const tiroir = await screen.findByRole('dialog');
    return { simule, u, tiroir };
  };

  it('interroge les commandes du client, ignore les terminées et annulées, et mène à l’éditeur avec la demande', async () => {
    const { simule, u, tiroir } = await ouvrir([
      COMMANDE_LISTE(3, 'CIR-2026-0003', 'negociation'), COMMANDE_LISTE(4, 'CIR-2026-0004', 'terminee'), COMMANDE_LISTE(5, 'CIR-2026-0005', 'annulee'),
    ]);
    const choix = await within(tiroir).findByLabelText('Commande du client');
    expect(appels(simule, 'GET', '/api/admin/commandes/?client=2').length).toBe(1);
    const options = within(choix).getAllByRole('option').map((o) => o.value);
    expect(options).toEqual(['', '3']);
    expect(within(tiroir).queryByRole('link', { name: 'Créer un devis' })).toBeNull();
    await u.selectOptions(choix, '3');
    expect(within(tiroir).getByRole('link', { name: 'Créer un devis' })).toHaveAttribute('href', '/devis/nouveau?commande=3&demande=2');
  });

  it('aucune commande ouverte : message explicatif, pas de lien de création', async () => {
    const { tiroir } = await ouvrir([COMMANDE_LISTE(4, 'CIR-2026-0004', 'terminee')]);
    expect(await within(tiroir).findByText(/Aucune commande/)).toBeInTheDocument();
    expect(within(tiroir).queryByRole('link', { name: 'Créer un devis' })).toBeNull();
  });
});

