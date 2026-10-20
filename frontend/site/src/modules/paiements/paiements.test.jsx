// Paiements du client (BF-10, BF-12) : API et WebSocket simulés. Le serveur est seul juge de l'état d'un paiement.
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  appels, emplacement, page, reponse, rendreApp, routesClient, simulerApi, simulerDirect,
} from '@/test/outils.jsx';

import { COMMANDE, COMMANDE_SIGNEE, PAIEMENT } from '@/modules/commandes/fixtures.js';

import { adresseSure, rediriger } from './navigation.js';

vi.mock('./navigation.js', async (original) => ({ ...(await original()), rediriger: vi.fn() }));

const ROUTES_BASE = {
  'GET /api/messagerie/non-lus/': reponse(200, { non_lus: 0 }),
  'GET /api/notifications/non-lues/': reponse(200, { count: 0 }),
  'GET /api/appels/disponibilite/': reponse(200, { configure: false, equipe_en_ligne: false }),
};

function installer(routes = {}, { configure = true, commande = COMMANDE_SIGNEE, paiements = [] } = {}) {
  return simulerApi(routesClient({
    ...ROUTES_BASE,
    'GET /api/commandes/7/': reponse(200, commande),
    'GET /api/paiements/disponibilite/': reponse(200, { configure }),
    'GET /api/paiements/': reponse(200, page(paiements)),
    ...routes,
  }));
}

const enAttente = (extra = {}) => ({ ...PAIEMENT, ...extra });
const reussi = (extra = {}) => ({ ...PAIEMENT, etat: 'reussi', etat_libelle: 'Réussi', termine_le: '2026-10-20T10:00:00Z', ...extra });

/** Zone d'attente annoncée (le gabarit du site a d'autres zones role=status). */
const zoneAttente = () => waitFor(() => {
  const zone = screen.getAllByRole('status').find((n) => /téléphone|page de paiement/.test(n.textContent));
  expect(zone).toBeTruthy();
  return zone;
});

async function ouvrirPaiement(chemin = '/commandes/7/payer') {
  const direct = simulerDirect();
  rendreApp(chemin);
  return direct;
}

describe('BlocPaiement dans le détail de la commande', () => {
  it('montant convenu, déjà payé, reste, statut et bouton « Payer » quand tout est réuni', async () => {
    installer({}, { commande: { ...COMMANDE_SIGNEE, montant_paye: 200000, reste_a_payer: 310000, statut_paiement: 'partiel' } });
    rendreApp('/commandes/7');
    const bloc = (await screen.findByRole('heading', { name: 'Paiement' })).closest('section');
    expect(within(bloc).getByText('Payé en partie')).toBeInTheDocument();
    expect(within(bloc).getByText('Déjà payé').nextSibling).toHaveTextContent(/200\s?000 FCFA/);
    expect(within(bloc).getByText('Reste à payer').nextSibling).toHaveTextContent(/310\s?000 FCFA/);
    expect(await within(bloc).findByRole('link', { name: 'Payer' })).toHaveAttribute('href', '/commandes/7/payer');
  });

  it('bouton masqué et explication claire si le paiement n’est pas configuré', async () => {
    installer({}, { configure: false });
    rendreApp('/commandes/7');
    await screen.findByRole('heading', { name: 'Paiement' });
    expect(await screen.findByText(/Paiement en ligne bientôt disponible/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Payer' })).toBeNull();
  });

  it('si la disponibilité est en erreur, aucun bouton et aucune erreur bloquante', async () => {
    installer({ 'GET /api/paiements/disponibilite/': reponse(503, { detail: 'x', code: 'paiements_non_configures' }) });
    rendreApp('/commandes/7');
    await screen.findByRole('heading', { name: 'Paiement' });
    expect(screen.queryByRole('link', { name: 'Payer' })).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'CIR-2026-0007' })).toBeInTheDocument();
  });

  it('avant le contrat signé : pas de bouton, explication, aucun montant inventé', async () => {
    installer({}, { commande: COMMANDE });
    rendreApp('/commandes/7');
    const bloc = (await screen.findByRole('heading', { name: 'Paiement' })).closest('section');
    expect(within(bloc).getByText('Le paiement sera possible après la signature du contrat.')).toBeInTheDocument();
    expect(within(bloc).queryByRole('link', { name: 'Payer' })).toBeNull();
    expect(within(bloc).queryByText('Reste à payer')).toBeNull();
  });

  it('commande payée : pas de bouton ; liste des paiements avec reçu, numéro masqué seulement', async () => {
    installer({}, {
      commande: { ...COMMANDE_SIGNEE, etat: 'travaux', montant_paye: 510000, reste_a_payer: 0, statut_paiement: 'paye' },
      paiements: [reussi()],
    });
    rendreApp('/commandes/7');
    const bloc = (await screen.findByRole('heading', { name: 'Paiement' })).closest('section');
    expect(within(bloc).getByText('Cette commande est entièrement payée.')).toBeInTheDocument();
    expect(within(bloc).queryByRole('link', { name: 'Payer' })).toBeNull();
    expect(await within(bloc).findByText('PAY-2026-0001', { exact: false })).toBeInTheDocument();
    expect(within(bloc).getByRole('link', { name: 'Voir le reçu' })).toHaveAttribute('href', '/paiements/5/recu');
    expect(bloc.textContent).toContain('+237 6** ** ** 22');
    expect(bloc.textContent).not.toMatch(/699\s?00\s?11\s?22/);
  });

  it('la trame « paiement_mis_a_jour » met à jour la liste et relit la commande', async () => {
    const fetch = installer({}, { paiements: [enAttente()] });
    const direct = simulerDirect();
    rendreApp('/commandes/7');
    await screen.findByRole('link', { name: 'Suivre ce paiement' });
    await direct.attendreConnexion();
    direct.connecter();
    const avant = appels(fetch, 'GET', '/api/commandes/7/').length;
    direct.recevoir({ type: 'paiement_mis_a_jour', paiement: reussi() });
    expect(await screen.findByRole('link', { name: 'Voir le reçu' })).toBeInTheDocument();
    await waitFor(() => expect(appels(fetch, 'GET', '/api/commandes/7/').length).toBeGreaterThan(avant));
  });
});

describe('PaiementPage : formulaire', () => {
  it('propose le reste, le numéro du profil et Mobile Money ; envoie une demande avec le bon corps', async () => {
    const fetch = installer({ 'POST /api/paiements/': reponse(201, enAttente({ code_ussd: '*126#' })) });
    await ouvrirPaiement();
    expect(await screen.findByRole('radio', { name: /Payer le reste/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Mobile Money (MTN / Orange)' })).toBeChecked();
    const tel = screen.getByLabelText(/Numéro de téléphone Mobile Money/);
    expect(tel).toHaveValue('+237699000000');
    expect(screen.getByText('Exemple : 6 99 00 11 22')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Payer 510\s?000 FCFA/ }));
    const status = await zoneAttente();
    expect(within(status).getByText('Validez le paiement sur votre téléphone.')).toBeInTheDocument();
    expect(within(status).getByText('*126#')).toBeInTheDocument();
    expect(status.textContent).toContain('+237 6** ** ** 22');
    expect(appels(fetch, 'POST', '/api/paiements/')).toEqual([
      [{ commande: 7, mode: 'mobile', telephone: '+237699000000' }, expect.anything()],
    ]);
  });

  it('double clic sur « Payer » : une seule demande', async () => {
    let liberer;
    const fetch = installer({
      'POST /api/paiements/': () => new Promise((resolve) => { liberer = () => resolve(reponse(201, enAttente())); }),
    });
    await ouvrirPaiement();
    const bouton = await screen.findByRole('button', { name: /Payer 510\s?000 FCFA/ });
    await userEvent.dblClick(bouton);
    expect(appels(fetch, 'POST', '/api/paiements/')).toHaveLength(1);
    await act(async () => liberer());
    expect(await zoneAttente()).toBeInTheDocument();
    expect(appels(fetch, 'POST', '/api/paiements/')).toHaveLength(1);
  });

  it('autre montant : borné par le reste, entier ; envoie le montant saisi', async () => {
    const fetch = installer({ 'POST /api/paiements/': reponse(201, enAttente({ montant: 100000 })) });
    await ouvrirPaiement();
    await userEvent.click(await screen.findByRole('radio', { name: 'Autre montant' }));
    const champ = screen.getByLabelText(/Montant \(FCFA\)/);
    await userEvent.type(champ, '999999');
    await userEvent.click(screen.getByRole('button', { name: 'Payer' }));
    expect(await screen.findByText('Le montant ne peut pas dépasser le reste à payer.')).toBeInTheDocument();
    await userEvent.clear(champ);
    await userEvent.type(champ, '12,5');
    await userEvent.click(screen.getByRole('button', { name: 'Payer' }));
    expect(await screen.findByText('Saisissez un montant entier en FCFA, supérieur à 0.')).toBeInTheDocument();
    expect(appels(fetch, 'POST', '/api/paiements/')).toHaveLength(0);
    await userEvent.clear(champ);
    await userEvent.type(champ, '100000');
    await userEvent.click(screen.getByRole('button', { name: 'Payer' }));
    await zoneAttente();
    expect(appels(fetch, 'POST', '/api/paiements/')[0][0]).toEqual({
      commande: 7, mode: 'mobile', telephone: '+237699000000', montant: 100000,
    });
  });

  it('numéro invalide : erreur au champ sans appel ; erreur du serveur affichée au champ', async () => {
    const fetch = installer({
      'POST /api/paiements/': reponse(400, { montant: ['Le montant minimum est de 100 FCFA.'] }),
    });
    await ouvrirPaiement();
    const tel = await screen.findByLabelText(/Numéro de téléphone Mobile Money/);
    await userEvent.clear(tel);
    await userEvent.type(tel, '12345');
    await userEvent.click(screen.getByRole('button', { name: /Payer 510/ }));
    expect(await screen.findByText(/numéro mobile camerounais valide/)).toBeInTheDocument();
    expect(appels(fetch, 'POST', '/api/paiements/')).toHaveLength(0);
    await userEvent.clear(tel);
    await userEvent.type(tel, '6 99 00 11 22');
    await userEvent.click(screen.getByRole('button', { name: /Payer 510/ }));
    await waitFor(() => expect(appels(fetch, 'POST', '/api/paiements/')).toHaveLength(1));
    // l'erreur « montant » du serveur ne s'affiche que si le champ existe : elle ne casse pas la page
    expect(screen.getByRole('button', { name: /Payer 510/ })).toBeInTheDocument();
  });

  it('erreur 400 « montant » du serveur affichée sous le champ « Autre montant »', async () => {
    installer({ 'POST /api/paiements/': reponse(400, { montant: ['Le montant minimum est de 100 FCFA.'] }) });
    await ouvrirPaiement();
    await userEvent.click(await screen.findByRole('radio', { name: 'Autre montant' }));
    await userEvent.type(screen.getByLabelText(/Montant \(FCFA\)/), '50');
    await userEvent.click(screen.getByRole('button', { name: 'Payer' }));
    expect(await screen.findByText('Le montant minimum est de 100 FCFA.')).toBeInTheDocument();
  });

  it.each([
    ['trop_de_paiements', 429, /trop de paiements/],
    ['paiements_indisponibles', 503, /Aucun montant n'a été débité/],
    ['paiements_non_configures', 503, /n'est pas disponible pour le moment/],
    ['paiement_non_autorise', 409, /Le paiement n'est pas possible/],
  ])('erreur %s : message traduit du site', async (code, statut, motif) => {
    installer({ 'POST /api/paiements/': reponse(statut, { detail: 'Message du serveur', code }) });
    await ouvrirPaiement();
    await userEvent.click(await screen.findByRole('button', { name: /Payer 510/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(motif);
  });

  it('409 « paiement_en_cours » : reprend le paiement en attente', async () => {
    let appelsListe = 0;
    installer({
      'POST /api/paiements/': reponse(409, { detail: 'Déjà', code: 'paiement_en_cours' }),
      'GET /api/paiements/': () => reponse(200, page(++appelsListe >= 2 ? [enAttente({ id: 9 })] : [])),
      'GET /api/paiements/9/': reponse(200, enAttente({ id: 9 })),
    });
    await ouvrirPaiement();
    await userEvent.click(await screen.findByRole('button', { name: /Payer 510/ }));
    expect(await zoneAttente()).toHaveTextContent('Validez le paiement sur votre téléphone.');
  });

  it('mode lien : redirige vers l’adresse https reçue ; une adresse non sûre n’est jamais suivie', async () => {
    rediriger.mockClear();
    installer({ 'POST /api/paiements/': reponse(201, enAttente({ mode: 'lien', telephone_masque: '', lien: 'https://campay.example/pay/abc' })) });
    await ouvrirPaiement();
    await userEvent.click(await screen.findByRole('radio', { name: 'Carte / lien de paiement' }));
    expect(screen.queryByLabelText(/Numéro de téléphone/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Payer 510/ }));
    await waitFor(() => expect(rediriger).toHaveBeenCalledWith('https://campay.example/pay/abc'));
    expect(await screen.findByRole('link', { name: 'Reprendre le paiement' })).toHaveAttribute('href', 'https://campay.example/pay/abc');
  });

  it('adresse de paiement non sûre : pas de redirection', async () => {
    rediriger.mockClear();
    installer({ 'POST /api/paiements/': reponse(201, enAttente({ mode: 'lien', lien: 'javascript:alert(1)' })) });
    await ouvrirPaiement();
    await userEvent.click(await screen.findByRole('radio', { name: 'Carte / lien de paiement' }));
    await userEvent.click(screen.getByRole('button', { name: /Payer 510/ }));
    await zoneAttente();
    expect(rediriger).not.toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: 'Reprendre le paiement' })).toBeNull();
  });

  it('adresseSure : https et http://localhost seulement', () => {
    expect(adresseSure('https://campay.net/x')).toBe(true);
    expect(adresseSure('http://localhost:5173/x')).toBe(true);
    expect(adresseSure('http://campay.net/x')).toBe(false);
    expect(adresseSure('javascript:alert(1)')).toBe(false);
    expect(adresseSure('')).toBe(false);
  });

  it('service non configuré : pas de formulaire, explication claire', async () => {
    installer({}, { configure: false });
    await ouvrirPaiement();
    expect(await screen.findByRole('heading', { name: 'Paiement en ligne bientôt disponible' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Payer/ })).toBeNull();
  });

  it('commande sans contrat signé : pas de formulaire', async () => {
    installer({}, { commande: COMMANDE });
    await ouvrirPaiement();
    expect(await screen.findByRole('heading', { name: 'Paiement impossible pour le moment' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Payer/ })).toBeNull();
  });
});

describe('PaiementPage : attente, direct et états finaux', () => {
  it('reprise au rechargement : un paiement en attente est repris, sans nouvelle demande', async () => {
    const fetch = installer({
      'GET /api/paiements/': (corps, init, adresse) => {
        expect(adresse.searchParams.get('etat')).toBe('en_attente');
        return reponse(200, page([enAttente()]));
      },
      'GET /api/paiements/5/': reponse(200, enAttente({ code_ussd: '*126#' })),
    });
    await ouvrirPaiement();
    const status = await zoneAttente();
    expect(status).toHaveTextContent('Validez le paiement sur votre téléphone.');
    expect(screen.queryByRole('button', { name: /Payer 510/ })).toBeNull();
    expect(appels(fetch, 'POST', '/api/paiements/')).toHaveLength(0);
    await waitFor(() => expect(appels(fetch, 'GET', '/api/paiements/5/').length).toBeGreaterThan(0));
  });

  it('trame « paiement_mis_a_jour » : réussi, reçu proposé ; la trame d’un autre paiement est ignorée', async () => {
    installer({ 'GET /api/paiements/': reponse(200, page([enAttente()])), 'GET /api/paiements/5/': reponse(200, enAttente()) });
    const direct = await ouvrirPaiement();
    await zoneAttente();
    await direct.attendreConnexion();
    direct.connecter();
    direct.recevoir({ type: 'paiement_mis_a_jour', paiement: reussi({ id: 99 }) });
    expect(await zoneAttente()).toHaveTextContent('Validez le paiement');
    direct.recevoir({ type: 'paiement_mis_a_jour', paiement: reussi() });
    expect(await screen.findByRole('heading', { name: 'Paiement reçu' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voir le reçu' })).toHaveAttribute('href', '/paiements/5/recu');
    screen.getAllByRole('link', { name: 'Retour à la commande' }).forEach((l) => expect(l).toHaveAttribute('href', '/commandes/7'));
  });

  it('repli HTTP : GET <id>/ toutes les 4 secondes tant que le paiement est en attente', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let lectures = 0;
      installer({
        'GET /api/paiements/': reponse(200, page([enAttente()])),
        'GET /api/paiements/5/': () => reponse(200, ++lectures >= 3 ? reussi() : enAttente()),
      });
      await ouvrirPaiement();
      await zoneAttente();
      await act(async () => { await vi.advanceTimersByTimeAsync(4100); });
      await act(async () => { await vi.advanceTimersByTimeAsync(4100); });
      await act(async () => { await vi.advanceTimersByTimeAsync(4100); });
      expect(await screen.findByRole('heading', { name: 'Paiement reçu' })).toBeInTheDocument();
      const avant = lectures;
      await act(async () => { await vi.advanceTimersByTimeAsync(12000); });
      expect(lectures).toBe(avant); // plus de lecture une fois le paiement final
    } finally {
      vi.useRealTimers();
    }
  });

  it('échoué : raison traduite par le serveur et « Réessayer » rouvre le formulaire', async () => {
    installer({
      'GET /api/paiements/': (c, i, adresse) => reponse(200, page(adresse.searchParams.get('etat') ? [enAttente()] : [])),
      'GET /api/paiements/5/': reponse(200, { ...PAIEMENT, etat: 'echoue', raison: 'refuse', raison_libelle: 'Paiement refusé par l’opérateur.' }),
    });
    await ouvrirPaiement();
    expect(await screen.findByText('Paiement refusé par l’opérateur.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('button', { name: /Payer 510/ })).toBeInTheDocument();
  });

  it('expiré : « Recommencer » ; anomalie : message de vérification par l’équipe', async () => {
    installer({
      'GET /api/paiements/': reponse(200, page([enAttente()])),
      'GET /api/paiements/5/': reponse(200, { ...PAIEMENT, etat: 'expire' }),
    });
    await ouvrirPaiement();
    expect(await screen.findByRole('heading', { name: 'Paiement expiré' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recommencer' })).toBeInTheDocument();
  });

  it('anomalie : « Votre paiement est en cours de vérification par l’équipe »', async () => {
    installer({
      'GET /api/paiements/': reponse(200, page([enAttente()])),
      'GET /api/paiements/5/': reponse(200, { ...PAIEMENT, etat: 'anomalie' }),
    });
    await ouvrirPaiement();
    expect(await screen.findByText(/Votre paiement est en cours de vérification par l’équipe/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Recommencer' })).toBeNull();
  });

  it('paiement par lien en attente : annulation possible', async () => {
    installer({
      'GET /api/paiements/': reponse(200, page([enAttente({ mode: 'lien', peut_annuler: true })])),
      'GET /api/paiements/5/': reponse(200, enAttente({ mode: 'lien', peut_annuler: true })),
      'POST /api/paiements/5/annuler/': reponse(200, { ...PAIEMENT, mode: 'lien', etat: 'annule' }),
    });
    await ouvrirPaiement();
    await userEvent.click(await screen.findByRole('button', { name: 'Annuler ce paiement' }));
    expect(await screen.findByRole('heading', { name: 'Paiement annulé' })).toBeInTheDocument();
  });

  it('le paiement d’une autre commande n’est jamais affiché (adresse ?paiement=)', async () => {
    installer({
      'GET /api/paiements/9/': reponse(200, reussi({ id: 9, commande: { id: 8, reference: 'CIR-2026-0008' } })),
    });
    await ouvrirPaiement('/commandes/7/payer?paiement=9');
    expect(await screen.findByText(/Ce paiement est introuvable/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Paiement reçu' })).toBeNull();
    expect(screen.getByRole('button', { name: /Payer 510/ })).toBeInTheDocument();
  });
});

describe('PaiementPage : retour de redirection', () => {
  it('une adresse qui annonce « réussi » n’a aucun effet : l’état vient du serveur', async () => {
    const fetch = installer({ 'GET /api/paiements/5/': reponse(200, enAttente({ mode: 'lien' })) });
    await ouvrirPaiement('/commandes/7/payer?paiement=5&statut=reussi&status=SUCCESSFUL&etat=reussi');
    const status = await zoneAttente();
    expect(status).toHaveTextContent('Terminez le paiement');
    expect(screen.queryByRole('heading', { name: 'Paiement reçu' })).toBeNull();
    expect(appels(fetch, 'GET', '/api/paiements/5/').length).toBeGreaterThan(0);
    expect(appels(fetch, 'POST', '/api/paiements/')).toHaveLength(0);
  });

  it('le serveur confirme : paiement reçu', async () => {
    installer({ 'GET /api/paiements/5/': reponse(200, reussi({ mode: 'lien' })) });
    await ouvrirPaiement('/commandes/7/payer?paiement=5');
    expect(await screen.findByRole('heading', { name: 'Paiement reçu' })).toBeInTheDocument();
  });

  it('paiement inconnu (404) : message, puis formulaire', async () => {
    installer({ 'GET /api/paiements/5/': reponse(404, { detail: 'Introuvable.' }) });
    await ouvrirPaiement('/commandes/7/payer?paiement=5');
    expect(await screen.findByText(/Ce paiement est introuvable/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Payer 510/ })).toBeInTheDocument();
  });

  it('paramètre non numérique ignoré', async () => {
    const fetch = installer({});
    await ouvrirPaiement('/commandes/7/payer?paiement=../../admin');
    expect(await screen.findByRole('button', { name: /Payer 510/ })).toBeInTheDocument();
    expect(fetch.mock.calls.some(([url]) => String(url).includes('admin'))).toBe(false);
  });
});

describe('RecuPage', () => {
  const RECU = {
    paiement: reussi({ mode: 'mobile', operateur: 'MTN' }),
    commande: { id: 7, reference: 'CIR-2026-0007' },
    client: { nom_complet: 'Awa Ngono' },
    emetteur: { nom: 'Complexe Industriel Révélation SARL', ville: 'Douala' },
    montant_paye_total: 510000,
    reste_a_payer: 0,
  };

  it('affiche le reçu sans numéro complet, et le bouton appelle window.print()', async () => {
    installer({ 'GET /api/paiements/5/recu/': reponse(200, RECU) });
    const impression = vi.fn();
    vi.stubGlobal('print', impression);
    window.print = impression;
    rendreApp('/paiements/5/recu');
    expect(await screen.findByRole('heading', { level: 1, name: 'Reçu de paiement' })).toBeInTheDocument();
    const feuille = screen.getByRole('article');
    expect(feuille).toHaveTextContent('Complexe Industriel Révélation SARL');
    expect(feuille).toHaveTextContent('PAY-2026-0001');
    expect(feuille).toHaveTextContent('Awa Ngono');
    expect(feuille).toHaveTextContent('CIR-2026-0007');
    expect(feuille).toHaveTextContent(/510\s?000 FCFA/);
    expect(feuille).toHaveTextContent('+237 6** ** ** 22');
    expect(feuille.textContent).not.toMatch(/699\s?00\s?11\s?22/);
    await userEvent.click(screen.getByRole('button', { name: 'Imprimer / enregistrer en PDF' }));
    expect(impression).toHaveBeenCalledTimes(1);
  });

  it('reçu inconnu ou paiement non confirmé (404) : message dédié', async () => {
    installer({ 'GET /api/paiements/5/recu/': reponse(404, { detail: 'Introuvable.' }) });
    rendreApp('/paiements/5/recu');
    expect(await screen.findByRole('heading', { level: 1, name: 'Reçu introuvable' })).toBeInTheDocument();
  });

  it('les pages de paiement sont protégées : renvoi vers la connexion sans session', async () => {
    simulerApi({});
    localStorage.clear();
    rendreApp('/paiements/5/recu');
    expect(await screen.findByRole('heading', { level: 1, name: 'Se connecter' })).toBeInTheDocument();
    expect(emplacement()).toContain('/connexion');
  });
});
