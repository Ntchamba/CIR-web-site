// Détail d'une commande : frise des étapes, négociation complète (accepter, refuser, contre-proposer),
// boutons suivant uniquement `actions_possibles` et `peut_repondre`, annulation confirmée, contrat, devis.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { appels, reponse, rendreApp, routesClient, simulerApi } from '@/test/outils.jsx';

import { COMMANDE, COMMANDE_SIGNEE, PROPOSITION_EQUIPE } from './fixtures.js';

const CHEMIN = '/api/commandes/7/';
const ouvrir = (extra = {}) => {
  const fetch = simulerApi(routesClient({ [`GET ${CHEMIN}`]: reponse(200, COMMANDE), ...extra }));
  rendreApp('/commandes/7');
  return fetch;
};
const titre = () => screen.findByRole('heading', { level: 1, name: 'CIR-2026-0007' });

describe('DetailCommande : affichage', () => {
  it('référence, étape, produits traduits, adresse, description et réponse attendue', async () => {
    ouvrir();
    await titre();
    expect(screen.getAllByText('En négociation').length).toBeGreaterThan(0);
    expect(screen.getByText('Une réponse est attendue de votre part')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sable coloré' })).toHaveAttribute('href', '/catalogue/yd-306');
    expect(screen.getByText('Design : Gris anthracite')).toBeInTheDocument();
    expect(screen.getByText('Près de la pharmacie, Bonapriso, Douala')).toBeInTheDocument();
    expect(screen.getByText('Garage double, sol à refaire')).toBeInTheDocument();
    expect(screen.getByText(/42,5 m²/)).toBeInTheDocument();
  });

  it('frise : liste ordonnée, étape courante annoncée, étapes passées et à venir', async () => {
    ouvrir();
    await titre();
    const frise = screen.getByRole('list', { name: '' , hidden: false, current: undefined }).closest('ol') || null;
    expect(frise).toBeNull(); // la liste de produits n'est pas la frise : on cible la frise par son contenu
    const etapes = within(screen.getByRole('region', { name: 'Suivi de la commande' })).getAllByRole('listitem');
    // 5 étapes (l'historique est replié dans <details> mais ses lignes restent dans le DOM)
    const items = etapes.filter((li) => li.parentElement.tagName === 'OL');
    expect(items).toHaveLength(5);
    expect(items[1]).toHaveAttribute('aria-current', 'step');
    expect(within(items[1]).getByText('étape en cours')).toBeInTheDocument();
    expect(within(items[0]).getByText('étape terminée')).toBeInTheDocument();
    expect(within(items[2]).getByText('étape à venir')).toBeInTheDocument();
  });

  it('commande annulée : « Annulée » est l’étape courante, sans étape à venir', async () => {
    simulerApi(routesClient({
      [`GET ${CHEMIN}`]: reponse(200, {
        ...COMMANDE, etat: 'annulee', actions_possibles: [], action_requise: false,
        historique: [...COMMANDE.historique, { de: 'negociation', vers: 'annulee', par: 'client', cree_le: '2026-10-17T08:00:00Z' }],
      }),
    }));
    rendreApp('/commandes/7');
    await titre();
    const items = within(screen.getByRole('region', { name: 'Suivi de la commande' })).getAllByRole('listitem')
      .filter((li) => li.parentElement.tagName === 'OL');
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringContaining('Nouvelle'), expect.stringContaining('En négociation'), expect.stringContaining('Annulée'),
    ]);
    expect(items[2]).toHaveAttribute('aria-current', 'step');
    expect(screen.queryByText('étape à venir')).toBeNull();
  });

  it('commande introuvable (404) : message dédié', async () => {
    simulerApi(routesClient({ [`GET ${CHEMIN}`]: reponse(404, { detail: 'Introuvable.' }) }));
    rendreApp('/commandes/7');
    expect(await screen.findByRole('heading', { level: 1, name: 'Commande introuvable' })).toBeInTheDocument();
  });

  it('contrat signé : montant convenu, contrat et bouton imprimer ; plus aucune action', async () => {
    simulerApi(routesClient({ [`GET ${CHEMIN}`]: reponse(200, COMMANDE_SIGNEE) }));
    rendreApp('/commandes/7');
    await titre();
    expect(screen.getByRole('heading', { name: 'Montant convenu' })).toBeInTheDocument();
    expect(screen.getAllByText(/510\s000 FCFA/).length).toBeGreaterThan(1);
    expect(screen.getByRole('heading', { name: 'Contrat CTR-2026-0007' })).toBeInTheDocument();
    expect(screen.getByText('YD-306 Sable coloré · Gris anthracite')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Imprimer/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Annuler la commande' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Accepter' })).toBeNull();
    expect(screen.queryByRole('button', { name: /proposition/i })).toBeNull();
  });

  it('devis envoyés : aperçu avec lien vers la négociation', async () => {
    simulerApi(routesClient({
      [`GET ${CHEMIN}`]: reponse(200, {
        ...COMMANDE,
        devis: [{ id: 5, reference: 'DEV-2026-0005', commande: 7, commande_reference: 'CIR-2026-0007', etat: 'envoye', expire: false, total: '510000', valide_jusqu_au: '2026-11-15', envoye_le: '2026-10-16' }],
      }),
    }));
    rendreApp('/commandes/7');
    await titre();
    expect(screen.getByRole('heading', { name: 'Devis DEV-2026-0005' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Répondre dans la négociation' })).toHaveAttribute('href', '#negociation');
  });
});

describe('DetailCommande : négociation', () => {
  it('proposition de l’équipe en attente : Accepter, Refuser et Contre-proposer', async () => {
    ouvrir();
    await titre();
    const nego = screen.getByRole('region', { name: 'Négociation' });
    expect(within(nego).getByText(/510\s000 FCFA/)).toBeInTheDocument();
    expect(within(nego).getByText('12 000 FCFA / m²')).toBeInTheDocument();
    expect(within(nego).getByText('10 jours')).toBeInTheDocument();
    expect(within(nego).getByText('Pose comprise, produits Jiuye')).toBeInTheDocument();
    expect(within(nego).getByRole('button', { name: 'Accepter' })).toBeInTheDocument();
    expect(within(nego).getByRole('button', { name: 'Refuser' })).toBeInTheDocument();
    expect(within(nego).getByRole('button', { name: 'Contre-proposer' })).toBeInTheDocument();
  });

  it('accepter : confirmation d’abord (rien n’est envoyé), puis contrat signé annoncé', async () => {
    const fetch = ouvrir({ 'POST /api/commandes/7/propositions/11/accepter/': reponse(200, COMMANDE_SIGNEE) });
    await titre();
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Accepter' }));
    const confirmation = screen.getByRole('group', { name: 'Accepter cette proposition ?' });
    expect(confirmation).toHaveTextContent('total 510 000 FCFA, 12 000 FCFA / m², 10 jours');
    expect(appels(fetch, 'POST', '/api/commandes/7/propositions/11/accepter/')).toHaveLength(0);
    await u.type(within(confirmation).getByLabelText('Message (facultatif)'), 'Merci, on démarre');
    await u.click(within(confirmation).getByRole('button', { name: 'Accepter' }));
    await waitFor(() => expect(screen.getByRole('status', { name: '' , hidden: true })).toBeTruthy());
    expect(await screen.findByText(/Contrat signé\. Montant convenu : 510\s000 FCFA\./)).toBeInTheDocument();
    const [[corps]] = appels(fetch, 'POST', '/api/commandes/7/propositions/11/accepter/');
    expect(corps).toEqual({ message: 'Merci, on démarre' });
    // le détail renvoyé par le serveur remplace la page : plus de boutons de réponse
    expect(screen.queryByRole('button', { name: 'Refuser' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Contrat CTR-2026-0007' })).toBeInTheDocument();
  });

  it('accepter : « Retour » ferme la confirmation sans rien envoyer', async () => {
    const fetch = ouvrir();
    await titre();
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Accepter' }));
    await u.click(screen.getByRole('button', { name: 'Retour' }));
    expect(screen.queryByRole('group', { name: 'Accepter cette proposition ?' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Accepter' })).toBeInTheDocument();
    expect(appels(fetch, 'POST', '/api/commandes/7/propositions/11/accepter/')).toHaveLength(0);
  });

  it('accepter refusé par le serveur (400) : l’erreur s’affiche, la confirmation reste ouverte', async () => {
    ouvrir({ 'POST /api/commandes/7/propositions/11/accepter/': reponse(400, { detail: 'Précisez la surface.' }) });
    await titre();
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Accepter' }));
    await u.click(within(screen.getByRole('group')).getByRole('button', { name: 'Accepter' }));
    expect(await screen.findByText('Précisez la surface.')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Accepter cette proposition ?' })).toBeInTheDocument();
  });

  it('refuser : confirmation puis proposition refusée, la commande reste en négociation', async () => {
    const refusee = {
      ...COMMANDE, action_requise: false,
      propositions: [{ ...PROPOSITION_EQUIPE, etat: 'refusee', peut_repondre: false }],
    };
    const fetch = ouvrir({ 'POST /api/commandes/7/propositions/11/refuser/': reponse(200, refusee) });
    await titre();
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Refuser' }));
    const confirmation = screen.getByRole('group', { name: 'Refuser cette proposition ?' });
    await u.click(within(confirmation).getByRole('button', { name: 'Refuser' }));
    expect(await screen.findByText('Proposition refusée.')).toBeInTheDocument();
    expect(appels(fetch, 'POST', '/api/commandes/7/propositions/11/refuser/')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Refuser' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Accepter' })).toBeNull();
    expect(screen.getByText('Refusée')).toBeInTheDocument();
    // la négociation continue : le client peut faire une nouvelle proposition
    expect(screen.getByRole('button', { name: 'Faire une proposition' })).toBeInTheDocument();
  });

  it('contre-proposer : formulaire, contrôles locaux, envoi des seuls champs remplis, commande rechargée', async () => {
    let appelsDetail = 0;
    const apres = {
      ...COMMANDE, action_requise: false,
      propositions: [
        { id: 12, auteur_role: 'client', auteur_nom: 'Awa', prix_m2: '10000', total: '425000', delai_jours: 14, message: 'Budget serré', etat: 'en_attente', devis: null, peut_repondre: false, cree_le: '2026-10-17T09:00:00Z', repondu_le: null },
        { ...PROPOSITION_EQUIPE, etat: 'remplacee', peut_repondre: false },
      ],
    };
    const fetch = ouvrir({
      [`GET ${CHEMIN}`]: () => {
        appelsDetail += 1;
        return reponse(200, appelsDetail === 1 ? COMMANDE : apres);
      },
      'POST /api/commandes/7/propositions/': reponse(201, apres.propositions[0]),
    });
    await titre();
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Contre-proposer' }));
    const formulaire = screen.getByRole('form', { name: 'Contre-proposer' });

    // ni prix au m² ni total : refusé localement
    await u.click(within(formulaire).getByRole('button', { name: 'Envoyer la proposition' }));
    expect(await within(formulaire).findByText('Indiquez un prix au m² ou un total.')).toBeInTheDocument();
    expect(appels(fetch, 'POST', '/api/commandes/7/propositions/')).toHaveLength(0);

    await u.type(within(formulaire).getByLabelText('Prix au m²'), '10000');
    await u.type(within(formulaire).getByLabelText('Délai (jours)'), '14');
    await u.type(within(formulaire).getByLabelText('Message'), 'Budget serré');
    await u.click(within(formulaire).getByRole('button', { name: 'Envoyer la proposition' }));

    expect(await screen.findByText('Votre proposition a été envoyée.')).toBeInTheDocument();
    const [[corps]] = appels(fetch, 'POST', '/api/commandes/7/propositions/');
    expect(corps).toEqual({ prix_m2: 10000, delai_jours: 14, message: 'Budget serré' }); // pas de total envoyé : le serveur le calcule
    expect(await screen.findByText('Votre proposition attend la réponse de l’équipe CIR.'.replace('’', "'"))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accepter' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Modifier ma proposition' })).toBeInTheDocument();
    expect(screen.getByText('Propositions précédentes')).toBeInTheDocument();
  });

  it('proposition invalide côté serveur : erreur sous le champ concerné', async () => {
    ouvrir({ 'POST /api/commandes/7/propositions/': reponse(400, { total: ['Le total ne correspond pas au calcul.'] }) });
    await titre();
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Contre-proposer' }));
    const formulaire = screen.getByRole('form', { name: 'Contre-proposer' });
    await u.type(within(formulaire).getByLabelText('Total'), '1');
    await u.click(within(formulaire).getByRole('button', { name: 'Envoyer la proposition' }));
    const erreur = await within(formulaire).findAllByText('Le total ne correspond pas au calcul.');
    expect(erreur.length).toBeGreaterThan(0);
    expect(within(formulaire).getByLabelText('Total')).toHaveAttribute('aria-invalid', 'true');
  });

  it('actions masquées : sans actions_possibles ni peut_repondre, aucun bouton d’action', async () => {
    simulerApi(routesClient({
      [`GET ${CHEMIN}`]: reponse(200, {
        ...COMMANDE, actions_possibles: [], action_requise: false,
        propositions: [{ ...PROPOSITION_EQUIPE, peut_repondre: false }],
      }),
    }));
    rendreApp('/commandes/7');
    await titre();
    for (const nom of ['Accepter', 'Refuser', 'Contre-proposer', 'Faire une proposition', 'Modifier ma proposition', 'Annuler la commande', 'Modifier la commande']) {
      expect(screen.queryByRole('button', { name: nom })).toBeNull();
    }
  });

  it('peut_repondre sans « proposer » : réponse possible mais pas de contre-proposition', async () => {
    simulerApi(routesClient({ [`GET ${CHEMIN}`]: reponse(200, { ...COMMANDE, actions_possibles: ['annuler'] }) }));
    rendreApp('/commandes/7');
    await titre();
    expect(screen.getByRole('button', { name: 'Accepter' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Contre-proposer' })).toBeNull();
  });

  it('« proposer » seul (aucune proposition) : bouton « Faire une proposition »', async () => {
    simulerApi(routesClient({
      [`GET ${CHEMIN}`]: reponse(200, { ...COMMANDE, etat: 'nouvelle', propositions: [], actions_possibles: ['modifier', 'annuler', 'proposer'], action_requise: false }),
    }));
    rendreApp('/commandes/7');
    await titre();
    expect(screen.getByText(/Aucune proposition pour le moment/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Faire une proposition' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Modifier la commande' })).toBeInTheDocument();
  });
});

describe('DetailCommande : annuler et modifier', () => {
  it('annuler : confirmation avec motif, puis commande annulée annoncée', async () => {
    const annulee = { ...COMMANDE, etat: 'annulee', actions_possibles: [], action_requise: false };
    const fetch = ouvrir({ 'POST /api/commandes/7/annuler/': reponse(200, annulee) });
    await titre();
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Annuler la commande' }));
    const confirmation = screen.getByRole('group', { name: 'Annuler cette commande ?' });
    expect(appels(fetch, 'POST', '/api/commandes/7/annuler/')).toHaveLength(0);
    await u.type(within(confirmation).getByLabelText('Motif (facultatif)'), 'Projet reporté');
    await u.click(within(confirmation).getByRole('button', { name: 'Annuler la commande' }));
    expect(await screen.findByText('La commande a été annulée.')).toBeInTheDocument();
    const [[corps]] = appels(fetch, 'POST', '/api/commandes/7/annuler/');
    expect(corps).toEqual({ motif: 'Projet reporté' });
    expect(screen.queryByRole('button', { name: 'Annuler la commande' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Accepter' })).toBeNull();
  });

  it('annuler : « Garder la commande » n’envoie rien', async () => {
    const fetch = ouvrir();
    await titre();
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Annuler la commande' }));
    await u.click(screen.getByRole('button', { name: 'Garder la commande' }));
    expect(screen.queryByRole('group', { name: 'Annuler cette commande ?' })).toBeNull();
    expect(appels(fetch, 'POST', '/api/commandes/7/annuler/')).toHaveLength(0);
  });

  it('modifier (étape « Nouvelle ») : surface et description envoyées, commande rechargée', async () => {
    let n = 0;
    const nouvelle = { ...COMMANDE, etat: 'nouvelle', propositions: [], actions_possibles: ['modifier', 'annuler', 'proposer'], action_requise: false };
    const fetch = ouvrir({
      [`GET ${CHEMIN}`]: () => { n += 1; return reponse(200, n === 1 ? nouvelle : { ...nouvelle, surface_m2: '50.00' }); },
      'PATCH /api/commandes/7/': reponse(200, { ...nouvelle, surface_m2: '50.00' }),
    });
    await titre();
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Modifier la commande' }));
    const surface = screen.getByLabelText('Surface (m²)');
    await u.clear(surface);
    await u.type(surface, '50');
    await u.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Commande mise à jour.')).toBeInTheDocument();
    const [[corps]] = appels(fetch, 'PATCH', '/api/commandes/7/');
    expect(corps).toEqual({ surface_m2: 50, description: 'Garage double, sol à refaire' });
    expect(await screen.findByText(/50 m²/)).toBeInTheDocument();
  });
});
