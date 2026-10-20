// Sécurité et repli de la messagerie (BF-11) : pièces jointes, compte équipe, envoi rejoué sans doublon.
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { api } from '@/app/api.js';
import {
  appels, page, reponse, rendreApp, routesClient, simulerApi, simulerDirect, unMessage, UTILISATEUR,
} from '@/test/outils.jsx';

import { recupererFichier } from './api.js';
import { DELAI_CONFIRMATION } from './useConversation.js';

const ROUTES_BASE = {
  'GET /api/messagerie/non-lus/': reponse(200, { non_lus: 0 }),
  'GET /api/notifications/non-lues/': reponse(200, { count: 0 }),
  'GET /api/commandes/': reponse(200, page([])),
  'GET /api/appels/disponibilite/': reponse(200, { configure: false, equipe_en_ligne: false }),
  'GET /api/messagerie/messages/': reponse(200, { results: [], a_plus: false }),
};

describe('recupererFichier : le jeton ne part que vers l’API', () => {
  let brut;
  beforeEach(() => {
    brut = vi.fn(async () => ({ ok: true, status: 200, blob: async () => new Blob(['x']) }));
    vi.stubGlobal('fetch', brut);
    api.jetons.ecrire?.({ acces: 'A1', rafraichissement: 'R1' });
  });

  it.each([
    'https://pirate.exemple/api/messagerie/pieces-jointes/1/',
    `${api.baseUrl}.pirate.exemple/x`,
    '//pirate.exemple/x',
    'pirate.exemple/x',
    '/\\pirate.exemple/x',
    'javascript:alert(1)',
    undefined,
  ])('refuse %s sans aucune requête', async (url) => {
    await expect(recupererFichier(url)).rejects.toMatchObject({ statut: 403 });
    expect(brut).not.toHaveBeenCalled();
  });

  it('accepte un chemin de l’API et envoie le jeton à l’adresse de l’API', async () => {
    await recupererFichier('/api/messagerie/pieces-jointes/1/');
    expect(brut).toHaveBeenCalledTimes(1);
    expect(brut.mock.calls[0][0]).toBe(`${api.baseUrl}/api/messagerie/pieces-jointes/1/`);
  });

  it('accepte l’adresse absolue de l’API', async () => {
    await recupererFichier(`${api.baseUrl}/api/messagerie/pieces-jointes/2/`);
    expect(brut).toHaveBeenCalledTimes(1);
  });
});

describe('compte équipe', () => {
  it('aucune connexion en direct ni appel aux compteurs du client', async () => {
    const fetch = simulerApi(routesClient(ROUTES_BASE, { utilisateur: { ...UTILISATEUR, role: 'equipe', est_equipe: true } }));
    const direct = simulerDirect();
    rendreApp('/');
    await waitFor(() => expect(fetch.mock.calls.some(([u]) => String(u).includes('/comptes/moi/'))).toBe(true));
    await new Promise((r) => setTimeout(r, 50));
    expect(direct.sockets).toHaveLength(0);
    expect(appels(fetch, 'GET', '/api/messagerie/non-lus/')).toHaveLength(0);
  });
});

describe('envoi rejoué par HTTP sans doublon', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it('sans confirmation du direct après 10 s : repli HTTP avec la même cle_client, puis un seul message affiché', async () => {
    const fetch = simulerApi(routesClient({
      ...ROUTES_BASE,
      'POST /api/messagerie/messages/': (corps) => reponse(201, unMessage(9, {
        auteur_role: 'client', texte: corps.texte, cle_client: corps.cle_client,
      })),
    }));
    const direct = simulerDirect();
    rendreApp('/messages');
    await direct.attendreConnexion();
    direct.connecter();
    const champ = await screen.findByLabelText('Votre message');
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).type(champ, 'Bonjour{Enter}');
    const trame = direct.envoyees().find((t) => t.type === 'envoyer');
    expect(trame.texte).toBe('Bonjour');
    expect(appels(fetch, 'POST', '/api/messagerie/messages/')).toHaveLength(0);

    await act(async () => { await vi.advanceTimersByTimeAsync(DELAI_CONFIRMATION - 500); });
    expect(appels(fetch, 'POST', '/api/messagerie/messages/')).toHaveLength(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    await waitFor(() => expect(appels(fetch, 'POST', '/api/messagerie/messages/')).toHaveLength(1));
    expect(appels(fetch, 'POST', '/api/messagerie/messages/')[0][0].cle_client).toBe(trame.cle_client);

    // La confirmation tardive du direct ne crée pas de doublon.
    direct.recevoir({ type: 'message', message: unMessage(9, { auteur_role: 'client', texte: 'Bonjour', cle_client: trame.cle_client }) });
    await waitFor(() => expect(screen.getAllByText('Bonjour')).toHaveLength(1));
  });

  it('confirmation reçue à temps : aucun envoi HTTP', async () => {
    const fetch = simulerApi(routesClient(ROUTES_BASE));
    const direct = simulerDirect();
    rendreApp('/messages');
    await direct.attendreConnexion();
    direct.connecter();
    const champ = await screen.findByLabelText('Votre message');
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).type(champ, 'Salut{Enter}');
    const trame = direct.envoyees().find((t) => t.type === 'envoyer');
    direct.recevoir({ type: 'message', message: unMessage(3, { auteur_role: 'client', texte: 'Salut', cle_client: trame.cle_client }) });
    await act(async () => { await vi.advanceTimersByTimeAsync(DELAI_CONFIRMATION + 1000); });
    expect(appels(fetch, 'POST', '/api/messagerie/messages/')).toHaveLength(0);
    expect(screen.getAllByText('Salut')).toHaveLength(1);
  });
});
