// Fond en direct de la coque : pastilles du menu en direct, repli HTTP, bandeau « connexion interrompue »,
// connexion unique authentifiée par la première trame.
import { act, screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';

import { installerDirect } from '@/test/direct-simule.js';
import { appels, rendre, simulerApi } from '@/test/api-simulee.jsx';

const menu = () => screen.findByRole('navigation', { name: 'Menu du tableau de bord' });

describe('FondDirect', () => {
  it("ouvre une seule connexion /ws/ et s'authentifie par la première trame, jamais dans l'adresse", async () => {
    const direct = installerDirect();
    simulerApi([]);
    rendre('/');
    await waitFor(() => expect(direct.instances).toHaveLength(1));
    expect(direct.derniere().url).toMatch(/\/ws\/$/);
    expect(direct.derniere().url).not.toMatch(/jeton|token|a$/);
    act(() => direct.derniere().onopen());
    expect(direct.derniere().envoyes[0]).toEqual({ type: 'authentifier', jeton: 'a' });
    // Naviguer ne rouvre pas de connexion.
    expect(direct.instances).toHaveLength(1);
  });

  it('met les pastilles Messagerie et Notifications à jour en direct', async () => {
    const direct = installerDirect();
    simulerApi([]);
    rendre('/');
    const nav = await menu();
    await waitFor(() => expect(direct.instances).toHaveLength(1));
    direct.connecter({ utilisateur: { id: 2, role: 'membre' }, non_lus: 3, notifications_non_lues: 1 });
    expect(await within(nav).findByRole('link', { name: /^Messagerie\s+3 non lus$/u })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: /^Notifications\s+1 non lue$/u })).toBeInTheDocument();
    direct.recevoir({ type: 'non_lus', messagerie: 0, notifications: 4 });
    await waitFor(() => expect(within(nav).getByRole('link', { name: 'Messagerie' })).toBeInTheDocument());
    expect(within(nav).getByRole('link', { name: /^Notifications\s+4 non lues$/u })).toBeInTheDocument();
  });

  it("lit les compteurs en HTTP à l'ouverture, même sans WebSocket", async () => {
    installerDirect();
    simulerApi([
      ['GET', '/api/admin/messagerie/resume/', { non_lus_total: 4, conversations_non_lues: 2 }],
      ['GET', '/api/admin/appels/resume/', { en_attente: 0, manques_non_vus: 2 }],
      ['GET', '/api/admin/notifications/non-lues/', { count: 6 }],
    ]);
    rendre('/');
    const nav = await menu();
    expect(await within(nav).findByRole('link', { name: /^Messagerie\s+4 non lus$/u })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: /^Appels\s+2 à traiter$/u })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: /^Notifications\s+6 non lues$/u })).toBeInTheDocument();
  });

  it('affiche un bandeau quand le direct est coupé et reprend en HTTP toutes les 15 secondes', async () => {
    const direct = installerDirect();
    const minuteurs = vi.spyOn(globalThis, 'setInterval');
    const simule = simulerApi([['GET', '/api/admin/messagerie/resume/', { non_lus_total: 1, conversations_non_lues: 1 }]]);
    rendre('/');
    await waitFor(() => expect(direct.instances).toHaveLength(1));
    direct.connecter();
    expect(screen.queryByText(/connexion en direct est interrompue/)).not.toBeInTheDocument();
    direct.couper();
    const bandeau = await screen.findByRole('status');
    expect(bandeau).toHaveTextContent('La connexion en direct est interrompue');
    // Repli : un minuteur de 15 s relit les compteurs.
    const repli = await waitFor(() => {
      const appel = minuteurs.mock.calls.find(([, delai]) => delai === 15_000);
      expect(appel).toBeTruthy();
      return appel[0];
    });
    const avant = appels(simule, 'GET', '/api/admin/messagerie/resume/').length;
    await act(async () => { repli(); });
    await waitFor(() => expect(appels(simule, 'GET', '/api/admin/messagerie/resume/').length).toBeGreaterThan(avant));
  });

  it('coupe la connexion à la déconnexion', async () => {
    const direct = installerDirect();
    simulerApi([]);
    const { unmount } = rendre('/');
    await waitFor(() => expect(direct.instances).toHaveLength(1));
    const fermer = vi.spyOn(direct.derniere(), 'close');
    unmount();
    expect(fermer).toHaveBeenCalled();
  });
});
