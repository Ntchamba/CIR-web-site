// Appels audio et vidéo du client (BF-11) : API, WebSocket et Jitsi simulés.
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { chargerJitsi } from './jitsi.js';
import { DELAI_LECTURE_APPEL } from './composants/SalleAppel.jsx';
import {
  appels, page, reponse, rendreApp, routesClient, simulerApi, simulerDirect,
} from '@/test/outils.jsx';

const JITSI = { domaine: '8x8.vc', app_id: 'vpaas-magic-cookie-abc', salle: 'cir-0123456789abcdef01234567', jeton: 'JWT-PARTICIPANT' };
const APPEL = (extra = {}) => ({
  id: 7, reference: 'APP-2026-0001', type: 'audio', etat: 'sonne', client: { id: 1, nom_complet: 'Awa Ngono', telephone: '+237699000000' },
  commande: null, cree_le: new Date().toISOString(), demarre_le: null, termine_le: null, repondu_par: null, duree_secondes: null, ...extra,
});

function installer(routes = {}, dispo = { configure: true, equipe_en_ligne: true }) {
  return simulerApi(routesClient({
    'GET /api/messagerie/non-lus/': reponse(200, { non_lus: 0 }),
    'GET /api/notifications/non-lues/': reponse(200, { count: 0 }),
    'GET /api/messagerie/messages/': reponse(200, { results: [], a_plus: false }),
    'GET /api/commandes/': reponse(200, page([])),
    'GET /api/appels/disponibilite/': reponse(200, dispo),
    ...routes,
  }));
}

function simulerJitsi() {
  const instances = [];
  const API = vi.fn(function Api(domaine, options) {
    this.domaine = domaine;
    this.options = options;
    this.ecouteurs = {};
    this.dispose = vi.fn();
    this.addListener = vi.fn((nom, rappel) => { this.ecouteurs[nom] = rappel; });
    instances.push(this);
  });
  vi.stubGlobal('JitsiMeetExternalAPI', API);
  return { API, instances };
}

const lancerAppel = async (type = 'Appel audio') => {
  await userEvent.click(await screen.findByRole('button', { name: /Appeler l'équipe/ }));
  const dialogue = await screen.findByRole('dialog');
  await userEvent.click(within(dialogue).getByRole('button', { name: new RegExp(type) }));
};

describe('chargerJitsi', () => {
  afterEach(() => document.head.querySelectorAll('script').forEach((s) => s.remove()));

  it('ajoute le script du service seulement à l’appel, avec l’adresse https://<domaine>/<app_id>/external_api.js', () => {
    const promesse = chargerJitsi(JITSI);
    const script = document.head.querySelector('script[src*="external_api"]');
    expect(script.src).toBe('https://8x8.vc/vpaas-magic-cookie-abc/external_api.js');
    script.onerror();
    return expect(promesse).rejects.toThrow('jitsi_indisponible');
  });

  it('refuse un domaine ou un identifiant suspect (aucun script ajouté)', async () => {
    await expect(chargerJitsi({ domaine: 'pirate.exemple/x?y=', app_id: 'abc' })).rejects.toThrow('jitsi_invalide');
    await expect(chargerJitsi({ domaine: '8x8.vc', app_id: '../x' })).rejects.toThrow('jitsi_invalide');
    expect(document.head.querySelector('script[src*="external_api"]')).toBeNull();
  });

  it('réutilise l’API déjà chargée', async () => {
    const { API } = simulerJitsi();
    await expect(chargerJitsi(JITSI)).resolves.toBe(API);
    expect(document.head.querySelector('script[src*="external_api"]')).toBeNull();
  });
});

describe('BoutonAppel', () => {
  it('masqué si les appels ne sont pas configurés côté serveur', async () => {
    const fetch = installer({}, { configure: false, equipe_en_ligne: true });
    rendreApp('/messages');
    await screen.findByRole('heading', { level: 1, name: 'Messagerie' });
    await waitFor(() => expect(appels(fetch, 'GET', '/api/appels/disponibilite/')).toHaveLength(1));
    expect(screen.queryByRole('button', { name: /Appeler l'équipe/ })).not.toBeInTheDocument();
  });

  it('désactivé avec explication si personne de l’équipe n’est en ligne', async () => {
    const fetch = installer({}, { configure: true, equipe_en_ligne: false });
    rendreApp('/messages');
    const bouton = await screen.findByRole('button', { name: /Appeler l'équipe/ });
    expect(bouton).toHaveAttribute('aria-disabled', 'true');
    expect(bouton).toHaveAccessibleDescription(/L'équipe n'est pas en ligne pour le moment\./);
    await userEvent.click(bouton);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(appels(fetch, 'POST', '/api/appels/')).toHaveLength(0);
    expect(screen.getByRole('link', { name: 'Demander un rappel' })).toHaveAttribute('href', '/contact');
  });

  it('visiteur : un lien vers la connexion sur la page Contact, sans appel à l’API des appels', async () => {
    const fetch = simulerApi();
    rendreApp('/contact');
    const lien = await screen.findByRole('link', { name: "Se connecter pour appeler l'équipe" });
    expect(lien).toHaveAttribute('href', '/connexion?suite=%2Fcontact');
    expect(appels(fetch, 'GET', '/api/appels/disponibilite/')).toHaveLength(0);
  });

  it('choix audio ou vidéo avec l’avertissement sur le micro et la caméra ; Échap annule', async () => {
    installer();
    rendreApp('/messages');
    await userEvent.click(await screen.findByRole('button', { name: /Appeler l'équipe/ }));
    const dialogue = await screen.findByRole('dialog', { name: "Quel type d'appel ?" });
    expect(within(dialogue).getByText(/autorisation d'utiliser votre micro/)).toBeInTheDocument();
    expect(within(dialogue).getByRole('button', { name: /Appel audio/ })).toHaveFocus();
    expect(within(dialogue).getByRole('button', { name: /Appel vidéo/ })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('page Contact et détail d’une commande proposent aussi l’appel (avec la commande)', async () => {
    const fetch = installer({
      'GET /api/commandes/12/': reponse(200, {
        id: 12, reference: 'CIR-2026-0012', type_batiment: 'maison', etat: 'nouvelle', surface_m2: '20', cree_le: '2026-10-01T10:00:00Z',
        adresse: {}, lignes: [], propositions: [], historique: [], devis: [], actions_possibles: [], contrat: null,
      }),
      'POST /api/appels/': reponse(201, { appel: APPEL({ commande: { id: 12, reference: 'CIR-2026-0012' } }), jitsi: JITSI }),
    });
    simulerJitsi();
    rendreApp('/commandes/12');
    await screen.findByRole('heading', { level: 1, name: 'CIR-2026-0012' });
    const lien = screen.getByRole('link', { name: /Écrire un message/ });
    expect(lien).toHaveAttribute('href', '/messages?commande=12');
    await lancerAppel();
    await waitFor(() => expect(appels(fetch, 'POST', '/api/appels/')).toHaveLength(1));
    expect(appels(fetch, 'POST', '/api/appels/')[0][0]).toEqual({ type: 'audio', commande: 12 });
  });
});

describe('lancement d’un appel', () => {
  it('ouvre la salle plein écran : « Ça sonne… », Jitsi chargé avec le jeton, le nom du client et la salle', async () => {
    const fetch = installer({ 'POST /api/appels/': reponse(201, { appel: APPEL({ type: 'video' }), jitsi: JITSI }) });
    const { API, instances } = simulerJitsi();
    rendreApp('/messages');
    expect(API).not.toHaveBeenCalled();
    await lancerAppel('Appel vidéo');
    const salle = await screen.findByRole('dialog', { name: 'Appel vidéo avec le CIR' });
    expect(within(salle).getByText('Ça sonne…')).toBeInTheDocument();
    expect(appels(fetch, 'POST', '/api/appels/')[0][0]).toEqual({ type: 'video' });
    await waitFor(() => expect(API).toHaveBeenCalledTimes(1));
    const [domaine, options] = API.mock.calls[0];
    expect(domaine).toBe('8x8.vc');
    expect(options).toMatchObject({
      roomName: 'vpaas-magic-cookie-abc/cir-0123456789abcdef01234567', jwt: 'JWT-PARTICIPANT',
      userInfo: { displayName: 'Awa Ngono' }, lang: 'fr',
    });
    expect(options.configOverwrite).toMatchObject({ prejoinConfig: { enabled: false }, startWithVideoMuted: false });
    expect(options.interfaceConfigOverwrite.TOOLBAR_BUTTONS).toContain('camera');
    expect(instances).toHaveLength(1);
    // le bouton d'appel disparaît pendant l'appel
    expect(screen.queryByRole('button', { name: /Appeler l'équipe/ })).not.toBeInTheDocument();
  });

  it('appel audio : démarre sans caméra', async () => {
    installer({ 'POST /api/appels/': reponse(201, { appel: APPEL(), jitsi: JITSI }) });
    const { API } = simulerJitsi();
    rendreApp('/messages');
    await lancerAppel();
    await waitFor(() => expect(API).toHaveBeenCalled());
    expect(API.mock.calls[0][1].configOverwrite.startWithVideoMuted).toBe(true);
    expect(API.mock.calls[0][1].interfaceConfigOverwrite.TOOLBAR_BUTTONS).not.toContain('camera');
  });

  it('annuler un appel qui sonne : POST annuler, l’API Jitsi est libérée', async () => {
    const fetch = installer({
      'POST /api/appels/': reponse(201, { appel: APPEL(), jitsi: JITSI }),
      'POST /api/appels/7/annuler/': reponse(200, { appel: APPEL({ etat: 'annule' }) }),
    });
    const { instances } = simulerJitsi();
    rendreApp('/messages');
    await lancerAppel();
    await waitFor(() => expect(instances).toHaveLength(1));
    await userEvent.click(await screen.findByRole('button', { name: "Annuler l'appel" }));
    expect(await screen.findByText('Appel annulé.')).toBeInTheDocument();
    expect(appels(fetch, 'POST', '/api/appels/7/annuler/')).toHaveLength(1);
    expect(instances[0].dispose).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('l’équipe répond (événement du direct) : « Connecté » ; raccrocher termine l’appel', async () => {
    const fetch = installer({
      'POST /api/appels/': reponse(201, { appel: APPEL(), jitsi: JITSI }),
      'POST /api/appels/7/terminer/': reponse(200, { appel: APPEL({ etat: 'termine' }) }),
    });
    const { instances } = simulerJitsi();
    const direct = simulerDirect();
    rendreApp('/messages');
    await direct.attendreConnexion();
    direct.connecter();
    await lancerAppel();
    await screen.findByText('Ça sonne…');
    direct.recevoir({ type: 'appel_mis_a_jour', appel: APPEL({ etat: 'en_cours' }) });
    expect(await screen.findByText('Connecté')).toBeInTheDocument();
    // l'événement d'un autre appel est ignoré
    direct.recevoir({ type: 'appel_mis_a_jour', appel: APPEL({ id: 99, etat: 'termine' }) });
    expect(screen.getByText('Connecté')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Raccrocher' }));
    expect(await screen.findByText('Appel terminé.')).toBeInTheDocument();
    expect(appels(fetch, 'POST', '/api/appels/7/terminer/')).toHaveLength(1);
    expect(instances[0].dispose).toHaveBeenCalled();
  });

  it('le bouton raccrocher de l’interface Jitsi termine aussi l’appel côté CIR', async () => {
    const fetch = installer({
      'POST /api/appels/': reponse(201, { appel: APPEL({ etat: 'en_cours' }), jitsi: JITSI }),
      'POST /api/appels/7/terminer/': reponse(200, { appel: APPEL({ etat: 'termine' }) }),
    });
    const { instances } = simulerJitsi();
    rendreApp('/messages');
    await lancerAppel();
    await waitFor(() => expect(instances).toHaveLength(1));
    act(() => { instances[0].ecouteurs.readyToClose(); });
    await waitFor(() => expect(appels(fetch, 'POST', '/api/appels/7/terminer/')).toHaveLength(1));
  });

  it('« personne n’a répondu » : écrire un message ou demander un rappel', async () => {
    installer({ 'POST /api/appels/': reponse(201, { appel: APPEL(), jitsi: JITSI }) });
    const { instances } = simulerJitsi();
    const direct = simulerDirect();
    rendreApp('/messages');
    await direct.attendreConnexion();
    direct.connecter();
    await lancerAppel();
    await waitFor(() => expect(instances).toHaveLength(1));
    direct.recevoir({ type: 'appel_mis_a_jour', appel: APPEL({ etat: 'manque' }) });
    const salle = await screen.findByRole('dialog');
    expect(within(salle).getAllByText("Personne n'a répondu.").length).toBeGreaterThan(0);
    expect(within(salle).getByRole('link', { name: 'Écrire un message' })).toHaveAttribute('href', '/messages');
    expect(within(salle).getByRole('link', { name: 'Demander un rappel' })).toHaveAttribute('href', '/contact');
    expect(instances[0].dispose).toHaveBeenCalled();
    await userEvent.click(within(salle).getByRole('link', { name: 'Demander un rappel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('appel refusé par l’équipe', async () => {
    installer({ 'POST /api/appels/': reponse(201, { appel: APPEL(), jitsi: JITSI }) });
    simulerJitsi();
    const direct = simulerDirect();
    rendreApp('/messages');
    await direct.attendreConnexion();
    direct.connecter();
    await lancerAppel();
    await screen.findByText('Ça sonne…');
    direct.recevoir({ type: 'appel_mis_a_jour', appel: APPEL({ etat: 'refuse' }) });
    expect((await screen.findAllByText("L'équipe ne peut pas répondre pour le moment.")).length).toBeGreaterThan(0);
  });

  it('libère l’API Jitsi quand la salle disparaît du site (démontage)', async () => {
    installer({ 'POST /api/appels/': reponse(201, { appel: APPEL(), jitsi: JITSI }) });
    const { instances } = simulerJitsi();
    const { unmount } = rendreApp('/messages');
    await lancerAppel();
    await waitFor(() => expect(instances).toHaveLength(1));
    unmount();
    expect(instances[0].dispose).toHaveBeenCalled();
  });

  it('script Jitsi inaccessible : message clair et appel annulé côté serveur', async () => {
    const fetch = installer({
      'POST /api/appels/': reponse(201, { appel: APPEL(), jitsi: JITSI }),
      'POST /api/appels/7/annuler/': reponse(200, { appel: APPEL({ etat: 'annule' }) }),
    });
    rendreApp('/messages');
    await lancerAppel();
    await waitFor(() => expect(document.head.querySelector('script[src*="external_api"]')).not.toBeNull());
    act(() => document.head.querySelector('script[src*="external_api"]').onerror());
    expect((await screen.findAllByText(/Impossible d'ouvrir l'appel/)).length).toBeGreaterThan(0);
    await waitFor(() => expect(appels(fetch, 'POST', '/api/appels/7/annuler/')).toHaveLength(1));
    document.head.querySelectorAll('script').forEach((s) => s.remove());
  });

  it('micro refusé par le navigateur : explication claire', async () => {
    installer({ 'POST /api/appels/': reponse(201, { appel: APPEL(), jitsi: JITSI }) });
    simulerJitsi();
    vi.stubGlobal('navigator', { ...navigator, mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'NotAllowedError' })) } });
    rendreApp('/messages');
    await lancerAppel();
    expect(await screen.findByText(/Le micro est refusé par votre navigateur/)).toBeInTheDocument();
  });

  describe('erreurs du serveur', () => {
    it.each([
      ['equipe_indisponible', 409, /L'équipe n'est pas en ligne pour le moment\. Écrivez-nous/],
      ['appel_deja_en_cours', 409, /Vous avez déjà un appel en cours\./],
      ['appels_non_configures', 503, /Les appels ne sont pas disponibles pour le moment\./],
    ])('%s', async (code, statut, texte) => {
      installer({ 'POST /api/appels/': reponse(statut, { detail: 'texte du serveur', code }) });
      rendreApp('/messages');
      await lancerAppel();
      const dialogue = await screen.findByRole('dialog');
      expect(await within(dialogue).findByText(texte)).toBeInTheDocument();
      if (code === 'equipe_indisponible') {
        expect(within(dialogue).getByRole('link', { name: 'Écrire un message' })).toBeInTheDocument();
      }
    });

    it('quota (429) : message clair', async () => {
      installer({ 'POST /api/appels/': reponse(429, { detail: 'Throttled' }) });
      rendreApp('/messages');
      await lancerAppel();
      expect(await screen.findByText(/trop d'appels récemment/)).toBeInTheDocument();
    });
  });

  describe('expiration à 60 s', () => {
    beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
    afterEach(() => vi.useRealTimers());

    it('relit l’appel toutes les 5 s tant qu’il sonne : le serveur le passe à « manqué »', async () => {
      let lectures = 0;
      const fetch = installer({
        'POST /api/appels/': reponse(201, { appel: APPEL(), jitsi: JITSI }),
        'GET /api/appels/7/': () => {
          lectures += 1;
          return reponse(200, { appel: APPEL({ etat: lectures >= 2 ? 'manque' : 'sonne' }) });
        },
      });
      simulerJitsi();
      rendreApp('/messages');
      await lancerAppel();
      await screen.findByText('Ça sonne…');
      await act(async () => { await vi.advanceTimersByTimeAsync(DELAI_LECTURE_APPEL + 50); });
      expect(appels(fetch, 'GET', '/api/appels/7/')).toHaveLength(1);
      await act(async () => { await vi.advanceTimersByTimeAsync(DELAI_LECTURE_APPEL + 50); });
      expect((await screen.findAllByText("Personne n'a répondu.")).length).toBeGreaterThan(0);
      await act(async () => { await vi.advanceTimersByTimeAsync(DELAI_LECTURE_APPEL * 2); });
      expect(appels(fetch, 'GET', '/api/appels/7/')).toHaveLength(2); // plus de lecture une fois terminé
    });
  });
});
