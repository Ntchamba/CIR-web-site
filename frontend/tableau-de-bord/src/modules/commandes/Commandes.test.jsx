// Commandes (équipe) : liste (onglets, filtre, liens tel:/mailto:), détail (boutons selon actions_possibles,
// négociation selon peut_repondre, confirmations, notes internes à enregistrement explicite).
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { appels, page, rendre, reponse, simulerApi } from '@/test/api-simulee.jsx';

const RESUME = { nouvelle: 2, negociation: 1, contrat_signe: 0, travaux: 0, terminee: 4, annulee: 1, total: 8, action_requise: 3 };
const LIGNE = {
  id: 7, reference: 'CIR-2026-0007', type_batiment: 'maison', etat: 'negociation', surface_m2: '42.50', nombre_lignes: 2,
  montant_convenu: null, action_requise: true, modifie_le: '2026-10-17T10:00:00Z', cree_le: '2026-10-16T10:00:00Z',
  client: { id: 3, nom_complet: 'Awa Nana', email: 'awa@x.cm', telephone: '+237 677 00 11 22', ville: 'Douala' },
};

const DETAIL = {
  id: 7, reference: 'CIR-2026-0007', type_batiment: 'maison', etat: 'negociation', surface_m2: '42.50', description: 'Salon et couloir',
  adresse: { ville: 'Douala', quartier: 'Akwa', rue_ou_repere: 'Face pharmacie' },
  client: { id: 3, nom_complet: 'Awa Nana', email: 'awa@x.cm', telephone: '+237 677 00 11 22', ville: 'Douala', quartier: 'Bonapriso', rue_ou_repere: 'Rue 1', langue: 'en' },
  lignes: [{ id: 1, produit: { id: 4, slug: 's', reference: 'YD-500', nom: 'Sol autolissant', image: null }, design: { id: 2, nom: 'Gris', couleur: '#aabbcc' } }],
  montant_convenu: null, prix_m2_convenu: null, delai_convenu_jours: null, signe_le: null,
  propositions: [
    { id: 11, auteur_role: 'client', auteur_nom: 'Awa Nana', prix_m2: '9000', total: '382500', delai_jours: 10, message: 'Possible ?', etat: 'en_attente', devis: null, peut_repondre: true, cree_le: '2026-10-17T09:00:00Z', repondu_le: null },
  ],
  historique: [{ de: 'nouvelle', vers: 'negociation', par: 'client', cree_le: '2026-10-17T09:00:00Z' }],
  contrat: null, devis: [{ id: 21, reference: 'DEV-2026-0001', etat: 'brouillon', expire: false, total: '100000', envoye_le: null }],
  notes_internes: 'Appeler lundi', action_requise: true, actions_possibles: ['annuler', 'proposer', 'modifier'],
  cree_le: '2026-10-16T10:00:00Z', modifie_le: '2026-10-17T10:00:00Z',
};

describe('CommandesPage', () => {
  it('affiche les onglets avec leurs nombres, le tableau et les liens tel: / mailto:', async () => {
    const simule = simulerApi([
      ['GET', '/api/admin/commandes/resume/', RESUME],
      ['GET', '/api/admin/commandes/', page([LIGNE])],
    ]);
    rendre('/commandes');
    expect(await screen.findByRole('link', { name: 'CIR-2026-0007' })).toHaveAttribute('href', '/commandes/7');
    const onglets = screen.getByRole('tablist', { name: 'Étapes des commandes' });
    expect(await within(onglets).findByRole('tab', { name: /^Nouvelle\s*2$/ })).toBeInTheDocument();
    expect(within(onglets).getByRole('tab', { name: /^Toutes\s*8$/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('link', { name: '+237 677 00 11 22' })).toHaveAttribute('href', 'tel:+237677001122');
    expect(screen.getByRole('link', { name: 'awa@x.cm' })).toHaveAttribute('href', 'mailto:awa@x.cm');
    expect(screen.getByText('42,5 m²')).toBeInTheDocument();
    expect(screen.getByText('Action requise', { selector: 'span' })).toBeInTheDocument();
    expect(simule).toHaveBeenCalled();
  });

  it("filtre par étape (clavier) et par « action requise » en interrogeant le serveur", async () => {
    const simule = simulerApi([
      ['GET', '/api/admin/commandes/resume/', RESUME],
      ['GET', '/api/admin/commandes/', page([LIGNE])],
    ]);
    rendre('/commandes');
    await screen.findByRole('link', { name: 'CIR-2026-0007' });
    const u = userEvent.setup();
    const toutes = screen.getByRole('tab', { name: /^Toutes/ });
    toutes.focus();
    await u.keyboard('{ArrowRight}');
    await waitFor(() => expect(simule.mock.calls.some(([x]) => String(x).includes('etat=nouvelle'))).toBe(true));
    await u.click(screen.getByRole('checkbox', { name: /Action requise/ }));
    await waitFor(() => expect(simule.mock.calls.some(([x]) => String(x).includes('action_requise=1'))).toBe(true));
  });

  it('montre un état vide', async () => {
    simulerApi([['GET', '/api/admin/commandes/resume/', RESUME]]);
    rendre('/commandes');
    expect(await screen.findByText('Aucune commande pour le moment')).toBeInTheDocument();
  });
});

describe('DetailCommande', () => {
  const routes = (detail) => [
    ['GET', '/api/admin/commandes/7/', detail],
  ];

  it('montre le client (tel:, mailto:, langue), les lignes et le devis lié', async () => {
    simulerApi(routes(DETAIL));
    rendre('/commandes/7');
    expect(await screen.findByRole('heading', { level: 1, name: 'CIR-2026-0007' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'awa@x.cm' })).toHaveAttribute('href', 'mailto:awa@x.cm');
    expect(screen.getByText(/répondez en English/)).toBeInTheDocument();
    expect(screen.getByText('Sol autolissant')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'DEV-2026-0001' })).toHaveAttribute('href', '/devis/21');
    expect(screen.getByRole('link', { name: 'Créer un devis' })).toHaveAttribute('href', '/devis/nouveau?commande=7');
    expect(screen.getByRole('list', { name: 'Étapes de la commande' })).toBeInTheDocument();
  });

  it('les boutons suivent actions_possibles : ni démarrage ni fin quand le serveur ne les propose pas', async () => {
    simulerApi(routes(DETAIL));
    rendre('/commandes/7');
    await screen.findByRole('heading', { level: 1, name: 'CIR-2026-0007' });
    expect(screen.getByRole('button', { name: 'Annuler la commande' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Démarrer les travaux' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Terminer la commande' })).toBeNull();
  });

  it('démarre les travaux quand le serveur le permet', async () => {
    const apres = { ...DETAIL, etat: 'travaux', actions_possibles: ['terminer'], propositions: [] };
    const simule = simulerApi([
      ['POST', '/api/admin/commandes/7/etat/', apres],
      ...routes({ ...DETAIL, etat: 'contrat_signe', actions_possibles: ['demarrer_travaux', 'annuler'] }),
    ]);
    rendre('/commandes/7');
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Démarrer les travaux' }));
    await waitFor(() => expect(appels(simule, 'POST', '/etat/')).toHaveLength(1));
    expect(JSON.parse(appels(simule, 'POST', '/etat/')[0][1].body)).toEqual({ etat: 'travaux' });
    expect(await screen.findByRole('button', { name: 'Terminer la commande' })).toBeInTheDocument();
    expect(screen.getAllByRole('status').some((s) => s.textContent === 'Les travaux ont démarré.')).toBe(true);
  });

  it("annuler demande confirmation et envoie le motif", async () => {
    const simule = simulerApi([
      ['POST', '/api/admin/commandes/7/etat/', { ...DETAIL, etat: 'annulee', actions_possibles: [] }],
      ...routes(DETAIL),
    ]);
    rendre('/commandes/7');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Annuler la commande' }));
    expect(appels(simule, 'POST', '/etat/')).toHaveLength(0);
    await u.type(screen.getByLabelText('Motif (facultatif)'), 'Client injoignable');
    await u.click(screen.getByRole('button', { name: "Confirmer l'annulation" }));
    await waitFor(() => expect(appels(simule, 'POST', '/etat/')).toHaveLength(1));
    expect(JSON.parse(appels(simule, 'POST', '/etat/')[0][1].body)).toEqual({ etat: 'annulee', motif: 'Client injoignable' });
  });

  it('accepter une proposition passe par une confirmation', async () => {
    const signee = { ...DETAIL, etat: 'contrat_signe', action_requise: false, actions_possibles: ['demarrer_travaux'], propositions: [{ ...DETAIL.propositions[0], etat: 'acceptee', peut_repondre: false }] };
    const simule = simulerApi([
      ['POST', '/propositions/11/accepter/', signee],
      ...routes(DETAIL),
    ]);
    rendre('/commandes/7');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Accepter' }));
    expect(appels(simule, 'POST', 'accepter')).toHaveLength(0);
    expect(screen.getByText(/passera en « Contrat signé »/)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Confirmer : accepter' }));
    await waitFor(() => expect(appels(simule, 'POST', 'accepter')).toHaveLength(1));
    expect(await screen.findByRole('button', { name: 'Démarrer les travaux' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accepter' })).toBeNull();
  });

  it("pas de boutons de réponse sans peut_repondre ; pas de formulaire sans « proposer »", async () => {
    simulerApi(routes({ ...DETAIL, propositions: [{ ...DETAIL.propositions[0], peut_repondre: false }], actions_possibles: [] }));
    rendre('/commandes/7');
    await screen.findByRole('heading', { level: 1, name: 'CIR-2026-0007' });
    expect(screen.queryByRole('button', { name: 'Accepter' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Refuser' })).toBeNull();
    expect(screen.queryByRole('button', { name: /proposition/ })).toBeNull();
  });

  it("envoie une contre-proposition et affiche l'erreur 400 sous le champ", async () => {
    let n = 0;
    const simule = simulerApi([
      ['POST', '/api/admin/commandes/7/propositions/', () => (n++ === 0
        ? reponse(400, { total: ['Le total ne correspond pas au calcul.'] })
        : reponse(201, { id: 12 }))],
      ...routes(DETAIL),
    ]);
    rendre('/commandes/7');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Faire une contre-proposition' }));
    await u.click(screen.getByRole('button', { name: 'Envoyer la proposition' }));
    expect(await screen.findByText('Indiquez au moins un prix au m² ou un total.')).toBeInTheDocument();
    await u.type(screen.getByLabelText('Prix au m² (FCFA)'), '9500');
    await u.type(screen.getByLabelText('Total (FCFA)'), '1');
    await u.click(screen.getByRole('button', { name: 'Envoyer la proposition' }));
    expect(await screen.findByText('Le total ne correspond pas au calcul.')).toBeInTheDocument();
    await u.clear(screen.getByLabelText('Total (FCFA)'));
    await u.click(screen.getByRole('button', { name: 'Envoyer la proposition' }));
    await waitFor(() => expect(appels(simule, 'POST', '/propositions/')).toHaveLength(2));
    expect(JSON.parse(appels(simule, 'POST', '/propositions/')[1][1].body)).toEqual({ prix_m2: 9500 });
  });

  it('modifie la surface (PATCH) seulement si « modifier » est permis', async () => {
    const simule = simulerApi([['PATCH', '/api/admin/commandes/7/', { ...DETAIL, surface_m2: '50.00' }], ...routes(DETAIL)]);
    rendre('/commandes/7');
    const u = userEvent.setup();
    const champ = await screen.findByLabelText('Surface du chantier (m²)');
    await u.clear(champ);
    await u.type(champ, '50');
    await u.click(screen.getByRole('button', { name: 'Enregistrer la surface' }));
    await waitFor(() => expect(appels(simule, 'PATCH', '/commandes/7/')).toHaveLength(1));
    expect(JSON.parse(appels(simule, 'PATCH', '/commandes/7/')[0][1].body)).toEqual({ surface_m2: '50' });
  });

  it("les notes internes ne partent qu'au clic sur « Enregistrer les notes »", async () => {
    const simule = simulerApi([['PATCH', '/api/admin/commandes/7/', DETAIL], ...routes(DETAIL)]);
    rendre('/commandes/7');
    const u = userEvent.setup();
    const notes = await screen.findByLabelText('Notes');
    expect(notes).toHaveValue('Appeler lundi');
    expect(screen.getByRole('button', { name: 'Enregistrer les notes' })).toBeDisabled();
    await u.type(notes, ' puis devis');
    expect(appels(simule, 'PATCH', '/commandes/7/')).toHaveLength(0);
    await u.click(screen.getByRole('button', { name: 'Enregistrer les notes' }));
    await waitFor(() => expect(appels(simule, 'PATCH', '/commandes/7/')).toHaveLength(1));
    expect(JSON.parse(appels(simule, 'PATCH', '/commandes/7/')[0][1].body)).toEqual({ notes_internes: 'Appeler lundi puis devis' });
    expect(await screen.findByText('Notes enregistrées.', { selector: 'p' })).toBeInTheDocument();
  });

  it('affiche le contrat quand la commande est signée', async () => {
    simulerApi(routes({ ...DETAIL, etat: 'contrat_signe', actions_possibles: [], propositions: [], montant_convenu: '400000',
      contrat: { reference: 'CTR-1', signe_le: '2026-10-18T09:00:00Z', accepte_par: 'equipe', client: { nom_complet: 'Awa Nana' }, adresse: { ville: 'Douala' }, lignes: ['Sol autolissant · Gris'], montant: '400000', prix_m2: '9400', delai_jours: 12, proposition: 11 } }));
    rendre('/commandes/7');
    expect(await screen.findByRole('heading', { name: 'Contrat' })).toBeInTheDocument();
    expect(screen.getByText('CTR-1')).toBeInTheDocument();
    expect(screen.getAllByText(/400\s000 FCFA/).length).toBeGreaterThan(0);
  });

  it('commande introuvable', async () => {
    simulerApi([['GET', '/api/admin/commandes/7/', () => reponse(404, { detail: 'Introuvable.' })]]);
    rendre('/commandes/7');
    expect(await screen.findByRole('heading', { level: 1, name: 'Commande introuvable' })).toBeInTheDocument();
  });
});
