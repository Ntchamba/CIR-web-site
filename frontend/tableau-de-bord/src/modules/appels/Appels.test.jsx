// Appels (équipe) : bannière d'appel entrant, sonnerie, salle modérateur (Jitsi simulé), historique, jauge d'usage.
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { installerDirect } from '@/test/direct-simule.js';
import { appels, page, rendre, reponse, simulerApi } from '@/test/api-simulee.jsx';

import { reinitialiserSonnerie } from './sonnerie.js';

const APPEL = {
  id: 31, reference: 'APP-2026-0031', type: 'video', etat: 'sonne',
  client: { id: 7, nom_complet: 'Awa Nana', telephone: '699 11 22 33' }, commande: { id: 12, reference: 'CIR-2026-0012' },
  cree_le: '2026-10-20T09:00:00Z', demarre_le: null, termine_le: null, repondu_par: null, duree_secondes: null,
};
const JITSI = { domaine: '8x8.vc', app_id: 'vpaas-magic-cookie-test', salle: 'cir-0123456789abcdef01234567', jeton: 'jeton-moderateur' };

afterEach(() => {
  reinitialiserSonnerie();
  delete window.JitsiMeetExternalAPI;
});

function installerJitsi() {
  const creations = [];
  class FauxJitsi {
    constructor(domaine, options) {
      this.domaine = domaine;
      this.options = options;
      this.ecouteurs = {};
      this.commandes = [];
      this.dispose = vi.fn();
      creations.push(this);
    }
    addListener(nom, rappel) { this.ecouteurs[nom] = rappel; }
    executeCommand(c) { this.commandes.push(c); }
  }
  window.JitsiMeetExternalAPI = FauxJitsi;
  return creations;
}

describe('SonnerieAppel', () => {
  it("affiche l'appel entrant, répond et ouvre la salle avec le jeton modérateur, puis raccroche", async () => {
    const direct = installerDirect();
    const creations = installerJitsi();
    const simule = simulerApi([
      ['POST', 'appels/31/repondre/', { appel: { ...APPEL, etat: 'en_cours' }, jitsi: JITSI }],
      ['POST', 'appels/31/terminer/', { appel: { ...APPEL, etat: 'termine' } }],
    ]);
    rendre('/');
    await waitFor(() => expect(direct.instances).toHaveLength(1));
    direct.connecter();
    direct.recevoir({ type: 'appel_entrant', appel: APPEL });

    const alerte = await screen.findByRole('alert');
    expect(within(alerte).getByText('Appel entrant de Awa Nana')).toBeInTheDocument();
    expect(within(alerte).getByText(/Appel vidéo · CIR-2026-0012/)).toBeInTheDocument();
    // Pastille du menu, en direct.
    const menu = screen.getByRole('navigation', { name: 'Menu du tableau de bord' });
    expect(within(menu).getByRole('link', { name: /^Appels\s+1 à traiter$/u })).toBeInTheDocument();

    const u = userEvent.setup();
    await u.click(within(alerte).getByRole('button', { name: "Répondre à l'appel de Awa Nana" }));
    const salle = await screen.findByRole('dialog', { name: 'Appel avec Awa Nana' });
    await waitFor(() => expect(creations).toHaveLength(1));
    expect(creations[0].domaine).toBe('8x8.vc');
    expect(creations[0].options).toMatchObject({
      roomName: 'vpaas-magic-cookie-test/cir-0123456789abcdef01234567', jwt: 'jeton-moderateur',
      userInfo: { displayName: 'Jean Mbarga' },
    });
    expect(appels(simule, 'POST', 'appels/31/repondre/')).toHaveLength(1);
    expect(screen.queryByText('Appel entrant de Awa Nana')).not.toBeInTheDocument();

    await u.click(within(salle).getByRole('button', { name: 'Raccrocher' }));
    await waitFor(() => expect(appels(simule, 'POST', 'appels/31/terminer/')).toHaveLength(1));
    expect(creations[0].commandes).toContain('hangup');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(creations[0].dispose).toHaveBeenCalled();
  });

  it("ne charge pas le script Jitsi avant de répondre à un appel", async () => {
    const direct = installerDirect();
    simulerApi([]);
    rendre('/');
    await waitFor(() => expect(direct.instances).toHaveLength(1));
    direct.connecter();
    direct.recevoir({ type: 'appel_entrant', appel: APPEL });
    await screen.findByText('Appel entrant de Awa Nana');
    expect(document.querySelector('script[src*="external_api.js"]')).toBeNull();
  });

  it("retire la bannière dès qu'un autre membre répond", async () => {
    const direct = installerDirect();
    simulerApi([]);
    rendre('/');
    await waitFor(() => expect(direct.instances).toHaveLength(1));
    direct.connecter();
    direct.recevoir({ type: 'appel_entrant', appel: APPEL });
    await screen.findByText('Appel entrant de Awa Nana');
    direct.recevoir({ type: 'appel_mis_a_jour', appel: { ...APPEL, etat: 'en_cours', repondu_par: { id: 3, nom_complet: 'Autre' } } });
    await waitFor(() => expect(screen.queryByText('Appel entrant de Awa Nana')).not.toBeInTheDocument());
  });

  it('explique quand un collègue a déjà répondu (409 appel_pris)', async () => {
    const direct = installerDirect();
    simulerApi([['POST', 'appels/31/repondre/', () => reponse(409, { detail: 'Appel pris.', code: 'appel_pris' })]]);
    rendre('/');
    await waitFor(() => expect(direct.instances).toHaveLength(1));
    direct.connecter();
    direct.recevoir({ type: 'appel_entrant', appel: APPEL });
    await userEvent.setup().click(await screen.findByRole('button', { name: "Répondre à l'appel de Awa Nana" }));
    expect(await screen.findByText("Un autre membre de l'équipe a déjà répondu à cet appel.")).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('button', { name: /Répondre/ })).not.toBeInTheDocument());
  });

  it('refuse un appel', async () => {
    const direct = installerDirect();
    const simule = simulerApi([['POST', 'appels/31/refuser/', { appel: { ...APPEL, etat: 'refuse' } }]]);
    rendre('/');
    await waitFor(() => expect(direct.instances).toHaveLength(1));
    direct.connecter();
    direct.recevoir({ type: 'appel_entrant', appel: APPEL });
    await userEvent.setup().click(await screen.findByRole('button', { name: "Refuser l'appel de Awa Nana" }));
    await waitFor(() => expect(appels(simule, 'POST', 'appels/31/refuser/')).toHaveLength(1));
    await waitFor(() => expect(screen.queryByText('Appel entrant de Awa Nana')).not.toBeInTheDocument());
  });

  it("retrouve les appels qui sonnent à l'ouverture (reprise après coupure)", async () => {
    installerDirect();
    simulerApi([['GET', 'appels/en-attente/', [APPEL]]]);
    rendre('/');
    expect(await screen.findByText('Appel entrant de Awa Nana')).toBeInTheDocument();
  });

  it("l'onglet clignote tant que l'appel sonne puis retrouve son titre", async () => {
    const direct = installerDirect();
    simulerApi([]);
    rendre('/');
    await waitFor(() => expect(direct.instances).toHaveLength(1));
    direct.connecter();
    await screen.findByRole('heading', { level: 1 });
    direct.recevoir({ type: 'appel_entrant', appel: APPEL });
    await waitFor(() => expect(document.title).toBe('Appel de Awa Nana'));
    direct.recevoir({ type: 'appel_mis_a_jour', appel: { ...APPEL, etat: 'manque' } });
    await waitFor(() => expect(document.title).not.toBe('Appel de Awa Nana'));
  });

  it("sonne seulement après le geste « Activer la sonnerie », et s'arrête avec l'appel", async () => {
    const sons = { oscillateurs: 0, demarres: 0 };
    class FauxAudio {
      constructor() { this.state = 'suspended'; this.currentTime = 0; this.destination = {}; }
      resume() { this.state = 'running'; return Promise.resolve(); }
      createOscillator() {
        sons.oscillateurs += 1;
        return { type: '', frequency: { value: 0 }, connect() {}, start: () => { sons.demarres += 1; }, stop() {} };
      }
      createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
    }
    vi.stubGlobal('AudioContext', FauxAudio);
    window.AudioContext = FauxAudio;
    const direct = installerDirect();
    simulerApi([]);
    rendre('/');
    await waitFor(() => expect(direct.instances).toHaveLength(1));
    direct.connecter();
    direct.recevoir({ type: 'appel_entrant', appel: APPEL });
    const bouton = await screen.findByRole('button', { name: 'Activer la sonnerie' });
    expect(sons.demarres).toBe(0); // rien avant le geste
    await userEvent.setup().click(bouton);
    await waitFor(() => expect(sons.demarres).toBeGreaterThanOrEqual(2));
    expect(screen.queryByRole('button', { name: 'Activer la sonnerie' })).not.toBeInTheDocument();
    direct.recevoir({ type: 'appel_mis_a_jour', appel: { ...APPEL, etat: 'en_cours' } });
    await waitFor(() => expect(screen.queryByText('Appel entrant de Awa Nana')).not.toBeInTheDocument());
    const avant = sons.demarres;
    await act(() => new Promise((resolve) => { setTimeout(resolve, 100); }));
    expect(sons.demarres).toBe(avant);
    delete window.AudioContext;
  });
});

const MANQUE = {
  id: 30, reference: 'APP-2026-0030', type: 'audio', etat: 'manque', client: { id: 9, nom_complet: 'Paul Eto', telephone: '677 00 11 22' },
  commande: null, cree_le: '2026-10-19T16:00:00Z', demarre_le: null, termine_le: null, repondu_par: null, duree_secondes: null,
  rappel: { telephone: '677 00 11 22', lien_messagerie: '/messagerie?client=9' },
};
const TERMINE = {
  ...APPEL, id: 29, reference: 'APP-2026-0029', etat: 'termine', repondu_par: { id: 2, nom_complet: 'Jean Mbarga' }, duree_secondes: 185,
};

describe('AppelsEntrantsPage', () => {
  it("affiche l'historique avec les manqués en tête, « Rappeler » et « Écrire »", async () => {
    installerDirect();
    const simule = simulerApi([
      ['GET', 'appels/usage/', { mois: '2026-10', utilisateurs_actifs: 18, limite_gratuite: 25, depasse: false, proche: false }],
      ['GET', '/api/admin/appels/', page([MANQUE, TERMINE])],
    ]);
    rendre('/appels');
    const manque = (await screen.findByText('APP-2026-0030')).closest('tr');
    expect(within(manque).getByText('Manqué')).toBeInTheDocument();
    expect(within(manque).getByRole('link', { name: 'Rappeler Paul Eto' })).toHaveAttribute('href', 'tel:677001122');
    expect(within(manque).getByRole('link', { name: 'Écrire à Paul Eto' })).toHaveAttribute('href', '/messagerie?client=9');
    const termine = screen.getByText('APP-2026-0029').closest('tr');
    expect(within(termine).getByText('Terminé')).toBeInTheDocument();
    expect(within(termine).getByText('Répondu par Jean Mbarga')).toBeInTheDocument();
    expect(within(termine).getByText('3 min 05 s')).toBeInTheDocument();
    expect(within(termine).queryByRole('link', { name: /Rappeler/ })).not.toBeInTheDocument();
    // Ouvrir la liste vaut « vu » : la pastille est relue.
    await waitFor(() => expect(appels(simule, 'GET', '/api/admin/appels/resume/').length).toBeGreaterThan(1));
  });

  it("marque les manqués comme vus à l'ouverture puis relit la pastille", async () => {
    installerDirect();
    const simule = simulerApi([['POST', '/api/admin/appels/vu/', { marques: 2 }]]);
    rendre('/appels');
    await waitFor(() => expect(appels(simule, 'POST', '/api/admin/appels/vu/')).toHaveLength(1));
    const posts = simule.mock.calls.findIndex(([x, o = {}]) => o.method === 'POST' && String(x).includes('/appels/vu/'));
    await waitFor(() => expect(simule.mock.calls.slice(posts + 1).some(([x]) => String(x).includes('/api/admin/appels/resume/'))).toBe(true));
  });

  it("montre la jauge d'usage : 18 sur 25, sans alerte sous 80 %", async () => {
    installerDirect();
    simulerApi([
      ['GET', 'appels/usage/', { mois: '2026-10', utilisateurs_actifs: 18, limite_gratuite: 25, depasse: false, proche: false }],
    ]);
    rendre('/appels');
    expect(await screen.findByText('18 sur 25 utilisateurs actifs ce mois-ci')).toBeInTheDocument();
    const jauge = screen.getByRole('meter');
    expect(jauge).toHaveAttribute('aria-valuenow', '18');
    expect(jauge).toHaveAttribute('aria-valuemax', '25');
    expect(screen.queryByText(/approchez de la limite/)).not.toBeInTheDocument();
  });

  it('alerte à 80 % de la limite puis au dépassement', async () => {
    installerDirect();
    const usage = { mois: '2026-10', utilisateurs_actifs: 20, limite_gratuite: 25, depasse: false, proche: true };
    simulerApi([['GET', 'appels/usage/', () => reponse(200, usage)]]);
    const { unmount } = rendre('/appels');
    expect(await screen.findByText(/Vous approchez de la limite gratuite/)).toBeInTheDocument();
    unmount();
    simulerApi([['GET', 'appels/usage/', { ...usage, utilisateurs_actifs: 27, depasse: true }]]);
    rendre('/appels');
    expect(await screen.findByText('La limite gratuite est dépassée : des frais peuvent s\'appliquer.')).toBeInTheDocument();
  });

  it("explique clairement que Jitsi n'est pas configuré", async () => {
    installerDirect();
    simulerApi([
      ['GET', 'appels/usage/', () => reponse(503, { detail: 'Appels non configurés.', code: 'appels_non_configures' })],
    ]);
    rendre('/appels');
    expect(await screen.findByText('Les appels ne sont pas encore configurés')).toBeInTheDocument();
    expect(screen.getByText(/Jitsi JaaS\) n'est pas configuré/)).toBeInTheDocument();
  });

  it('filtre par état et par recherche auprès du serveur', async () => {
    installerDirect();
    const simule = simulerApi([['GET', '/api/admin/appels/', page([MANQUE])]]);
    rendre('/appels');
    const u = userEvent.setup();
    await screen.findByText('APP-2026-0030');
    await u.selectOptions(screen.getByLabelText('État'), 'manque');
    await waitFor(() => expect(simule.mock.calls.some(([x]) => /appels\/\?etat=manque/.test(String(x)))).toBe(true));
    await u.type(screen.getByLabelText('Rechercher un client ou une référence'), 'paul');
    await waitFor(() => expect(simule.mock.calls.some(([x]) => /search=paul/.test(String(x)))).toBe(true));
  });

  it('affiche un état vide clair', async () => {
    installerDirect();
    simulerApi([]);
    rendre('/appels');
    expect(await screen.findByRole('heading', { level: 2, name: 'Aucun appel' })).toBeInTheDocument();
  });
});
