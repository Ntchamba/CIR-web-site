// Notifications du client et fond en direct (BF-07, BF-13) : API et WebSocket simulés.
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DELAI_LECTURE_HTTP } from './FondDirect.jsx';
import { cheminSur } from './lien.js';
import {
  appels, emplacement, page, parametresDes, reponse, rendreApp, routesClient, simulerApi, simulerDirect, UTILISATEUR,
} from '@/test/outils.jsx';

const NOTIF = (id, extra = {}) => ({
  id, type: 'commande_creee', titre: `Titre ${id}`, texte: `Texte ${id}`, lien: '/commandes/12', lue: false,
  cree_le: new Date().toISOString(), ...extra,
});

function installer(routes = {}) {
  return simulerApi(routesClient({
    'GET /api/messagerie/non-lus/': reponse(200, { non_lus: 0 }),
    'GET /api/notifications/non-lues/': reponse(200, { count: 0 }),
    'GET /api/notifications/': reponse(200, page([])),
    'GET /api/notifications/preferences/': reponse(200, { recevoir_nouveautes: false }),
    'GET /api/appels/disponibilite/': reponse(200, { configure: false, equipe_en_ligne: false }),
    ...routes,
  }));
}

describe('lien d’une notification', () => {
  it('seul un chemin du site est suivi', () => {
    expect(cheminSur('/commandes/12')).toBe('/commandes/12');
    expect(cheminSur('https://pirate.exemple/x')).toBe('/notifications');
    expect(cheminSur('//pirate.exemple')).toBe('/notifications');
    expect(cheminSur('javascript:alert(1)')).toBe('/notifications');
    expect(cheminSur(undefined)).toBe('/notifications');
  });
});

describe('FondDirect', () => {
  it('une seule connexion /ws/, authentifiée par la première trame ; les compteurs viennent de « pret » puis de « non_lus »', async () => {
    installer();
    const direct = simulerDirect();
    rendreApp('/');
    await direct.attendreConnexion();
    expect(direct.sockets).toHaveLength(1);
    expect(direct.socket.url).toBe('ws://localhost:8000/ws/');
    act(() => direct.socket.onopen());
    expect(direct.envoyees()[0]).toEqual({ type: 'authentifier', jeton: 'A1' });
    direct.connecter({ non_lus: 2, notifications_non_lues: 5 });
    const entete = screen.getByRole('banner');
    expect(await within(entete).findByRole('link', { name: 'Messages, 2 non lus' })).toHaveAttribute('href', '/messages');
    expect(within(entete).getByRole('button', { name: 'Notifications, 5 non lues' })).toBeInTheDocument();
    direct.recevoir({ type: 'non_lus', messagerie: 0, notifications: 1 });
    expect(await within(entete).findByRole('link', { name: 'Messages' })).toBeInTheDocument();
    expect(within(entete).getByRole('button', { name: 'Notifications, 1 non lue' })).toBeInTheDocument();
  });

  it('visiteur : aucune connexion en direct, ni cloche ni icône Messages', async () => {
    simulerApi();
    const direct = simulerDirect();
    rendreApp('/');
    await screen.findByRole('heading', { level: 1, name: /Révélation/ });
    expect(direct.sockets).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /Notifications/ })).not.toBeInTheDocument();
  });

  it('la déconnexion ferme la connexion en direct', async () => {
    installer({ 'POST /api/comptes/deconnexion/': reponse(204, null) });
    const direct = simulerDirect();
    rendreApp('/compte');
    await direct.attendreConnexion();
    direct.connecter();
    await userEvent.click(await screen.findByRole('button', { name: 'Se déconnecter' }));
    await waitFor(() => expect(direct.socket.fermee).toBe(true));
  });

  it('messagerie : accessible par le menu de l’en-tête avec sa pastille de non lus', async () => {
    installer();
    const direct = simulerDirect();
    rendreApp('/');
    await direct.attendreConnexion();
    direct.connecter({ non_lus: 4 });
    // Messagerie : absente des cinq onglets de la maquette, elle reste dans le menu de l'en-tête (avec le nombre de non lus)
    const barre = await screen.findByRole('navigation', { name: 'Navigation mobile' });
    expect(within(barre).getAllByRole('link').map((l) => l.getAttribute('href')))
      .toEqual(['/', '/catalogue', '/realisations', '/commandes', '/compte']);
    const menu = await screen.findByRole('button', { name: 'Menu, Messages, 4 non lus' });
    await userEvent.click(menu);
    const lien = within(document.getElementById(menu.getAttribute('aria-controls'))).getByRole('link', { name: 'Messages, 4 non lus' });
    expect(lien).toHaveAttribute('href', '/messages');
  });

  describe('connexion coupée', () => {
    beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
    afterEach(() => vi.useRealTimers());

    it('bandeau « connexion en direct interrompue » et lecture HTTP toutes les 15 secondes', async () => {
      const fetch = installer({
        'GET /api/messagerie/non-lus/': reponse(200, { non_lus: 3 }),
        'POST /api/comptes/connexion/rafraichir/': reponse(200, { acces: 'A2', rafraichissement: 'R1' }),
      });
      const direct = simulerDirect();
      rendreApp('/');
      await direct.attendreConnexion();
      direct.connecter();
      expect(screen.queryByText(/Connexion en direct interrompue/)).not.toBeInTheDocument();
      direct.couper();
      expect(await screen.findByText(/Connexion en direct interrompue/)).toBeInTheDocument();
      const avant = appels(fetch, 'GET', '/api/messagerie/non-lus/').length;
      await act(async () => { await vi.advanceTimersByTimeAsync(DELAI_LECTURE_HTTP + 100); });
      expect(appels(fetch, 'GET', '/api/messagerie/non-lus/').length).toBeGreaterThan(avant);
      expect(appels(fetch, 'GET', '/api/notifications/non-lues/').length).toBeGreaterThan(1);
      expect(await screen.findByRole('link', { name: 'Messages, 3 non lus' })).toBeInTheDocument();
    });
  });
});

describe('CentreNotifications', () => {
  it('menu des dernières notifications ; ouvrir une notification la marque lue et suit son lien', async () => {
    const fetch = installer({
      'GET /api/notifications/': reponse(200, page([NOTIF(1), NOTIF(2, { lue: true, lien: '/messages' })])),
      'POST /api/notifications/1/lue/': reponse(200, {}),
      'GET /api/commandes/12/': reponse(404, {}),
    });
    const direct = simulerDirect();
    rendreApp('/');
    await direct.attendreConnexion();
    direct.connecter({ notifications_non_lues: 1 });
    const cloche = await screen.findByRole('button', { name: 'Notifications, 1 non lue' });
    expect(cloche).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(cloche);
    expect(cloche).toHaveAttribute('aria-expanded', 'true');
    const menu = await screen.findByRole('region', { name: 'Dernières notifications' });
    expect(await within(menu).findByText('Titre 1')).toBeInTheDocument();
    expect(within(menu).getByText('Texte 2')).toBeInTheDocument();
    expect(within(menu).getByRole('link', { name: 'Voir toutes les notifications' })).toHaveAttribute('href', '/notifications');
    await userEvent.click(within(menu).getByRole('button', { name: /Titre 1/ }));
    await waitFor(() => expect(appels(fetch, 'POST', '/api/notifications/1/lue/')).toHaveLength(1));
    await waitFor(() => expect(emplacement()).toBe('/commandes/12'));
    expect(screen.queryByRole('region', { name: 'Dernières notifications' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument(); // compteur retombé à 0
  });

  it('Échap ferme le menu et rend le focus à la cloche', async () => {
    installer();
    const direct = simulerDirect();
    rendreApp('/');
    await direct.attendreConnexion();
    direct.connecter();
    const cloche = await screen.findByRole('button', { name: 'Notifications' });
    await userEvent.click(cloche);
    await screen.findByRole('region', { name: 'Dernières notifications' });
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: 'Dernières notifications' })).not.toBeInTheDocument();
    expect(cloche).toHaveFocus();
  });

  it('« Tout marquer comme lu » dans le menu', async () => {
    const fetch = installer({
      'GET /api/notifications/': reponse(200, page([NOTIF(1), NOTIF(2)])),
      'POST /api/notifications/lues/': reponse(200, { count: 0 }),
    });
    const direct = simulerDirect();
    rendreApp('/');
    await direct.attendreConnexion();
    direct.connecter({ notifications_non_lues: 2 });
    await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 2 non lues' }));
    const menu = await screen.findByRole('region', { name: 'Dernières notifications' });
    await userEvent.click(within(menu).getByRole('button', { name: 'Tout marquer comme lu' }));
    await waitFor(() => expect(appels(fetch, 'POST', '/api/notifications/lues/')).toHaveLength(1));
    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('une notification reçue en direct est annoncée et ajoutée au menu ouvert', async () => {
    installer({ 'GET /api/notifications/': reponse(200, page([NOTIF(1)])) });
    const direct = simulerDirect();
    rendreApp('/');
    await direct.attendreConnexion();
    direct.connecter();
    await userEvent.click(await screen.findByRole('button', { name: 'Notifications' }));
    await screen.findByText('Titre 1');
    direct.recevoir({ type: 'notification', notification: NOTIF(9, { titre: 'Devis reçu', texte: 'Votre devis est prêt' }) });
    const menu = screen.getByRole('region', { name: 'Dernières notifications' });
    expect(within(menu).getByText('Devis reçu')).toBeInTheDocument();
    expect(screen.getAllByRole('status').some((n) => n.textContent.includes('Devis reçu Votre devis est prêt'))).toBe(true);
  });
});

describe('NotificationsPage', () => {
  it('liste paginée avec « Voir plus », non lues repérées par un texte, lien vers la cible', async () => {
    const fetch = installer({
      'GET /api/notifications/': (_c, _i, url) => (url.searchParams.get('page') === '2'
        ? reponse(200, page([NOTIF(3, { titre: 'Troisième', lue: true })], { count: 3 }))
        : reponse(200, page([NOTIF(1), NOTIF(2, { lue: true })], { count: 3, next: 'http://x/?page=2' }))),
      'POST /api/notifications/1/lue/': reponse(200, {}),
      'GET /api/commandes/12/': reponse(404, {}),
    });
    rendreApp('/notifications');
    expect(await screen.findByRole('heading', { level: 1, name: 'Notifications' })).toBeInTheDocument();
    const liste = await screen.findByRole('list', { name: 'Liste des notifications' });
    expect(within(liste).getAllByRole('listitem')).toHaveLength(2);
    expect(within(liste).getAllByText('Non lue')).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Voir plus' }));
    expect(await screen.findByText('Troisième')).toBeInTheDocument();
    expect(parametresDes(fetch, '/api/notifications/').some((p) => p.get('page') === '2')).toBe(true);
    await userEvent.click(within(liste).getByRole('link', { name: /Titre 1/ }));
    await waitFor(() => expect(appels(fetch, 'POST', '/api/notifications/1/lue/')).toHaveLength(1));
    await waitFor(() => expect(emplacement()).toBe('/commandes/12'));
  });

  it('filtre « Non lues » : demande ?lue=0', async () => {
    const fetch = installer({ 'GET /api/notifications/': reponse(200, page([NOTIF(1)])) });
    rendreApp('/notifications');
    await screen.findByText('Titre 1');
    await userEvent.click(screen.getByRole('button', { name: 'Non lues' }));
    await waitFor(() => expect(parametresDes(fetch, '/api/notifications/').some((p) => p.get('lue') === '0')).toBe(true));
  });

  it('« Tout marquer comme lu » met la liste à jour', async () => {
    const fetch = installer({
      'GET /api/notifications/': reponse(200, page([NOTIF(1), NOTIF(2)])),
      'GET /api/notifications/non-lues/': reponse(200, { count: 2 }),
      'POST /api/notifications/lues/': reponse(200, { count: 0 }),
    });
    rendreApp('/notifications');
    const liste = await screen.findByRole('list', { name: 'Liste des notifications' });
    await screen.findAllByText('Non lue');
    await userEvent.click(screen.getByRole('button', { name: 'Tout marquer comme lu' }));
    await waitFor(() => expect(within(liste).queryAllByText('Non lue')).toHaveLength(0));
    expect(appels(fetch, 'POST', '/api/notifications/lues/')).toHaveLength(1);
  });

  it('liste vide', async () => {
    installer();
    rendreApp('/notifications');
    expect(await screen.findByText("Vous n'avez aucune notification.")).toBeInTheDocument();
  });

  it('page protégée : un visiteur est renvoyé vers la connexion', async () => {
    simulerApi();
    rendreApp('/notifications');
    await waitFor(() => expect(emplacement()).toBe('/connexion?suite=%2Fnotifications'));
  });
});

describe('préférence « nouveautés par e-mail »', () => {
  it('désactivée par défaut ; l’activer enregistre le consentement', async () => {
    const fetch = installer({
      'PATCH /api/notifications/preferences/': (corps) => reponse(200, { recevoir_nouveautes: corps.recevoir_nouveautes }),
    });
    rendreApp('/notifications');
    const case1 = await screen.findByRole('checkbox', { name: 'Recevoir les nouveautés par e-mail' });
    expect(case1).not.toBeChecked();
    await userEvent.click(case1);
    await waitFor(() => expect(appels(fetch, 'PATCH', '/api/notifications/preferences/')).toHaveLength(1));
    expect(appels(fetch, 'PATCH', '/api/notifications/preferences/')[0][0]).toEqual({ recevoir_nouveautes: true });
    expect(await screen.findByText('Vous recevrez les nouveautés par e-mail.')).toBeInTheDocument();
    expect(case1).toBeChecked();
  });

  it('reprend la valeur du serveur ; la désactiver est possible', async () => {
    const fetch = installer({
      'GET /api/notifications/preferences/': reponse(200, { recevoir_nouveautes: true }),
      'PATCH /api/notifications/preferences/': (corps) => reponse(200, corps),
    });
    rendreApp('/notifications');
    const c = await screen.findByRole('checkbox', { name: 'Recevoir les nouveautés par e-mail' });
    await waitFor(() => expect(c).toBeChecked());
    await userEvent.click(c);
    expect(await screen.findByText('Vous ne recevrez plus les nouveautés par e-mail.')).toBeInTheDocument();
    expect(appels(fetch, 'PATCH', '/api/notifications/preferences/')[0][0]).toEqual({ recevoir_nouveautes: false });
  });

  it('un échec remet la case dans son état précédent et explique', async () => {
    installer({ 'PATCH /api/notifications/preferences/': reponse(500, {}) });
    rendreApp('/notifications');
    const c = await screen.findByRole('checkbox', { name: 'Recevoir les nouveautés par e-mail' });
    await userEvent.click(c);
    expect(await screen.findByText(/Le serveur rencontre un problème/)).toBeInTheDocument();
    expect(c).not.toBeChecked();
  });

  it('présente aussi dans le profil (valeur du compte)', async () => {
    simulerApi(routesClient({
      'GET /api/comptes/moi/': reponse(200, { ...UTILISATEUR, recevoir_nouveautes: true }),
      'GET /api/messagerie/non-lus/': reponse(200, { non_lus: 0 }),
    }, { utilisateur: { ...UTILISATEUR, recevoir_nouveautes: true } }));
    rendreApp('/compte');
    const c = await screen.findByRole('checkbox', { name: 'Recevoir les nouveautés par e-mail' });
    expect(c).toBeChecked();
  });
});
