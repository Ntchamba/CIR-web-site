// Tests de la page de connexion : bonne route, champs en français, erreurs, retour à la page demandée.
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { appels, CLE_JETONS, emplacement, reponse, rendreAvecRoutes, simulerApi, UTILISATEUR } from '@/test/outils.jsx';

import ConnexionPage from './ConnexionPage.jsx';

const rendre = (chemin = '/connexion') => rendreAvecRoutes(chemin, {
  '/connexion': <ConnexionPage />,
  '/compte': <p>Page compte</p>,
  '/commandes': <p>Page commandes</p>,
  '/inscription': <p>Page inscription</p>,
});

async function remplir(email, motDePasse) {
  const u = userEvent.setup();
  if (email) await u.type(screen.getByLabelText(/E-mail/), email);
  if (motDePasse) await u.type(screen.getByLabelText(/Mot de passe/), motDePasse);
  await u.click(screen.getByRole('button', { name: 'Se connecter' }));
}

describe('ConnexionPage', () => {
  it('affiche le formulaire accessible', async () => {
    simulerApi();
    rendre();
    expect(await screen.findByRole('heading', { level: 1, name: /Votre sol, révélé/ })).toBeInTheDocument();
    // onglets de la maquette : « Se connecter » (courant) et « Créer un compte »
    expect(screen.getByRole('link', { name: 'Se connecter' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Créer un compte' })).toHaveAttribute('href', '/inscription');
    expect(screen.getByLabelText(/E-mail/)).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText(/Mot de passe/)).toHaveAttribute('type', 'password');
    expect(document.title).toMatch(/^Se connecter/);
  });

  it('valide avant envoi : aucun appel réseau si les champs sont vides', async () => {
    const fetch = simulerApi();
    rendre();
    await remplir('', '');
    expect(screen.getByText('Indiquez votre adresse e-mail.')).toBeInTheDocument();
    expect(screen.getByText('Indiquez votre mot de passe.')).toBeInTheDocument();
    expect(screen.getByLabelText(/E-mail/)).toHaveAttribute('aria-invalid', 'true');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('appelle POST /api/comptes/connexion/ avec email et mot_de_passe, range les jetons, puis /compte', async () => {
    const fetch = simulerApi({
      'POST /api/comptes/connexion/': reponse(200, { acces: 'A1', rafraichissement: 'R1', utilisateur: UTILISATEUR }),
    });
    rendre();
    await remplir('  awa@exemple.cm ', 'motdepasse1');
    await waitFor(() => expect(emplacement()).toBe('/compte'));
    const [[corps, init]] = appels(fetch, 'POST', '/api/comptes/connexion/');
    expect(corps).toEqual({ email: 'awa@exemple.cm', mot_de_passe: 'motdepasse1' });
    expect(init.headers.Authorization).toBeUndefined();
    expect(JSON.parse(localStorage.getItem(CLE_JETONS))).toEqual({ acces: 'A1', rafraichissement: 'R1' });
  });

  it('retourne à la page demandée (?suite=/commandes)', async () => {
    simulerApi({
      'POST /api/comptes/connexion/': reponse(200, { acces: 'A1', rafraichissement: 'R1', utilisateur: UTILISATEUR }),
    });
    rendre('/connexion?suite=%2Fcommandes');
    await remplir('awa@exemple.cm', 'motdepasse1');
    await waitFor(() => expect(emplacement()).toBe('/commandes'));
  });

  it('ignore une suite externe et renvoie vers /compte', async () => {
    simulerApi({
      'POST /api/comptes/connexion/': reponse(200, { acces: 'A1', rafraichissement: 'R1', utilisateur: UTILISATEUR }),
    });
    rendre('/connexion?suite=https%3A%2F%2Fpirate.example');
    await remplir('awa@exemple.cm', 'motdepasse1');
    await waitFor(() => expect(emplacement()).toBe('/compte'));
  });

  it('identifiants refusés (401) : message du serveur, aucun jeton, reste sur la page', async () => {
    simulerApi({ 'POST /api/comptes/connexion/': reponse(401, { detail: 'E-mail ou mot de passe incorrect.' }) });
    rendre();
    await remplir('awa@exemple.cm', 'mauvais');
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou mot de passe incorrect.');
    expect(localStorage.getItem(CLE_JETONS)).toBeNull();
    expect(emplacement()).toBe('/connexion');
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeEnabled();
  });

  it('serveur injoignable : message hors ligne', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    rendre();
    await remplir('awa@exemple.cm', 'motdepasse1');
    expect(await screen.findByRole('alert')).toHaveTextContent(/Connexion au serveur impossible/);
  });

  it('erreur par champ du serveur affichée sous le champ', async () => {
    simulerApi({ 'POST /api/comptes/connexion/': reponse(400, { mot_de_passe: ['Ce champ est obligatoire.'] }) });
    rendre();
    await remplir('awa@exemple.cm', 'x');
    await screen.findByRole('alert');
    expect(screen.getByLabelText(/Mot de passe/)).toHaveAccessibleDescription('Ce champ est obligatoire.');
  });

  it('le lien « Créer un compte » garde la suite', async () => {
    simulerApi();
    rendre('/connexion?suite=%2Fcommandes');
    expect(await screen.findByRole('link', { name: 'Créer un compte' })).toHaveAttribute('href', '/inscription?suite=%2Fcommandes');
  });
});
