// Tests de l'inscription : l'adresse complète est obligatoire, champs envoyés au back-end, connexion immédiate.
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { appels, CLE_JETONS, emplacement, reponse, rendreAvecRoutes, simulerApi, UTILISATEUR } from '@/test/outils.jsx';

import InscriptionPage from './InscriptionPage.jsx';

const rendre = (chemin = '/inscription') => rendreAvecRoutes(chemin, {
  '/inscription': <InscriptionPage />,
  '/compte': <p>Page compte</p>,
  '/commandes': <p>Page commandes</p>,
});

async function remplir(valeurs) {
  const u = userEvent.setup();
  const libelles = {
    nom_complet: /Nom complet/,
    email: /E-mail/,
    telephone: /Téléphone/,
    mot_de_passe: /Mot de passe/,
    confirmation: /Confirmer le mot de passe/,
    ville: /Ville/,
    quartier: /Quartier/,
    rue_ou_repere: /Rue ou repère/,
  };
  for (const [champ, valeur] of Object.entries(valeurs)) {
    if (valeur && libelles[champ]) await u.type(screen.getByLabelText(libelles[champ]), valeur);
  }
  // Consentement de la maquette (« J'accepte que mes données servent au traitement de mes commandes. »)
  if (valeurs.consentement !== false) await u.click(screen.getByRole('checkbox'));
  await u.click(screen.getByRole('button', { name: 'Créer mon compte' }));
}

const COMPLET = {
  nom_complet: ' Awa Ngono ',
  email: 'awa@exemple.cm',
  telephone: '+237 699 00 00 00',
  mot_de_passe: 'motdepasse1',
  confirmation: 'motdepasse1',
  ville: 'Douala',
  quartier: 'Bonapriso',
  rue_ou_repere: 'Près de la pharmacie',
};

describe('InscriptionPage', () => {
  it('affiche les champs, l’adresse étant obligatoire', async () => {
    simulerApi();
    rendre();
    expect(await screen.findByRole('heading', { level: 1, name: /Votre sol, révélé/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Créer un compte' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('group', { name: 'Adresse, nécessaire pour commander' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirmer le mot de passe/)).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByRole('checkbox', { name: /J'accepte que mes données servent au traitement de mes commandes/ })).not.toBeChecked();
    ['Ville', 'Quartier', 'Rue ou repère'].forEach((l) => expect(screen.getByLabelText(new RegExp(l))).toBeRequired());
    expect(screen.getByLabelText(/Téléphone/)).not.toBeRequired();
    expect(screen.getByLabelText(/Mot de passe/)).toHaveAttribute('autocomplete', 'new-password');
  });

  it('refuse l’inscription sans adresse : aucun appel au serveur', async () => {
    const fetch = simulerApi();
    rendre();
    await remplir({ ...COMPLET, ville: '', quartier: '', rue_ou_repere: '' });
    expect(screen.getByRole('alert')).toHaveTextContent(/manquent ou sont incorrectes/);
    expect(screen.getByText('Indiquez votre ville.')).toBeInTheDocument();
    expect(screen.getByText('Indiquez votre quartier.')).toBeInTheDocument();
    expect(screen.getByText('Indiquez une rue ou un repère connu.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Ville/)).toHaveAttribute('aria-invalid', 'true');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('refuse un mot de passe de confirmation différent ou l\'absence de consentement : aucun appel au serveur', async () => {
    const fetch = simulerApi();
    rendre();
    await remplir({ ...COMPLET, confirmation: 'autre-chose', consentement: false });
    expect(screen.getByText('Les deux mots de passe ne sont pas identiques.')).toBeInTheDocument();
    expect(screen.getByText('Cochez la case pour créer votre compte.')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('refuse une adresse partielle (repère manquant)', async () => {
    const fetch = simulerApi();
    rendre();
    await remplir({ ...COMPLET, rue_ou_repere: '' });
    expect(screen.getByText('Indiquez une rue ou un repère connu.')).toBeInTheDocument();
    expect(screen.queryByText('Indiquez votre ville.')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('envoie les champs attendus par le back-end, sans jeton, et connecte le client', async () => {
    const fetch = simulerApi({
      'POST /api/comptes/inscription/': reponse(201, { utilisateur: UTILISATEUR, acces: 'A1', rafraichissement: 'R1' }),
    });
    rendre('/inscription?suite=%2Fcommandes');
    await remplir(COMPLET);
    await waitFor(() => expect(emplacement()).toBe('/commandes'));
    const [[corps, init]] = appels(fetch, 'POST', '/api/comptes/inscription/');
    expect(corps).toEqual({
      nom_complet: 'Awa Ngono',
      email: 'awa@exemple.cm',
      telephone: '+237 699 00 00 00',
      mot_de_passe: 'motdepasse1',
      ville: 'Douala',
      quartier: 'Bonapriso',
      rue_ou_repere: 'Près de la pharmacie',
      langue: 'fr', // langue de l'interface, gardée dans le compte (e-mails)
    });
    expect(init.headers.Authorization).toBeUndefined();
    expect(init.headers['Accept-Language']).toBe('fr');
    expect(JSON.parse(localStorage.getItem(CLE_JETONS))).toEqual({ acces: 'A1', rafraichissement: 'R1' });
    // une seule requête : pas de connexion supplémentaire
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('e-mail déjà utilisé (400) : erreur sous le champ e-mail', async () => {
    simulerApi({
      'POST /api/comptes/inscription/': reponse(400, { email: ['Un compte existe déjà avec cette adresse e-mail.'] }),
    });
    rendre();
    await remplir(COMPLET);
    expect(await screen.findByRole('alert')).toHaveTextContent('Un compte existe déjà avec cette adresse e-mail.');
    expect(screen.getByLabelText(/E-mail/)).toHaveAttribute('aria-invalid', 'true');
    expect(localStorage.getItem(CLE_JETONS)).toBeNull();
    expect(emplacement()).toBe('/inscription');
  });

  it('adresse refusée par le serveur : erreur sous le champ concerné', async () => {
    simulerApi({ 'POST /api/comptes/inscription/': reponse(400, { quartier: ['Le quartier est obligatoire.'] }) });
    rendre();
    await remplir(COMPLET);
    await screen.findByRole('alert');
    expect(screen.getByLabelText(/Quartier/)).toHaveAccessibleDescription('Le quartier est obligatoire.');
  });

  it('client déjà connecté : renvoyé vers la suite', async () => {
    localStorage.setItem(CLE_JETONS, JSON.stringify({ acces: 'A1', rafraichissement: 'R1' }));
    simulerApi({ 'GET /api/comptes/moi/': reponse(200, UTILISATEUR) });
    rendre();
    await waitFor(() => expect(emplacement()).toBe('/compte'));
  });
});
