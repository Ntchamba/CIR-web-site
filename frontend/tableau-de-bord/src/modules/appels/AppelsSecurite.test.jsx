// Appels et notifications (équipe) : liens externes refusés, écrans réservés au super-administrateur.
import { screen, within } from '@testing-library/react';
import { vi } from 'vitest';

import { installerDirect } from '@/test/direct-simule.js';
import { appels, page, rendre, simulerApi } from '@/test/api-simulee.jsx';

const manque = (lien) => ({
  id: 30, reference: 'APP-2026-0030', type: 'audio', etat: 'manque', client: { id: 9, nom_complet: 'Paul Eto', telephone: '677 00 11 22' },
  commande: null, cree_le: '2026-10-19T16:00:00Z', demarre_le: null, termine_le: null, repondu_par: null, duree_secondes: null,
  rappel: { telephone: '677 00 11 22', lien_messagerie: lien },
});

afterEach(() => vi.unstubAllGlobals());

describe('lien « Écrire » des appels manqués', () => {
  it.each([['https://pirate.example/x'], ['//pirate.example/x'], ['javascript:alert(1)'], [undefined]])(
    'ignore le lien du serveur %s et ouvre la messagerie du client',
    async (lien) => {
      installerDirect();
      simulerApi([
        ['GET', 'appels/usage/', { mois: '2026-10', utilisateurs_actifs: 1, limite_gratuite: 25, depasse: false, proche: false }],
        ['GET', '/api/admin/appels/', page([manque(lien)])],
      ]);
      rendre('/appels');
      const ligne = (await screen.findByText('APP-2026-0030')).closest('tr');
      expect(within(ligne).getByRole('link', { name: 'Écrire à Paul Eto' })).toHaveAttribute('href', '/messagerie?client=9');
    },
  );

  it('accepte un lien interne du serveur', async () => {
    installerDirect();
    simulerApi([
      ['GET', 'appels/usage/', { mois: '2026-10', utilisateurs_actifs: 1, limite_gratuite: 25, depasse: false, proche: false }],
      ['GET', '/api/admin/appels/', page([manque('/messagerie?conversation=4')])],
    ]);
    rendre('/appels');
    const ligne = (await screen.findByText('APP-2026-0030')).closest('tr');
    expect(within(ligne).getByRole('link', { name: 'Écrire à Paul Eto' })).toHaveAttribute('href', '/messagerie?conversation=4');
  });
});

describe('écrans réservés au super-administrateur', () => {
  it("un membre n'appelle jamais les modèles ni les envois, même avec ?onglet= dans l'adresse", async () => {
    installerDirect();
    const simule = simulerApi([
      ['GET', 'notifications/preferences/', { email_equipe: true }],
      ['GET', '/api/admin/notifications/', page([])],
    ]);
    for (const onglet of ['modeles', 'envois']) {
      const { unmount } = rendre(`/notifications?onglet=${onglet}`);
      expect(await screen.findByRole('heading', { name: 'Notifications', level: 1 })).toBeInTheDocument();
      unmount();
    }
    expect(appels(simule, 'GET', '/notifications/modeles/')).toHaveLength(0);
    expect(appels(simule, 'GET', '/notifications/envois/')).toHaveLength(0);
  });
});
