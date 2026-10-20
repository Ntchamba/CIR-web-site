// Messagerie (équipe) : cas limites de sécurité et de robustesse (repli HTTP à 8 s sans doublon, « lu » seulement en bas du
// fil, jeton envoyé uniquement vers l'API, trame d'erreur du serveur, lien « Écrire » interne). API et WebSocket simulés.
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { api } from '@/app/api.js';
import { installerDirect } from '@/test/direct-simule.js';
import { appels, page, rendre, reponse, simulerApi } from '@/test/api-simulee.jsx';

import { lirePieceJointe } from './api.js';

const CLIENT = { id: 7, nom_complet: 'Awa Nana', email: 'awa@x.cm', telephone: '699 11 22 33', langue: 'fr' };
const CONVERSATION = {
  id: 5, client: CLIENT, non_lus: 1, dernier_message_le: '2026-10-20T08:30:00Z',
  dernier_message: { texte: 'Bonjour', auteur_role: 'client', cree_le: '2026-10-20T08:30:00Z' },
};
const message = (id, role, texte, extra = {}) => ({
  id, conversation: 5, auteur_role: role, auteur_nom: role === 'client' ? 'Awa Nana' : 'Jean Mbarga', texte,
  commande: null, pieces_jointes: [], cree_le: `2026-10-20T08:${10 + id}:00Z`, lu_le: null, cle_client: '', ...extra,
});
const routes = (extra = [], messages = { results: [message(1, 'client', 'Bonjour')], a_plus: false }) => [
  ...extra,
  ['GET', /conversations\/5\/messages\//, messages],
  ['POST', /conversations\/5\/lu\//, { non_lus: 0 }],
  ['GET', '/api/admin/messagerie/conversations/', page([CONVERSATION])],
  ['GET', '/api/admin/commandes/?client=7', page([])],
];

async function ouvrir(u) {
  await u.click(await screen.findByRole('button', { name: /Awa Nana/ }));
  await screen.findByText('Bonjour', { selector: 'p' });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('envoi optimiste : repli HTTP après 8 secondes', () => {
  it('rejoue par HTTP avec la même cle_client si le direct ne confirme pas, sans doublon à la confirmation tardive', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const direct = installerDirect();
    const simule = simulerApi(routes([
      ['POST', /conversations\/5\/messages\//, (url, options) => {
        const corps = JSON.parse(options.body);
        return reponse(201, message(9, 'equipe', corps.texte, { cle_client: corps.cle_client }));
      }],
    ]));
    rendre('/messagerie');
    await waitFor(() => expect(direct.instances).toHaveLength(1));
    direct.connecter();
    const u = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await ouvrir(u);
    await u.type(screen.getByLabelText('Votre message'), 'Sans nouvelles{Enter}');
    const trame = direct.envoyees().find((x) => x.type === 'envoyer');
    expect(trame.cle_client).toBeTruthy();

    act(() => { vi.advanceTimersByTime(7000); });
    expect(appels(simule, 'POST', 'conversations/5/messages/')).toHaveLength(0); // pas avant 8 s
    act(() => { vi.advanceTimersByTime(1500); });
    await waitFor(() => expect(appels(simule, 'POST', 'conversations/5/messages/')).toHaveLength(1));
    const corps = JSON.parse(appels(simule, 'POST', 'conversations/5/messages/')[0][1].body);
    expect(corps.cle_client).toBe(trame.cle_client);
    await waitFor(() => expect(screen.queryByText(/Envoi…/)).not.toBeInTheDocument());

    // La confirmation du direct arrive enfin : le message reste unique.
    direct.recevoir({ type: 'message', message: message(9, 'equipe', 'Sans nouvelles', { cle_client: trame.cle_client }) });
    expect(within(screen.getByRole('log')).getAllByText('Sans nouvelles')).toHaveLength(1);
  });

  it("ne rejoue pas par HTTP si le direct a confirmé avant 8 s", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const direct = installerDirect();
    const simule = simulerApi(routes());
    rendre('/messagerie');
    await waitFor(() => expect(direct.instances).toHaveLength(1));
    direct.connecter();
    const u = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await ouvrir(u);
    await u.type(screen.getByLabelText('Votre message'), 'Confirmé{Enter}');
    const trame = direct.envoyees().find((x) => x.type === 'envoyer');
    direct.recevoir({ type: 'message', message: message(3, 'equipe', 'Confirmé', { cle_client: trame.cle_client }) });
    act(() => { vi.advanceTimersByTime(20000); });
    expect(appels(simule, 'POST', 'conversations/5/messages/')).toHaveLength(0);
    expect(within(screen.getByRole('log')).getAllByText('Confirmé')).toHaveLength(1);
  });

  it("marque l'envoi en échec quand le serveur renvoie une trame d'erreur", async () => {
    const direct = installerDirect();
    simulerApi(routes());
    rendre('/messagerie');
    await waitFor(() => expect(direct.instances).toHaveLength(1));
    direct.connecter();
    const u = userEvent.setup();
    await ouvrir(u);
    await u.type(screen.getByLabelText('Votre message'), 'Trop vite{Enter}');
    direct.recevoir({ type: 'erreur', code: 'trop_de_messages', detail: 'Trop de messages.' });
    expect(await screen.findByRole('alert')).toHaveTextContent('Trop de messages.');
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
  });
});

describe('marquage « lu » : seulement si le bas du fil est atteint', () => {
  it("n'envoie rien tant que le fil n'est pas défilé jusqu'en bas, puis marque lu", async () => {
    let haut = 0;
    const defs = [
      ['scrollHeight', { get: () => 1000, configurable: true }],
      ['clientHeight', { get: () => 100, configurable: true }],
      ['scrollTop', { get: () => haut, set: (v) => { if (v === 1000) return; haut = v; }, configurable: true }],
    ];
    defs.forEach(([nom, def]) => Object.defineProperty(HTMLElement.prototype, nom, def));
    try {
      installerDirect();
      const simule = simulerApi(routes());
      rendre('/messagerie');
      await ouvrir(userEvent.setup());
      await act(() => new Promise((resolve) => { setTimeout(resolve, 100); }));
      expect(appels(simule, 'POST', 'conversations/5/lu/')).toHaveLength(0);
      haut = 900; // le bas est atteint
      act(() => { screen.getByRole('log').dispatchEvent(new Event('scroll', { bubbles: true })); });
      await waitFor(() => expect(appels(simule, 'POST', 'conversations/5/lu/')).toHaveLength(1));
    } finally {
      ['scrollHeight', 'clientHeight', 'scrollTop'].forEach((nom) => { delete HTMLElement.prototype[nom]; });
    }
  });
});

describe('pièces jointes privées : le jeton ne part que vers l’API', () => {
  const adresseApi = () => api.baseUrl;

  it("envoie le jeton pour une adresse relative de l'API", async () => {
    localStorage.setItem('cir-tdb.jetons', JSON.stringify({ acces: 'jeton-secret', rafraichissement: 'r' }));
    const fetchSimule = vi.fn(() => Promise.resolve(new Response('pdf', { status: 200 })));
    vi.stubGlobal('fetch', fetchSimule);
    await lirePieceJointe('/api/messagerie/pieces-jointes/4/');
    expect(fetchSimule).toHaveBeenCalledTimes(1);
    expect(fetchSimule.mock.calls[0][0]).toBe(`${adresseApi()}/api/messagerie/pieces-jointes/4/`);
    expect(fetchSimule.mock.calls[0][1].headers.Authorization).toBe('Bearer jeton-secret');
  });

  it.each([
    ['https://pirate.example/f.pdf'],
    ['//pirate.example/f.pdf'],
    [`${'http://localhost:8000'}.pirate.example/f.pdf`],
    ['javascript:alert(1)'],
    ['data:text/html,<script>1</script>'],
    [''],
    [null],
  ])("refuse l'adresse %s sans aucune requête", async (adresse) => {
    localStorage.setItem('cir-tdb.jetons', JSON.stringify({ acces: 'jeton-secret', rafraichissement: 'r' }));
    const fetchSimule = vi.fn(() => Promise.resolve(new Response('x', { status: 200 })));
    vi.stubGlobal('fetch', fetchSimule);
    await expect(lirePieceJointe(adresse)).rejects.toMatchObject({ statut: 404 });
    expect(fetchSimule).not.toHaveBeenCalled();
  });

  it('affiche le nom du fichier comme du texte, jamais comme du HTML', async () => {
    installerDirect();
    const nom = '<img src=x onerror="alert(1)">.pdf';
    const piece = { id: 4, nom_original: nom, type: 'document', taille: 2048, url: '/api/messagerie/pieces-jointes/4/' };
    simulerApi(routes([], { results: [message(1, 'client', 'Bonjour', { pieces_jointes: [piece] })], a_plus: false }));
    const { container } = rendre('/messagerie');
    await ouvrir(userEvent.setup());
    expect(container.querySelector('img[src="x"]')).toBeNull();
    expect(screen.getByRole('button', { name: new RegExp('onerror') })).toBeInTheDocument();
  });
});
