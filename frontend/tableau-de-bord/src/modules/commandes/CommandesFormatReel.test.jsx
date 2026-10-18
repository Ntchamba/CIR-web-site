// Commandes (testeur, vague 2) : réponses relevées sur le vrai back-end (client de test DRF) : contrat avec lignes
// instantanées, historique avec motif, Proposition.reponse, ligne d'un produit retiré du catalogue, erreurs 400.
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { appels, page, rendre, reponse, simulerApi } from '@/test/api-simulee.jsx';

const CLIENT = {
  id: 2, nom_complet: 'Awa Nana', email: 'awa@x.cm', telephone: '+237 677 00 11 22', ville: 'Douala', quartier: 'Akwa',
  rue_ou_repere: 'Face pharmacie', langue: 'fr',
};
const ADRESSE = { ville: 'Douala', quartier: 'Akwa', rue_ou_repere: 'Face pharmacie' };
const LIGNES = [
  { id: 1, produit: { id: 1, slug: 'sol-autolissant-yd-500', reference: 'YD-500', nom: 'Sol autolissant', image: null }, design: { id: 1, nom: 'Gris', couleur: '#808080' } },
  { id: 2, produit: { id: 2, slug: 'primaire-yd-103', reference: 'YD-103', nom: 'Primaire', image: null }, design: null },
];
const BASE = {
  id: 1, reference: 'CIR-2026-0001', type_batiment: 'maison', surface_m2: '42.50', description: 'Salon', adresse: ADRESSE, lignes: LIGNES,
  montant_convenu: null, prix_m2_convenu: null, delai_convenu_jours: null, signe_le: null, propositions: [], historique: [],
  contrat: null, devis: [], action_requise: false, actions_possibles: [], client: CLIENT, notes_internes: '',
  cree_le: '2026-10-18T12:07:34.076126+01:00', modifie_le: '2026-10-18T12:07:34.076144+01:00',
};
const PROPOSITION_EQUIPE = {
  id: 1, auteur_role: 'equipe', auteur_nom: 'Jean Mbarga', prix_m2: '9000', total: '382500', delai_jours: 10, message: 'Offre',
  etat: 'remplacee', reponse: '', devis: null, peut_repondre: false, cree_le: '2026-10-18T12:07:34.205848+01:00',
  repondu_le: '2026-10-18T12:07:34.237648+01:00',
};
const PROPOSITION_CLIENT = {
  id: 2, auteur_role: 'client', auteur_nom: 'Awa Nana', prix_m2: null, total: '380000', delai_jours: null, message: 'Moins cher',
  etat: 'en_attente', reponse: '', devis: null, peut_repondre: true, cree_le: '2026-10-18T12:07:34.238387+01:00', repondu_le: null,
};
const NEGOCIATION = {
  ...BASE, etat: 'negociation', action_requise: true, actions_possibles: ['modifier', 'annuler', 'proposer'],
  propositions: [PROPOSITION_EQUIPE, PROPOSITION_CLIENT],
  historique: [{ de: 'nouvelle', vers: 'negociation', par: 'equipe', motif: null, cree_le: '2026-10-18T12:07:34.206731+01:00' }],
};
const SIGNEE = {
  ...BASE, etat: 'contrat_signe', montant_convenu: '380000', signe_le: '2026-10-18T12:07:34.270412+01:00',
  actions_possibles: ['annuler', 'demarrer_travaux'],
  propositions: [PROPOSITION_EQUIPE, { ...PROPOSITION_CLIENT, etat: 'acceptee', reponse: 'ok', peut_repondre: false }],
  historique: [
    { de: 'nouvelle', vers: 'negociation', par: 'equipe', motif: null, cree_le: '2026-10-18T12:07:34.206731+01:00' },
    { de: 'negociation', vers: 'contrat_signe', par: 'equipe', motif: 'ok', cree_le: '2026-10-18T12:07:34.271315+01:00' },
  ],
  contrat: {
    reference: 'CIR-2026-0001', signe_le: '2026-10-18T12:07:34.270412+01:00', accepte_par: 'equipe',
    client: { nom_complet: 'Awa Nana', email: 'awa@x.cm', telephone: '+237 677 00 11 22' }, adresse: ADRESSE,
    lignes: [
      { produit_nom: 'Sol autolissant', produit_reference: 'YD-500', design_nom: 'Gris' },
      { produit_nom: 'Primaire', produit_reference: 'YD-103', design_nom: null },
    ],
    montant: '380000', prix_m2: null, delai_jours: null, proposition: 2,
  },
};

const detail = (d) => [['GET', /\/api\/admin\/commandes\/1\/$/, d]];

describe('DetailCommande : contrat signé (format réel)', () => {
  it('montre le contrat avec lignes instantanées, adresse en objet et « accepté par »', async () => {
    simulerApi(detail(SIGNEE));
    rendre('/commandes/1');
    const contrat = (await screen.findByRole('heading', { name: 'Contrat' })).closest('section');
    expect(within(contrat).getByText('CIR-2026-0001')).toBeInTheDocument();
    expect(within(contrat).getByText('Face pharmacie, Akwa, Douala')).toBeInTheDocument();
    expect(within(contrat).getByText('Équipe')).toBeInTheDocument();
    expect(within(contrat).getByText(/380\s000 FCFA/)).toBeInTheDocument();
    expect(within(contrat).getByText('Sol autolissant · Gris')).toBeInTheDocument();
    expect(within(contrat).getByText('Primaire')).toBeInTheDocument();
    // prix_m2 et délai absents du contrat : tirets, jamais un prix inventé.
    expect(within(contrat).getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });

  it('contrat signé : démarrer ou annuler seulement ; ni formulaire de surface ni de proposition', async () => {
    simulerApi(detail(SIGNEE));
    rendre('/commandes/1');
    await screen.findByRole('heading', { level: 1, name: 'CIR-2026-0001' });
    expect(screen.getByRole('button', { name: 'Démarrer les travaux' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Annuler la commande' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Terminer la commande' })).toBeNull();
    expect(screen.queryByLabelText('Surface du chantier (m²)')).toBeNull();
    expect(screen.queryByRole('button', { name: /proposition/ })).toBeNull();
    // La frise annonce l'étape en cours.
    const frise = screen.getByRole('list', { name: 'Étapes de la commande' });
    const courante = within(frise).getAllByRole('listitem').filter((li) => li.getAttribute('aria-current') === 'step');
    expect(courante).toHaveLength(1);
    expect(courante[0]).toHaveTextContent('Contrat signé');
  });

  it('travaux en cours : « Terminer » demande une confirmation puis envoie etat=terminee', async () => {
    const travaux = { ...SIGNEE, etat: 'travaux', actions_possibles: ['terminer'] };
    const simule = simulerApi([
      ['POST', '/api/admin/commandes/1/etat/', { ...travaux, etat: 'terminee', actions_possibles: [] }],
      ...detail(travaux),
    ]);
    rendre('/commandes/1');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Terminer la commande' }));
    expect(appels(simule, 'POST', '/etat/')).toHaveLength(0);
    expect(screen.getByText(/ne pourra plus changer d'étape/)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Confirmer : terminer' }));
    await waitFor(() => expect(appels(simule, 'POST', '/etat/')).toHaveLength(1));
    expect(JSON.parse(appels(simule, 'POST', '/etat/')[0][1].body)).toEqual({ etat: 'terminee' });
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Terminer la commande' })).toBeNull());
    expect(screen.queryByRole('button', { name: 'Démarrer les travaux' })).toBeNull();
  });

  it('affiche le message 400 du serveur quand une transition est refusée', async () => {
    simulerApi([
      ['POST', '/api/admin/commandes/1/etat/', () => reponse(400, { detail: "Cette commande ne peut pas passer de l'étape « En négociation » à l'étape « Travaux en cours »." })],
      ...detail(SIGNEE),
    ]);
    rendre('/commandes/1');
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Démarrer les travaux' }));
    expect(await screen.findByText(/ne peut pas passer de l'étape/)).toBeInTheDocument();
  });
});

describe('DetailCommande : négociation (format réel)', () => {
  it('seule la proposition du client reçoit Accepter / Refuser (peut_repondre), l’ancienne offre de l’équipe non', async () => {
    simulerApi(detail(NEGOCIATION));
    rendre('/commandes/1');
    const liste = (await screen.findByRole('heading', { name: 'Négociation' })).closest('section');
    const cartes = within(liste).getAllByRole('listitem');
    expect(cartes).toHaveLength(2);
    expect(within(cartes[0]).queryByRole('button', { name: 'Accepter' })).toBeNull();
    expect(within(cartes[0]).getByText('Remplacée')).toBeInTheDocument();
    expect(within(cartes[1]).getByRole('button', { name: 'Accepter' })).toBeInTheDocument();
    expect(within(cartes[1]).getByRole('button', { name: 'Refuser' })).toBeInTheDocument();
    expect(within(cartes[1]).getByText(/380\s000 FCFA/)).toBeInTheDocument();
    // Prix au m² absent : aucune ligne « Prix au m² » (jamais de montant inventé).
    expect(within(cartes[1]).queryByText('Prix au m² (FCFA)')).toBeNull();
    expect(within(cartes[0]).getByText(/9\s000 FCFA/)).toBeInTheDocument();
    expect(within(cartes[0]).getByText('10 jours')).toBeInTheDocument();
  });

  it('accepter : confirmation, message facultatif envoyé, la réponse du serveur remplace la commande', async () => {
    const simule = simulerApi([
      ['POST', '/api/admin/commandes/1/propositions/2/accepter/', SIGNEE],
      ...detail(NEGOCIATION),
    ]);
    rendre('/commandes/1');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Accepter' }));
    expect(appels(simule, 'POST', 'accepter')).toHaveLength(0);
    await u.type(screen.getByLabelText('Message (facultatif)'), 'Merci');
    await u.click(screen.getByRole('button', { name: 'Confirmer : accepter' }));
    await waitFor(() => expect(appels(simule, 'POST', 'accepter')).toHaveLength(1));
    expect(JSON.parse(appels(simule, 'POST', 'accepter')[0][1].body)).toEqual({ message: 'Merci' });
    expect(await screen.findByRole('heading', { name: 'Contrat' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accepter' })).toBeNull();
    expect(screen.getAllByText(/380\s000 FCFA/).length).toBeGreaterThan(0);
  });

  it('refuser : confirmation puis POST refuser sans message vide', async () => {
    const simule = simulerApi([
      ['POST', '/api/admin/commandes/1/propositions/2/refuser/', { ...NEGOCIATION, propositions: [PROPOSITION_EQUIPE, { ...PROPOSITION_CLIENT, etat: 'refusee', peut_repondre: false }] }],
      ...detail(NEGOCIATION),
    ]);
    rendre('/commandes/1');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Refuser' }));
    expect(appels(simule, 'POST', 'refuser')).toHaveLength(0);
    await u.click(screen.getByRole('button', { name: 'Confirmer : refuser' }));
    await waitFor(() => expect(appels(simule, 'POST', 'refuser')).toHaveLength(1));
    expect(JSON.parse(appels(simule, 'POST', 'refuser')[0][1].body)).toEqual({});
    expect(await screen.findByText('Refusée')).toBeInTheDocument();
  });

  it('erreur 400 « detail » (aucun prix) et erreur de champ (délai) à la bonne place', async () => {
    const simule = simulerApi([
      ['POST', '/api/admin/commandes/1/propositions/', () => reponse(400, { delai_jours: ['Assurez-vous que cette valeur est supérieure ou égale à 1.'] })],
      ...detail(NEGOCIATION),
    ]);
    rendre('/commandes/1');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Faire une contre-proposition' }));
    await u.type(screen.getByLabelText('Total (FCFA)'), '390000');
    await u.type(screen.getByLabelText('Message'), 'Ok pour ce total');
    await u.click(screen.getByRole('button', { name: 'Envoyer la proposition' }));
    await waitFor(() => expect(appels(simule, 'POST', '/propositions/')).toHaveLength(1));
    expect(JSON.parse(appels(simule, 'POST', '/propositions/')[0][1].body)).toEqual({ total: 390000, message: 'Ok pour ce total' });
    expect(screen.getByLabelText('Délai (jours)')).toHaveAccessibleDescription(/supérieure ou égale à 1/);
  });

  it('les propositions invalides sont refusées avant l’envoi (délai 0, montant décimal)', async () => {
    const simule = simulerApi(detail(NEGOCIATION));
    rendre('/commandes/1');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Faire une contre-proposition' }));
    await u.type(screen.getByLabelText('Total (FCFA)'), '390000,5');
    await u.type(screen.getByLabelText('Délai (jours)'), '0');
    await u.click(screen.getByRole('button', { name: 'Envoyer la proposition' }));
    expect(screen.getByLabelText('Total (FCFA)')).toHaveAccessibleDescription(/nombre entier de FCFA/);
    expect(screen.getByLabelText('Délai (jours)')).toHaveAccessibleDescription(/1 au moins/);
    expect(appels(simule, 'POST', '/propositions/')).toHaveLength(0);
  });

  it("recharge la commande après une proposition (la commande passe en négociation côté serveur)", async () => {
    const nouvelle = { ...BASE, etat: 'nouvelle', action_requise: true, actions_possibles: ['modifier', 'annuler', 'proposer'] };
    let envoye = false;
    const simule = simulerApi([
      ['POST', '/api/admin/commandes/1/propositions/', () => { envoye = true; return reponse(201, { id: 1 }); }],
      ['GET', /\/api\/admin\/commandes\/1\/$/, () => reponse(200, envoye ? { ...NEGOCIATION, action_requise: false, propositions: [{ ...PROPOSITION_EQUIPE, etat: 'en_attente' }] } : nouvelle)],
    ]);
    rendre('/commandes/1');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Faire une proposition' }));
    await u.type(screen.getByLabelText('Prix au m² (FCFA)'), '9000');
    await u.click(screen.getByRole('button', { name: 'Envoyer la proposition' }));
    await waitFor(() => expect(appels(simule, 'GET', '/commandes/1/')).toHaveLength(2));
    expect(JSON.parse(appels(simule, 'POST', '/propositions/')[0][1].body)).toEqual({ prix_m2: 9000 });
    const frise = screen.getByRole('list', { name: 'Étapes de la commande' });
    await waitFor(() => expect(within(frise).getByText('En négociation').closest('li')).toHaveAttribute('aria-current', 'step'));
  });
});

describe('DetailCommande : motif d’annulation et réponses (le serveur les renvoie, l’équipe doit les voir)', () => {
  const ANNULEE = {
    ...BASE, etat: 'annulee', actions_possibles: [], action_requise: false,
    historique: [{ de: 'nouvelle', vers: 'annulee', par: 'client', motif: 'Je change de projet', cree_le: '2026-10-18T12:07:34.355837+01:00' }],
  };

  it('affiche le motif d’annulation saisi par le client (historique[].motif)', async () => {
    simulerApi(detail(ANNULEE));
    rendre('/commandes/1');
    await screen.findByRole('heading', { level: 1, name: 'CIR-2026-0001' });
    const historique = screen.getByText(/Historique des changements/).closest('details');
    fireEvent.click(historique.querySelector('summary'));
    expect(within(historique).getByText(/Je change de projet/)).toBeInTheDocument();
  });

  it('affiche le message de réponse du client à une proposition refusée (Proposition.reponse)', async () => {
    const refusee = { ...NEGOCIATION, propositions: [{ ...PROPOSITION_EQUIPE, etat: 'refusee', reponse: 'Trop cher pour nous' }] };
    simulerApi(detail(refusee));
    rendre('/commandes/1');
    await screen.findByRole('heading', { name: 'Négociation' });
    expect(screen.getByText(/Trop cher pour nous/)).toBeInTheDocument();
  });
});

describe('DetailCommande : produit retiré du catalogue et surface', () => {
  it('ligne d’un produit supprimé (id null, nom d’origine conservé par le serveur)', async () => {
    const retire = {
      ...BASE, etat: 'nouvelle', action_requise: true, actions_possibles: ['modifier', 'annuler', 'proposer'],
      lignes: [{ id: 5, produit: { id: null, slug: null, reference: 'YD-500', nom: 'Sol autolissant', image: null }, design: { id: null, nom: 'Gris', couleur: '' } }],
    };
    simulerApi(detail(retire));
    rendre('/commandes/1');
    const table = await screen.findByRole('table', { name: 'Produits et designs de la commande' });
    expect(within(table).getByText('Sol autolissant')).toBeInTheDocument();
    expect(within(table).getByText('Gris')).toBeInTheDocument();
  });

  it('vider la surface envoie null ; la virgule devient un point ; l’erreur 400 est sous le champ', async () => {
    const nouvelle = { ...BASE, etat: 'nouvelle', action_requise: true, actions_possibles: ['modifier', 'annuler', 'proposer'] };
    let n = 0;
    const simule = simulerApi([
      ['PATCH', /\/api\/admin\/commandes\/1\/$/, (u, o) => (n++ === 0
        ? reponse(400, { surface_m2: ['Un nombre valide est requis.'] })
        : reponse(200, { ...nouvelle, surface_m2: JSON.parse(o.body).surface_m2 }))],
      ...detail(nouvelle),
    ]);
    rendre('/commandes/1');
    const u = userEvent.setup();
    const champ = await screen.findByLabelText('Surface du chantier (m²)');
    expect(champ).toHaveValue('42.50');
    await u.clear(champ);
    await u.type(champ, '12,5');
    await u.click(screen.getByRole('button', { name: 'Enregistrer la surface' }));
    await waitFor(() => expect(screen.getByLabelText('Surface du chantier (m²)')).toHaveAccessibleDescription(/Un nombre valide est requis/));
    expect(JSON.parse(appels(simule, 'PATCH', '/commandes/1/')[0][1].body)).toEqual({ surface_m2: '12.5' });
    await u.clear(screen.getByLabelText('Surface du chantier (m²)'));
    await u.click(screen.getByRole('button', { name: 'Enregistrer la surface' }));
    await waitFor(() => expect(appels(simule, 'PATCH', '/commandes/1/')).toHaveLength(2));
    expect(JSON.parse(appels(simule, 'PATCH', '/commandes/1/')[1][1].body)).toEqual({ surface_m2: null });
  });
});

describe('Confirmations : accessibilité et limites du serveur', () => {
  it('le bloc de confirmation est un groupe nommé par sa question ; Annuler rend le focus au bouton', async () => {
    const nouvelle = { ...BASE, etat: 'nouvelle', action_requise: true, actions_possibles: ['annuler'] };
    simulerApi(detail(nouvelle));
    rendre('/commandes/1');
    const u = userEvent.setup();
    const declencheur = await screen.findByRole('button', { name: 'Annuler la commande' });
    await u.click(declencheur);
    const groupe = screen.getByRole('group', { name: /Annuler cette commande/ });
    expect(within(groupe).getByLabelText('Motif (facultatif)')).toHaveFocus();
    await u.click(within(groupe).getByRole('button', { name: 'Annuler' }));
    expect(screen.getByRole('button', { name: 'Annuler la commande' })).toHaveFocus();
  });

  // Le serveur limite le motif d'annulation à 500 caractères (MotifSerializer) : le champ doit le dire.
  it('le motif d’annulation est limité à 500 caractères comme côté serveur', async () => {
    const nouvelle = { ...BASE, etat: 'nouvelle', action_requise: true, actions_possibles: ['annuler'] };
    simulerApi(detail(nouvelle));
    rendre('/commandes/1');
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Annuler la commande' }));
    expect(screen.getByLabelText('Motif (facultatif)')).toHaveAttribute('maxlength', '500');
  });
});

describe('Liste des commandes (format réel)', () => {
  it('lit la page réelle du serveur : client imbriqué, surface en chaîne, montant null', async () => {
    simulerApi([
      ['GET', '/api/admin/commandes/resume/', { nouvelle: 1, negociation: 0, contrat_signe: 0, travaux: 0, terminee: 0, annulee: 0, total: 1, action_requise: 1 }],
      ['GET', '/api/admin/commandes/', page([{
        id: 1, reference: 'CIR-2026-0001', type_batiment: 'maison', etat: 'nouvelle', surface_m2: '42.50', nombre_lignes: 2,
        montant_convenu: null, client: { id: 2, nom_complet: 'Awa Nana', email: 'awa@x.cm', telephone: '+237 677 00 11 22', ville: 'Douala' },
        action_requise: true, modifie_le: '2026-10-18T12:07:34.076144+01:00', cree_le: '2026-10-18T12:07:34.076126+01:00',
      }])],
    ]);
    rendre('/commandes');
    const table = await screen.findByRole('table', { name: 'Liste des commandes' });
    const ligne = within(table).getAllByRole('row')[1];
    expect(within(ligne).getByText('2 produits')).toBeInTheDocument();
    expect(within(ligne).getByText('Awa Nana')).toBeInTheDocument();
    expect(within(ligne).getByText('Maison')).toBeInTheDocument();
    expect(within(ligne).getByText('Action requise')).toBeInTheDocument();
    // Montant non convenu : tiret, pas de 0 FCFA.
    expect(within(ligne).queryByText(/0 FCFA/)).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Action requise (1)' })).toBeInTheDocument();
  });

  it('pagination : « Page suivante » demande page=2 au serveur et garde les filtres', async () => {
    const simule = simulerApi([
      ['GET', '/api/admin/commandes/resume/', { nouvelle: 30, negociation: 0, contrat_signe: 0, travaux: 0, terminee: 0, annulee: 0, total: 30, action_requise: 0 }],
      ['GET', '/api/admin/commandes/', () => reponse(200, { count: 30, next: 'http://testserver/api/admin/commandes/?page=2', previous: null, results: [{
        id: 1, reference: 'CIR-2026-0001', type_batiment: 'maison', etat: 'nouvelle', surface_m2: null, nombre_lignes: 1, montant_convenu: null,
        client: { id: 2, nom_complet: 'Awa Nana', email: '', telephone: '', ville: '' }, action_requise: false, modifie_le: '2026-10-18T12:07:34Z', cree_le: '2026-10-18T12:07:34Z',
      }] })],
    ]);
    rendre('/commandes?etat=nouvelle');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Page suivante' }));
    await waitFor(() => expect(simule.mock.calls.some(([x]) => /etat=nouvelle/.test(String(x)) && /page=2/.test(String(x)))).toBe(true));
    expect(await screen.findByText('Page 2 sur 2')).toBeInTheDocument();
  });
});
