// Paiements (équipe) : liste, filtres, volet de détail (numéro masqué, revérification), règlement hors ligne dans la fiche
// commande, colonne et filtre « paiement » des commandes, pastille du menu et mise à jour en direct (API et WebSocket simulés).
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { installerDirect } from '@/test/direct-simule.js';
import { appels, page, rendre, reponse, simulerApi } from '@/test/api-simulee.jsx';

const PAIEMENT = {
  id: 5, reference: 'PAY-2026-0005', commande: { id: 7, reference: 'CIR-2026-0007' }, client: { id: 3, nom_complet: 'Awa Nana' },
  montant: 150000, devise: 'XAF', mode: 'mobile', etat: 'anomalie', etat_libelle: 'Anomalie', operateur: 'MTN',
  telephone_masque: '+237 6** ** ** 22', telephone: '+237699001122', raison: 'montant_different', raison_libelle: 'Le montant ne correspond pas',
  reference_campay: 'cp-abc-123', reference_operateur: 'MP260001', saisi_par: null, mode_manuel: '', note: '',
  derniere_verification_le: '2026-10-19T09:30:00Z', cree_le: '2026-10-19T09:00:00Z', termine_le: null,
};
const REUSSI = { ...PAIEMENT, id: 6, reference: 'PAY-2026-0006', etat: 'reussi', etat_libelle: 'Réussi', raison: '', raison_libelle: '' };
const RESUME = { en_attente: 2, anomalies: 1, encaisse_mois: null };

describe('PaiementsPage', () => {
  it('affiche la liste avec les libellés du serveur, la pastille anomalie, et jamais le numéro complet', async () => {
    simulerApi([
      ['GET', '/api/admin/paiements/resume/', RESUME],
      ['GET', '/api/admin/paiements/', page([PAIEMENT, REUSSI])],
    ]);
    rendre('/paiements');
    expect(await screen.findByRole('button', { name: 'PAY-2026-0005' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'CIR-2026-0007' })[0]).toHaveAttribute('href', '/commandes/7');
    expect(screen.getAllByText('Awa Nana')).toHaveLength(2);
    expect(screen.getByText('Anomalie', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('À vérifier')).toBeInTheDocument();
    expect(screen.getByText('Réussi', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getAllByText(/150\s000 FCFA/)).toHaveLength(2);
    expect(document.body.textContent).not.toMatch(/699001122|\+237699/);
    // Résumé : pas de somme pour un membre simple.
    expect(screen.getByText('Anomalies à vérifier')).toBeInTheDocument();
    expect(screen.queryByText('Encaissé ce mois')).toBeNull();
  });

  it('affiche la somme encaissée du mois seulement si le serveur la donne', async () => {
    simulerApi([
      ['GET', '/api/admin/paiements/resume/', { ...RESUME, encaisse_mois: 480000 }],
      ['GET', '/api/admin/paiements/', page([REUSSI])],
    ]);
    rendre('/paiements');
    expect(await screen.findByText('Encaissé ce mois')).toBeInTheDocument();
    expect(screen.getByText(/480\s000 FCFA/)).toBeInTheDocument();
  });

  it('filtre par état, par mode et par recherche en interrogeant le serveur', async () => {
    const simule = simulerApi([
      ['GET', '/api/admin/paiements/resume/', RESUME],
      ['GET', '/api/admin/paiements/', page([PAIEMENT])],
    ]);
    rendre('/paiements');
    await screen.findByRole('button', { name: 'PAY-2026-0005' });
    const u = userEvent.setup();
    await u.selectOptions(screen.getByLabelText('État'), 'anomalie');
    await waitFor(() => expect(simule.mock.calls.some(([x]) => String(x).includes('etat=anomalie'))).toBe(true));
    await u.selectOptions(screen.getByLabelText('Mode'), 'manuel');
    await waitFor(() => expect(simule.mock.calls.some(([x]) => /etat=anomalie&mode=manuel|mode=manuel&etat=anomalie/.test(String(x)))).toBe(true));
    await u.type(screen.getByRole('searchbox', { name: 'Rechercher' }), 'Awa');
    await waitFor(() => expect(simule.mock.calls.some(([x]) => String(x).includes('search=Awa'))).toBe(true));
  });

  it('montre un état vide clair', async () => {
    simulerApi([['GET', '/api/admin/paiements/resume/', { en_attente: 0, anomalies: 0, encaisse_mois: null }]]);
    rendre('/paiements');
    expect(await screen.findByText('Aucun paiement pour le moment')).toBeInTheDocument();
  });

  it('ouvre le volet : numéro masqué, raison, vérification, puis revérifie auprès de CamPay', async () => {
    const maj = { ...PAIEMENT, etat: 'reussi', etat_libelle: 'Réussi', raison: '', raison_libelle: '', derniere_verification_le: '2026-10-20T10:00:00Z' };
    const simule = simulerApi([
      ['POST', '/api/admin/paiements/5/reverifier/', maj],
      ['GET', '/api/admin/paiements/resume/', RESUME],
      ['GET', '/api/admin/paiements/', page([PAIEMENT])],
    ]);
    rendre('/paiements');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'PAY-2026-0005' }));
    const volet = await screen.findByRole('dialog', { name: 'Paiement PAY-2026-0005' });
    expect(within(volet).getByText('+237 6** ** ** 22')).toBeInTheDocument();
    expect(within(volet).getByText('Le montant ne correspond pas')).toBeInTheDocument();
    expect(within(volet).getByText('MTN')).toBeInTheDocument();
    expect(within(volet).getByText('cp-abc-123')).toBeInTheDocument();
    expect(volet.textContent).not.toMatch(/699001122/);
    expect(within(volet).getByRole('link', { name: 'CIR-2026-0007' })).toHaveAttribute('href', '/commandes/7');
    await u.click(within(volet).getByRole('button', { name: 'Revérifier auprès de CamPay' }));
    await waitFor(() => expect(appels(simule, 'POST', '/reverifier/')).toHaveLength(1));
    await waitFor(() => expect(within(screen.getByRole('dialog')).queryByRole('button', { name: 'Revérifier auprès de CamPay' })).toBeNull());
    expect(within(screen.getByRole('dialog')).getByText('Le paiement a été revérifié auprès de CamPay.')).toBeInTheDocument();
  });

  it('pas de bouton « Revérifier » pour un paiement réussi', async () => {
    simulerApi([
      ['GET', '/api/admin/paiements/resume/', RESUME],
      ['GET', '/api/admin/paiements/', page([REUSSI])],
    ]);
    rendre('/paiements');
    await userEvent.setup().click(await screen.findByRole('button', { name: 'PAY-2026-0006' }));
    const volet = await screen.findByRole('dialog');
    expect(within(volet).queryByRole('button', { name: /Revérifier/ })).toBeNull();
  });

  it('un règlement hors ligne affiche le mode, la note et la personne qui l’a saisi, sans téléphone', async () => {
    const manuel = { ...REUSSI, id: 8, reference: 'PAY-2026-0008', mode: 'manuel', mode_manuel: 'virement', note: 'Reçu à la banque',
      saisi_par: { id: 2, nom_complet: 'Jean Mbarga' }, telephone_masque: '', operateur: '', reference_campay: '' };
    simulerApi([
      ['GET', '/api/admin/paiements/resume/', RESUME],
      ['GET', '/api/admin/paiements/', page([manuel])],
    ]);
    rendre('/paiements');
    await userEvent.setup().click(await screen.findByRole('button', { name: 'PAY-2026-0008' }));
    const volet = await screen.findByRole('dialog');
    expect(within(volet).getByText('Virement')).toBeInTheDocument();
    expect(within(volet).getByText('Reçu à la banque')).toBeInTheDocument();
    expect(within(volet).getByText('Jean Mbarga')).toBeInTheDocument();
    expect(within(volet).queryByText('Téléphone (masqué)')).toBeNull();
  });

  it('une trame « paiement_mis_a_jour » met la ligne à jour sans recharger la page', async () => {
    const direct = installerDirect();
    simulerApi([
      ['GET', '/api/admin/paiements/resume/', RESUME],
      ['GET', '/api/admin/paiements/', page([{ ...PAIEMENT, etat: 'en_attente', etat_libelle: 'En attente', raison: '', raison_libelle: '' }])],
    ]);
    rendre('/paiements');
    await screen.findByRole('button', { name: 'PAY-2026-0005' });
    await waitFor(() => expect(direct.instances).toHaveLength(1));
    direct.connecter();
    expect(screen.getAllByText('En attente', { selector: 'span' }).length).toBeGreaterThan(0);
    direct.recevoir({ type: 'paiement_mis_a_jour', paiement: { id: 5, etat: 'reussi', etat_libelle: 'Réussi' } });
    expect(await screen.findByText('Réussi', { selector: 'span' })).toBeInTheDocument();
    expect(screen.queryByText('En attente', { selector: 'span' })).toBeNull();
  });
});

describe('pastille du menu', () => {
  it('additionne les anomalies et les paiements en attente, et se recale sur la trame', async () => {
    const direct = installerDirect();
    let resume = { en_attente: 2, anomalies: 1, encaisse_mois: null };
    simulerApi([['GET', '/api/admin/paiements/resume/', () => resume]]);
    rendre('/');
    const nav = await screen.findByRole('navigation', { name: 'Menu du tableau de bord' });
    expect(await within(nav).findByRole('link', { name: /^Paiements\s+3 à traiter$/u })).toBeInTheDocument();
    await waitFor(() => expect(direct.instances).toHaveLength(1));
    direct.connecter();
    resume = { en_attente: 0, anomalies: 0, encaisse_mois: null };
    direct.recevoir({ type: 'paiement_mis_a_jour', paiement: { id: 5, etat: 'reussi', commande: { id: 7 } } });
    await waitFor(() => expect(within(nav).getByRole('link', { name: 'Paiements' })).toBeInTheDocument());
  });
});

const LIGNE_CMD = {
  id: 7, reference: 'CIR-2026-0007', type_batiment: 'maison', etat: 'contrat_signe', surface_m2: '42.50', nombre_lignes: 1,
  montant_convenu: 400000, montant_paye: 150000, reste_a_payer: 250000, statut_paiement: 'partiel', action_requise: false,
  modifie_le: '2026-10-17T10:00:00Z', cree_le: '2026-10-16T10:00:00Z',
  client: { id: 3, nom_complet: 'Awa Nana', email: 'awa@x.cm', telephone: '+237 677 00 11 22', ville: 'Douala' },
};
const DETAIL = {
  ...LIGNE_CMD, description: '', adresse: { ville: 'Douala', quartier: 'Akwa', rue_ou_repere: 'Face pharmacie' },
  client: { ...LIGNE_CMD.client, quartier: 'Akwa', rue_ou_repere: 'Rue 1', langue: 'fr' },
  lignes: [], propositions: [], historique: [], contrat: null, devis: [], notes_internes: '', actions_possibles: ['demarrer_travaux', 'annuler'],
};

describe('liste des commandes : paiement', () => {
  it('ajoute la colonne et le filtre « paiement »', async () => {
    const simule = simulerApi([
      ['GET', '/api/admin/commandes/resume/', { total: 1, action_requise: 0 }],
      ['GET', '/api/admin/commandes/', page([LIGNE_CMD, { ...LIGNE_CMD, id: 8, reference: 'CIR-2026-0008', etat: 'nouvelle', montant_convenu: null, reste_a_payer: null, statut_paiement: 'non_applicable' }])],
    ]);
    rendre('/commandes');
    await screen.findByRole('link', { name: 'CIR-2026-0007' });
    expect(screen.getByRole('columnheader', { name: 'Paiement' })).toBeInTheDocument();
    const lignes = screen.getAllByRole('row');
    expect(within(lignes[1]).getByText('Partiellement payé')).toBeInTheDocument();
    expect(within(lignes[2]).queryByText(/payé/i)).toBeNull();
    await userEvent.setup().selectOptions(screen.getByLabelText('Paiement'), 'non_paye');
    await waitFor(() => expect(simule.mock.calls.some(([x]) => String(x).includes('paiement=non_paye'))).toBe(true));
  });
});

describe('fiche commande : bloc Paiements et règlement hors ligne', () => {
  const routes = (detail, liste = [REUSSI]) => [
    ['GET', '/api/admin/paiements/', page(liste)],
    ['GET', '/api/admin/commandes/7/', detail],
  ];

  it('montre le montant convenu, payé, le reste, le statut et la liste', async () => {
    simulerApi(routes(DETAIL));
    rendre('/commandes/7');
    const bloc = (await screen.findByRole('heading', { level: 2, name: 'Paiements' })).closest('section');
    expect(within(bloc).getByText(/400\s000 FCFA/)).toBeInTheDocument();
    expect(within(bloc).getByText(/250\s000 FCFA/)).toBeInTheDocument();
    expect(within(bloc).getByText('Partiellement payé')).toBeInTheDocument();
    expect(await within(bloc).findByText('PAY-2026-0006')).toBeInTheDocument();
    expect(within(bloc).getByRole('button', { name: 'Enregistrer un règlement hors ligne' })).toBeInTheDocument();
  });

  it('avant le contrat signé : explication, pas de bouton', async () => {
    simulerApi(routes({ ...DETAIL, etat: 'negociation', montant_convenu: null, montant_paye: 0, reste_a_payer: null, statut_paiement: 'non_applicable' }, []));
    rendre('/commandes/7');
    expect(await screen.findByText("Le paiement s'ouvre après la signature du contrat.")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enregistrer un règlement hors ligne' })).toBeNull();
  });

  it('commande payée : pas de règlement possible', async () => {
    simulerApi(routes({ ...DETAIL, montant_paye: 400000, reste_a_payer: 0, statut_paiement: 'paye' }));
    rendre('/commandes/7');
    expect(await screen.findByText('Payé')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enregistrer un règlement hors ligne' })).toBeNull();
  });

  it('refuse un montant supérieur au reste sans rien envoyer', async () => {
    const simule = simulerApi(routes(DETAIL));
    rendre('/commandes/7');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Enregistrer un règlement hors ligne' }));
    await u.type(screen.getByLabelText(/^Montant \(FCFA\)/), '300000');
    await u.click(screen.getByRole('button', { name: 'Enregistrer le règlement' }));
    expect(await screen.findByText(/Le montant dépasse le reste à payer \(250\s000 FCFA\)/)).toBeInTheDocument();
    expect(appels(simule, 'POST', '/reglements/')).toHaveLength(0);
    // Montant non entier ou nul.
    await u.clear(screen.getByLabelText(/^Montant \(FCFA\)/));
    await u.type(screen.getByLabelText(/^Montant \(FCFA\)/), '12,5');
    await u.click(screen.getByRole('button', { name: 'Enregistrer le règlement' }));
    expect(await screen.findByText('Saisissez un montant entier en FCFA, supérieur à zéro.')).toBeInTheDocument();
    expect(appels(simule, 'POST', '/reglements/')).toHaveLength(0);
  });

  it('demande une confirmation avant d’envoyer, puis envoie le règlement et recharge la fiche', async () => {
    let paye = 150000;
    const simule = simulerApi([
      ['POST', '/api/admin/paiements/commandes/7/reglements/', () => { paye = 350000; return reponse(201, { ...REUSSI, id: 9, mode: 'manuel' }); }],
      ['GET', '/api/admin/paiements/', page([REUSSI])],
      ['GET', '/api/admin/commandes/7/', () => reponse(200, { ...DETAIL, montant_paye: paye, reste_a_payer: 400000 - paye })],
    ]);
    rendre('/commandes/7');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Enregistrer un règlement hors ligne' }));
    await u.type(screen.getByLabelText(/^Montant \(FCFA\)/), '200000');
    await u.selectOptions(screen.getByLabelText('Mode de règlement'), 'virement');
    await u.type(screen.getByLabelText('Note (facultatif)'), 'Virement du 19');
    await u.click(screen.getByRole('button', { name: 'Enregistrer le règlement' }));
    const confirmation = await screen.findByRole('group', { name: 'Confirmation du règlement' });
    expect(within(confirmation).getByText(/200\s000 FCFA \(Virement\)/)).toBeInTheDocument();
    expect(appels(simule, 'POST', '/reglements/')).toHaveLength(0);
    await u.click(within(confirmation).getByRole('button', { name: 'Confirmer le règlement' }));
    await waitFor(() => expect(appels(simule, 'POST', '/reglements/')).toHaveLength(1));
    expect(JSON.parse(appels(simule, 'POST', '/reglements/')[0][1].body)).toEqual({ montant: 200000, mode_manuel: 'virement', note: 'Virement du 19' });
    expect(await screen.findByText(/Règlement enregistré : 200\s000 FCFA\./)).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText(/50\s000 FCFA/).length).toBeGreaterThan(0));
    expect(screen.queryByRole('form', { name: 'Règlement hors ligne' })).toBeNull();
  });

  it('affiche l’erreur du serveur au champ montant (400) et un message clair pour un refus (409)', async () => {
    simulerApi([
      ['POST', '/api/admin/paiements/commandes/7/reglements/', () => reponse(400, { montant: ['Le montant dépasse le reste à payer.'] })],
      ...routes(DETAIL),
    ]);
    rendre('/commandes/7');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Enregistrer un règlement hors ligne' }));
    await u.type(screen.getByLabelText(/^Montant \(FCFA\)/), '100000');
    await u.click(screen.getByRole('button', { name: 'Enregistrer le règlement' }));
    await u.click(await screen.findByRole('button', { name: 'Confirmer le règlement' }));
    expect(await screen.findByText('Le montant dépasse le reste à payer.')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Confirmation du règlement' })).toBeNull();
  });

  it('une trame de paiement de cette commande recharge le bloc', async () => {
    const direct = installerDirect();
    let liste = [];
    const simule = simulerApi([
      ['GET', '/api/admin/paiements/', () => reponse(200, page(liste))],
      ['GET', '/api/admin/commandes/7/', DETAIL],
    ]);
    rendre('/commandes/7');
    await screen.findByText('Aucun paiement enregistré pour cette commande.');
    await waitFor(() => expect(direct.instances).toHaveLength(1));
    direct.connecter();
    liste = [REUSSI];
    direct.recevoir({ type: 'paiement_mis_a_jour', paiement: { id: 6, commande: { id: 7, reference: 'CIR-2026-0007' }, etat: 'reussi' } });
    expect(await screen.findByText('PAY-2026-0006')).toBeInTheDocument();
    // Une trame d'une autre commande ne recharge rien.
    const avant = appels(simule, 'GET', '?commande=7').length;
    direct.recevoir({ type: 'paiement_mis_a_jour', paiement: { id: 99, commande: { id: 12 }, etat: 'reussi' } });
    await new Promise((r) => setTimeout(r, 50));
    expect(appels(simule, 'GET', '?commande=7')).toHaveLength(avant);
  });
});
