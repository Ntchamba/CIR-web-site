// Session de l'équipe : restauration, refus des comptes clients, déconnexion, jetons effacés ailleurs.
import { act, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

import { api } from '@/app/api.js';

import { AuthProvider, MESSAGE_ACCES_REFUSE, useAuth } from './AuthContext.jsx';

const MEMBRE = { id: 2, email: 'm@cir.cm', nom_complet: 'Jean Mbarga', role: 'membre', est_equipe: true };
const SUPER_ADMIN = { id: 1, email: 'a@cir.cm', nom_complet: 'Awa Nana', role: 'super_admin', est_equipe: true };
const CLIENT = { id: 9, email: 'c@exemple.cm', nom_complet: 'Paul Client', role: 'client', est_equipe: false };

function reponse(statut, corps) {
  return Promise.resolve(new Response(corps == null ? null : JSON.stringify(corps), {
    status: statut,
    headers: { 'Content-Type': 'application/json' },
  }));
}

const poserJetons = () => localStorage.setItem('cir-tdb.jetons', JSON.stringify({ acces: 'a', rafraichissement: 'r' }));

let session;
function Sonde() {
  session = useAuth();
  return (
    <p data-testid="etat">
      {session.pret ? 'pret' : 'attente'}|{session.utilisateur?.email || 'personne'}|{session.superAdmin ? 'sa' : '-'}
    </p>
  );
}

const rendre = () => render(<AuthProvider><Sonde /></AuthProvider>);
const etat = () => screen.getByTestId('etat').textContent;

describe('AuthProvider : restauration de la session', () => {
  it("est prêt tout de suite et n'appelle pas le serveur sans jetons", async () => {
    vi.stubGlobal('fetch', vi.fn());
    rendre();
    expect(etat()).toBe('pret|personne|-');
    expect(fetch).not.toHaveBeenCalled();
  });

  it("restaure un membre de l'équipe avec /api/comptes/moi/", async () => {
    poserJetons();
    const simule = vi.fn(() => reponse(200, SUPER_ADMIN));
    vi.stubGlobal('fetch', simule);
    rendre();
    expect(etat()).toBe('attente|personne|-');
    await waitFor(() => expect(etat()).toBe('pret|a@cir.cm|sa'));
    expect(String(simule.mock.calls[0][0])).toContain('/api/comptes/moi/');
    expect(simule.mock.calls[0][1].headers.Authorization).toBe('Bearer a');
  });

  it('écarte une session client restée dans le navigateur et efface ses jetons', async () => {
    poserJetons();
    vi.stubGlobal('fetch', vi.fn(() => reponse(200, CLIENT)));
    rendre();
    await waitFor(() => expect(etat()).toBe('pret|personne|-'));
    expect(localStorage.getItem('cir-tdb.jetons')).toBeNull();
  });

  it('efface les jetons refusés (401 puis rafraîchissement refusé)', async () => {
    poserJetons();
    vi.stubGlobal('fetch', vi.fn(() => reponse(401, { detail: 'Jeton invalide.' })));
    rendre();
    await waitFor(() => expect(etat()).toBe('pret|personne|-'));
    expect(localStorage.getItem('cir-tdb.jetons')).toBeNull();
  });

  it('efface les jetons sur un 403 (compte désactivé)', async () => {
    poserJetons();
    vi.stubGlobal('fetch', vi.fn(() => reponse(403, { detail: 'Compte désactivé.' })));
    rendre();
    await waitFor(() => expect(etat()).toBe('pret|personne|-'));
    expect(localStorage.getItem('cir-tdb.jetons')).toBeNull();
  });

  it('garde les jetons quand le serveur est injoignable', async () => {
    poserJetons();
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    rendre();
    await waitFor(() => expect(etat()).toBe('pret|personne|-'));
    expect(localStorage.getItem('cir-tdb.jetons')).not.toBeNull();
  });

  it("n'utilise jamais les jetons du site public", async () => {
    localStorage.setItem('cir-site.jetons', JSON.stringify({ acces: 'site', rafraichissement: 'site' }));
    vi.stubGlobal('fetch', vi.fn());
    rendre();
    expect(etat()).toBe('pret|personne|-');
    expect(fetch).not.toHaveBeenCalled();
  });

  it("se déconnecte si les jetons sont effacés ailleurs (session expirée, autre onglet)", async () => {
    poserJetons();
    vi.stubGlobal('fetch', vi.fn(() => reponse(200, MEMBRE)));
    rendre();
    await waitFor(() => expect(etat()).toBe('pret|m@cir.cm|-'));
    act(() => api.jetons.effacer());
    expect(etat()).toBe('pret|personne|-');
  });
});

describe('AuthProvider : connexion', () => {
  it("envoie { email, mot_de_passe } à la route de l'équipe et range les jetons", async () => {
    const simule = vi.fn(() => reponse(200, { acces: 'A', rafraichissement: 'R', utilisateur: MEMBRE }));
    vi.stubGlobal('fetch', simule);
    rendre();
    await act(() => session.seConnecter('m@cir.cm', 'secret'));
    const [url, options] = simule.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/admin\/comptes\/connexion\/$/);
    expect(JSON.parse(options.body)).toEqual({ email: 'm@cir.cm', mot_de_passe: 'secret' });
    expect(options.headers.Authorization).toBeUndefined();
    expect(JSON.parse(localStorage.getItem('cir-tdb.jetons'))).toEqual({ acces: 'A', rafraichissement: 'R' });
    expect(etat()).toBe('pret|m@cir.cm|-');
  });

  it('refuse un client même si le serveur renvoie des jetons (double sécurité)', async () => {
    vi.stubGlobal('fetch', vi.fn(() => reponse(200, { acces: 'A', rafraichissement: 'R', utilisateur: CLIENT })));
    rendre();
    let erreur;
    await act(async () => {
      try { await session.seConnecter('c@exemple.cm', 'x'); } catch (e) { erreur = e; }
    });
    expect(erreur?.name).toBe('ErreurApi');
    expect(erreur.statut).toBe(403);
    expect(erreur.message).toBe(MESSAGE_ACCES_REFUSE);
    expect(localStorage.getItem('cir-tdb.jetons')).toBeNull();
    expect(etat()).toBe('pret|personne|-');
  });

  it("interroge /moi/ si la réponse ne contient pas l'utilisateur, et refuse un client", async () => {
    const simule = vi.fn((url) => (String(url).includes('/moi/')
      ? reponse(200, CLIENT)
      : reponse(200, { acces: 'A', rafraichissement: 'R' })));
    vi.stubGlobal('fetch', simule);
    rendre();
    await act(async () => {
      await expect(session.seConnecter('c@exemple.cm', 'x')).rejects.toMatchObject({ statut: 403 });
    });
    expect(simule).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem('cir-tdb.jetons')).toBeNull();
  });

  it('efface les jetons si /moi/ échoue après la connexion', async () => {
    const simule = vi.fn((url) => (String(url).includes('/moi/')
      ? reponse(500, null)
      : reponse(200, { acces: 'A', rafraichissement: 'R' })));
    vi.stubGlobal('fetch', simule);
    rendre();
    await act(async () => {
      await expect(session.seConnecter('m@cir.cm', 'x')).rejects.toMatchObject({ statut: 500 });
    });
    expect(localStorage.getItem('cir-tdb.jetons')).toBeNull();
  });

  it('relaie le message du serveur pour un mot de passe incorrect (401, sans rafraîchissement)', async () => {
    const simule = vi.fn(() => reponse(401, { detail: 'E-mail ou mot de passe incorrect.' }));
    vi.stubGlobal('fetch', simule);
    rendre();
    await act(async () => {
      await expect(session.seConnecter('m@cir.cm', 'faux')).rejects.toMatchObject({
        statut: 401, message: 'E-mail ou mot de passe incorrect.',
      });
    });
    expect(simule).toHaveBeenCalledTimes(1);
  });
});

describe('AuthProvider : déconnexion', () => {
  it('met le jeton de rafraîchissement en liste noire puis efface la session', async () => {
    poserJetons();
    const simule = vi.fn((url) => (String(url).includes('/deconnexion/') ? reponse(204, null) : reponse(200, MEMBRE)));
    vi.stubGlobal('fetch', simule);
    rendre();
    await waitFor(() => expect(etat()).toBe('pret|m@cir.cm|-'));
    await act(() => session.seDeconnecter());
    const appel = simule.mock.calls.find(([u]) => String(u).includes('/api/comptes/deconnexion/'));
    expect(JSON.parse(appel[1].body)).toEqual({ rafraichissement: 'r' });
    expect(localStorage.getItem('cir-tdb.jetons')).toBeNull();
    expect(etat()).toBe('pret|personne|-');
  });

  it('déconnecte même hors ligne', async () => {
    poserJetons();
    vi.stubGlobal('fetch', vi.fn(() => reponse(200, MEMBRE)));
    rendre();
    await waitFor(() => expect(etat()).toBe('pret|m@cir.cm|-'));
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    await act(() => session.seDeconnecter());
    expect(localStorage.getItem('cir-tdb.jetons')).toBeNull();
    expect(etat()).toBe('pret|personne|-');
  });
});

describe('useAuth', () => {
  it('signale une utilisation hors de <AuthProvider>', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Sonde />)).toThrow(/AuthProvider/);
  });
});

