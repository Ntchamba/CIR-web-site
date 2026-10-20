// Revue testeur, vague 4 : valeurs `montant_minimum` et `expiration_minutes` de GET disponibilite/, règles pures,
// réponse tardive « en attente » et adresses de redirection.
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { COMMANDE_SIGNEE, PAIEMENT } from '@/modules/commandes/fixtures.js';
import {
  appels, page, reponse, rendreApp, routesClient, simulerApi, simulerDirect,
} from '@/test/outils.jsx';

import { adresseSure } from './navigation.js';
import { attenteMs, entierPositif, fusionner, peutPayer, validerPaiement } from './regles.js';

function installer(disponibilite, { paiements = [], routes = {}, commande = COMMANDE_SIGNEE } = {}) {
  return simulerApi(routesClient({
    'GET /api/messagerie/non-lus/': reponse(200, { non_lus: 0 }),
    'GET /api/notifications/non-lues/': reponse(200, { count: 0 }),
    'GET /api/appels/disponibilite/': reponse(200, { configure: false, equipe_en_ligne: false }),
    'GET /api/commandes/7/': reponse(200, commande),
    'GET /api/paiements/disponibilite/': reponse(200, disponibilite),
    'GET /api/paiements/': reponse(200, page(paiements)),
    ...routes,
  }));
}

async function saisirAutreMontant(valeur) {
  simulerDirect();
  rendreApp('/commandes/7/payer');
  await userEvent.click(await screen.findByRole('radio', { name: 'Autre montant' }));
  await userEvent.type(screen.getByLabelText(/Montant \(FCFA\)/), valeur);
  await userEvent.click(screen.getByRole('button', { name: 'Payer' }));
}

describe('montant minimum de la disponibilité', () => {
  it('présent : un montant en dessous est refusé au champ, sans appel au serveur', async () => {
    const fetch = installer({ configure: true, montant_minimum: 1000, expiration_minutes: 15 });
    await saisirAutreMontant('500');
    expect(await screen.findByText(/Le montant minimum est de 1\s?000 FCFA\./)).toBeInTheDocument();
    expect(appels(fetch, 'POST', '/api/paiements/')).toHaveLength(0);
  });

  it('présent : un montant égal au minimum est envoyé', async () => {
    const fetch = installer({ configure: true, montant_minimum: 1000 }, {
      routes: { 'POST /api/paiements/': reponse(201, { ...PAIEMENT, montant: 1000 }) },
    });
    await saisirAutreMontant('1000');
    await waitFor(() => expect(appels(fetch, 'POST', '/api/paiements/')).toHaveLength(1));
  });

  it('absent : aucun minimum côté client (le serveur reste juge)', async () => {
    const fetch = installer({ configure: true }, {
      routes: { 'POST /api/paiements/': reponse(201, { ...PAIEMENT, montant: 50 }) },
    });
    await saisirAutreMontant('50');
    await waitFor(() => expect(appels(fetch, 'POST', '/api/paiements/')).toHaveLength(1));
    expect(screen.queryByText(/Le montant minimum/)).toBeNull();
  });

  it('valeur incohérente (texte, négatif, zéro) : ignorée', () => {
    [null, undefined, '1000', 0, -5, 1.5, Number.NaN].forEach((v) => expect(entierPositif(v)).toBeNull());
    expect(validerPaiement({ mode: 'lien', choixMontant: 'autre', montant: '50' }, 500, '1000')).toEqual({});
  });

  it('le minimum est ramené au reste s’il est plus petit', () => {
    expect(validerPaiement({ mode: 'lien', choixMontant: 'autre', montant: '300' }, 300, 1000)).toEqual({});
    expect(validerPaiement({ mode: 'lien', choixMontant: 'autre', montant: '299' }, 300, 1000).montant).toMatch(/300/);
    expect(validerPaiement({ mode: 'lien', choixMontant: 'autre', montant: '999' }, 5000, 1000).montant).toBeTruthy();
    expect(validerPaiement({ mode: 'lien', choixMontant: 'reste' }, 300, 1000)).toEqual({});
  });
});

describe('compte à rebours', () => {
  it('utilise expiration_minutes quand il est présent', async () => {
    installer({ configure: true, expiration_minutes: 5 }, {
      paiements: [PAIEMENT],
      routes: { 'GET /api/paiements/5/': reponse(200, PAIEMENT) },
    });
    simulerDirect();
    rendreApp('/commandes/7/payer');
    expect(await screen.findByText(/Temps restant, à titre indicatif : (4:5\d|5:00)/)).toBeInTheDocument();
  });

  it('repli sur 15 minutes quand il est absent', async () => {
    installer({ configure: true }, { paiements: [PAIEMENT], routes: { 'GET /api/paiements/5/': reponse(200, PAIEMENT) } });
    simulerDirect();
    rendreApp('/commandes/7/payer');
    expect(await screen.findByText(/Temps restant, à titre indicatif : (14:5\d|15:00)/)).toBeInTheDocument();
  });

  it('attenteMs : durée par défaut si la valeur est absente ou invalide', () => {
    expect(attenteMs(undefined)).toBe(15 * 60 * 1000);
    expect(attenteMs('x')).toBe(15 * 60 * 1000);
    expect(attenteMs(0)).toBe(15 * 60 * 1000);
    expect(attenteMs(2)).toBe(120000);
  });
});

describe('règles pures', () => {
  it('fusionner : une réponse tardive « en attente » n’écrase jamais un état final', () => {
    ['reussi', 'echoue', 'expire', 'annule', 'anomalie'].forEach((etat) => {
      const final = { id: 5, etat };
      expect(fusionner(final, { id: 5, etat: 'en_attente' })).toBe(final);
    });
    const attente = { id: 5, etat: 'en_attente' };
    const reussi = { id: 5, etat: 'reussi' };
    expect(fusionner(attente, reussi)).toBe(reussi);
    expect(fusionner({ id: 5, etat: 'reussi' }, { id: 6, etat: 'en_attente' }).id).toBe(6);
    const courant = { id: 5, etat: 'echoue' };
    expect(fusionner(courant, null)).toBe(courant);
  });

  it('peutPayer : contrat signé, reste > 0 seulement', () => {
    const base = { etat: 'contrat_signe', statut_paiement: 'non_paye', reste_a_payer: 100 };
    expect(peutPayer(base)).toBe(true);
    expect(peutPayer({ ...base, etat: 'negociation' })).toBe(false);
    expect(peutPayer({ ...base, etat: 'annulee' })).toBe(false);
    expect(peutPayer({ ...base, reste_a_payer: 0, statut_paiement: 'paye' })).toBe(false);
    expect(peutPayer({ ...base, reste_a_payer: null })).toBe(false);
    expect(peutPayer({ ...base, statut_paiement: 'non_applicable' })).toBe(false);
  });

  it('adresseSure : refuse http distant, data:, localhost trompeur', () => {
    expect(adresseSure('http://localhost.evil.com/x')).toBe(false);
    expect(adresseSure('http://evil.com/?u=http://localhost')).toBe(false);
    expect(adresseSure('data:text/html,x')).toBe(false);
    expect(adresseSure('//evil.com')).toBe(false);
    expect(adresseSure('https://campay.net/pay')).toBe(true);
  });
});

describe('réponse tardive pendant le suivi', () => {
  it('une lecture « en attente » arrivée après la trame « réussi » ne fait pas revenir en arrière', async () => {
    let liberer;
    let lectures = 0;
    installer({ configure: true }, {
      paiements: [PAIEMENT],
      routes: {
        // 1re lecture (reprise) immédiate ; la suivante (vérification) reste en suspens puis répond « en attente ».
        'GET /api/paiements/5/': () => (++lectures === 1
          ? reponse(200, PAIEMENT)
          : new Promise((resolve) => { liberer = () => resolve(reponse(200, PAIEMENT)); })),
      },
    });
    const direct = simulerDirect();
    rendreApp('/commandes/7/payer');
    await waitFor(() => expect(liberer).toBeTypeOf('function'));
    await direct.attendreConnexion();
    direct.connecter();
    direct.recevoir({ type: 'paiement_mis_a_jour', paiement: { ...PAIEMENT, etat: 'reussi', etat_libelle: 'Réussi' } });
    expect(await screen.findByRole('heading', { name: 'Paiement reçu' })).toBeInTheDocument();
    liberer();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByRole('heading', { name: 'Paiement reçu' })).toBeInTheDocument();
  });
});
