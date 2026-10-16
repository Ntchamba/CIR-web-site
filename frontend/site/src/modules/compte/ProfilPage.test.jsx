// Tests de la page « Mon compte » : adresse obligatoire pour commander, modification, déconnexion.
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { appels, CLE_JETONS, connecterLocalement, emplacement, reponse, rendreAvecRoutes, simulerApi, UTILISATEUR } from '@/test/outils.jsx';

import ProfilPage from './ProfilPage.jsx';
import RouteProtegee from './RouteProtegee.jsx';

const rendre = () => rendreAvecRoutes(
  '/compte',
  { '/': <p>Accueil</p>, '/connexion': <p>Page connexion</p> },
  { Protection: RouteProtegee, protegees: { '/compte': <ProfilPage /> } },
);

describe('ProfilPage', () => {
  it('affiche l’identité, l’adresse formatée du serveur et l’e-mail en lecture seule', async () => {
    connecterLocalement();
    simulerApi({ 'GET /api/comptes/moi/': reponse(200, UTILISATEUR) });
    rendre();
    expect(await screen.findByRole('heading', { level: 2, name: 'Awa Ngono' })).toBeInTheDocument();
    expect(screen.getByText('Adresse renseignée : vous pouvez commander.')).toBeInTheDocument();
    expect(screen.getByText(UTILISATEUR.adresse_formatee)).toBeInTheDocument();
    expect(screen.getByLabelText(/E-mail/)).toHaveAttribute('readonly');
    expect(screen.getByLabelText(/Ville/)).toHaveValue('Douala');
  });

  it('adresse incomplète selon le serveur (adresse_complete = false) : invite à la compléter', async () => {
    connecterLocalement();
    simulerApi({
      'GET /api/comptes/moi/': reponse(200, { ...UTILISATEUR, rue_ou_repere: '', adresse_complete: false, adresse_formatee: '' }),
    });
    rendre();
    expect(await screen.findByText('Ajoutez votre adresse complète pour pouvoir commander.')).toBeInTheDocument();
  });

  it('refuse d’enregistrer sans adresse : aucun PATCH', async () => {
    connecterLocalement();
    const fetch = simulerApi({ 'GET /api/comptes/moi/': reponse(200, UTILISATEUR) });
    rendre();
    const u = userEvent.setup();
    await u.clear(await screen.findByLabelText(/Quartier/));
    await u.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(screen.getByText('Indiquez votre quartier.')).toBeInTheDocument();
    expect(appels(fetch, 'PATCH', '/api/comptes/moi/')).toHaveLength(0);
  });

  it('enregistre par PATCH /api/comptes/moi/ (champs nettoyés, sans e-mail)', async () => {
    connecterLocalement();
    const fetch = simulerApi({
      'GET /api/comptes/moi/': reponse(200, UTILISATEUR),
      'PATCH /api/comptes/moi/': (corps) => reponse(200, { ...UTILISATEUR, ...corps }),
    });
    rendre();
    const u = userEvent.setup();
    const quartier = await screen.findByLabelText(/Quartier/);
    await u.clear(quartier);
    await u.type(quartier, ' Akwa ');
    await u.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Modifications enregistrées.')).toBeInTheDocument();
    const [[corps, init]] = appels(fetch, 'PATCH', '/api/comptes/moi/');
    expect(corps).toEqual({
      nom_complet: 'Awa Ngono',
      telephone: '+237699000000',
      ville: 'Douala',
      quartier: 'Akwa',
      rue_ou_repere: 'Près de la pharmacie',
    });
    expect(init.headers.Authorization).toBe('Bearer A1');
  });

  it('erreur du serveur sur un champ : affichée sous le champ', async () => {
    connecterLocalement();
    simulerApi({
      'GET /api/comptes/moi/': reponse(200, UTILISATEUR),
      'PATCH /api/comptes/moi/': reponse(400, { ville: ['La ville est obligatoire.'] }),
    });
    rendre();
    await userEvent.click(await screen.findByRole('button', { name: 'Enregistrer' }));
    await screen.findByRole('alert');
    expect(screen.getByLabelText(/Ville/)).toHaveAccessibleDescription('La ville est obligatoire.');
  });

  it('déconnexion : liste noire du jeton, jetons effacés, retour à l’accueil', async () => {
    connecterLocalement();
    const fetch = simulerApi({
      'GET /api/comptes/moi/': reponse(200, UTILISATEUR),
      'POST /api/comptes/deconnexion/': reponse(200, {}),
    });
    rendre();
    await userEvent.click(await screen.findByRole('button', { name: 'Se déconnecter' }));
    await waitFor(() => expect(emplacement()).toBe('/'));
    expect(appels(fetch, 'POST', '/api/comptes/deconnexion/')[0][0]).toEqual({ rafraichissement: 'R1' });
    expect(localStorage.getItem(CLE_JETONS)).toBeNull();
  });
});
