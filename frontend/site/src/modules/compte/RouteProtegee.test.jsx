// Tests de la route protégée et de la session (AuthProvider).
import { render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';

import { api } from '@/app/api.js';
import { CLE_JETONS, connecterLocalement, emplacement, reponse, rendreAvecRoutes, simulerApi, UTILISATEUR } from '@/test/outils.jsx';

import { useAuth } from './AuthContext.jsx';
import RouteProtegee from './RouteProtegee.jsx';

const rendre = (chemin) => rendreAvecRoutes(
  chemin,
  { '/connexion': <p>Page connexion</p> },
  { Protection: RouteProtegee, protegees: { '/compte': <p>Page compte</p>, '/commandes': <p>Page commandes</p> } },
);

describe('RouteProtegee', () => {
  it('sans session : redirige vers /connexion avec la page demandée en suite', async () => {
    const fetch = simulerApi();
    rendre('/commandes?filtre=en-cours');
    expect(await screen.findByText('Page connexion')).toBeInTheDocument();
    expect(emplacement()).toBe('/connexion?suite=%2Fcommandes%3Ffiltre%3Den-cours');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('session valide : affiche la page après vérification du profil', async () => {
    connecterLocalement();
    let liberer;
    simulerApi({ 'GET /api/comptes/moi/': () => new Promise((r) => { liberer = () => r(reponse(200, UTILISATEUR)); }) });
    rendre('/compte');
    expect(screen.getByText('Vérification de votre session…')).toBeInTheDocument();
    await waitFor(() => expect(liberer).toBeTypeOf('function'));
    liberer();
    expect(await screen.findByText('Page compte')).toBeInTheDocument();
  });

  it('jetons refusés (moi 401, rafraîchissement refusé) : jetons effacés et redirection', async () => {
    connecterLocalement();
    simulerApi({
      'GET /api/comptes/moi/': reponse(401, { detail: 'expiré' }),
      'POST /api/comptes/connexion/rafraichir/': reponse(401, { detail: 'Le jeton est invalide ou expiré' }),
    });
    rendre('/compte');
    expect(await screen.findByText('Page connexion')).toBeInTheDocument();
    expect(localStorage.getItem(CLE_JETONS)).toBeNull();
  });

  it('coupure réseau au démarrage : la session locale n’est pas effacée', async () => {
    connecterLocalement();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    rendre('/compte');
    expect(await screen.findByText('Page connexion')).toBeInTheDocument();
    expect(localStorage.getItem(CLE_JETONS)).not.toBeNull();
  });

  it('accepte aussi des enfants directs', async () => {
    connecterLocalement();
    simulerApi({ 'GET /api/comptes/moi/': reponse(200, UTILISATEUR) });
    rendreAvecRoutes('/prive', { '/prive': <RouteProtegee><p>Contenu privé</p></RouteProtegee> });
    expect(await screen.findByText('Contenu privé')).toBeInTheDocument();
  });
});

describe('AuthProvider', () => {
  function Sonde() {
    const { utilisateur, pret, connecte } = useAuth();
    return <p>{pret ? `${connecte ? utilisateur.email : 'anonyme'}` : 'attente'}</p>;
  }

  it('se déconnecte quand les jetons disparaissent (ex. autre onglet, session expirée)', async () => {
    connecterLocalement();
    simulerApi({ 'GET /api/comptes/moi/': reponse(200, UTILISATEUR) });
    rendreAvecRoutes('/', { '/': <Sonde /> });
    expect(await screen.findByText(UTILISATEUR.email)).toBeInTheDocument();
    act(() => api.jetons.effacer());
    expect(await screen.findByText('anonyme')).toBeInTheDocument();
  });

  it('useAuth hors du fournisseur : erreur explicite', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Sonde />)).toThrow(/AuthProvider/);
  });
});
