// Page de connexion et garde des routes de l'équipe, rendues à travers les vraies routes de l'application.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { vi } from 'vitest';

import App from '@/app/App.jsx';

const MEMBRE = { id: 2, email: 'm@cir.cm', nom_complet: 'Jean Mbarga', role: 'membre', est_equipe: true };
const CLIENT = { id: 9, email: 'c@exemple.cm', nom_complet: 'Paul Client', role: 'client', est_equipe: false };

function reponse(statut, corps) {
  return Promise.resolve(new Response(corps == null ? null : JSON.stringify(corps), {
    status: statut,
    headers: { 'Content-Type': 'application/json' },
  }));
}

let adresse;
function Adresse() {
  const { pathname, search } = useLocation();
  adresse = pathname + search;
  return null;
}

function rendre(chemin) {
  return render(
    <MemoryRouter initialEntries={[chemin]}>
      <App />
      <Adresse />
    </MemoryRouter>,
  );
}

async function remplir(email = 'm@cir.cm', motDePasse = 'secret-solide') {
  const u = userEvent.setup();
  if (email) await u.type(await screen.findByLabelText(/E-mail/), email);
  if (motDePasse) await u.type(screen.getByLabelText(/Mot de passe/), motDePasse);
  await u.click(screen.getByRole('button', { name: 'Se connecter' }));
}

const reussite = () => vi.fn(() => reponse(200, { acces: 'A', rafraichissement: 'R', utilisateur: MEMBRE }));

describe('ConnexionPage', () => {
  it('a des champs libellés, avec les bons autocomplete', async () => {
    vi.stubGlobal('fetch', vi.fn());
    rendre('/connexion');
    const email = await screen.findByLabelText(/E-mail/);
    const mdp = screen.getByLabelText(/Mot de passe/);
    expect(email).toHaveAttribute('type', 'email');
    expect(email).toHaveAttribute('autocomplete', 'username');
    expect(mdp).toHaveAttribute('type', 'password');
    expect(mdp).toHaveAttribute('autocomplete', 'current-password');
    expect(screen.getByRole('heading', { level: 1, name: 'Connexion' })).toBeInTheDocument();
    // Aucun lien vers l'inscription ni vers le site public : l'espace est réservé à l'équipe.
    expect(screen.queryByRole('link')).toBeNull();
  });

  it("contrôle la saisie avant d'appeler le serveur", async () => {
    vi.stubGlobal('fetch', vi.fn());
    rendre('/connexion');
    await remplir('', '');
    expect(await screen.findByText('Indiquez votre e-mail.')).toBeInTheDocument();
    expect(screen.getByText('Indiquez votre mot de passe.')).toBeInTheDocument();
    expect(screen.getByLabelText(/E-mail/)).toHaveAttribute('aria-invalid', 'true');
    expect(fetch).not.toHaveBeenCalled();
  });

  it("envoie l'e-mail sans espaces et revient à la page demandée", async () => {
    const simule = reussite();
    vi.stubGlobal('fetch', simule);
    rendre(`/connexion?suite=${encodeURIComponent('/clients?q=paul')}`);
    await remplir('  m@cir.cm  ');
    await waitFor(() => expect(adresse).toBe('/clients?q=paul'));
    expect(JSON.parse(simule.mock.calls[0][1].body)).toEqual({ email: 'm@cir.cm', mot_de_passe: 'secret-solide' });
  });

  it("ignore une ?suite= externe et renvoie à l'accueil", async () => {
    vi.stubGlobal('fetch', reussite());
    rendre(`/connexion?suite=${encodeURIComponent('//pirate.example')}`);
    await remplir();
    expect(await screen.findByRole('heading', { level: 1, name: 'Bonjour Jean' })).toBeInTheDocument();
    expect(adresse).toBe('/');
  });

  it("ignore une ?suite= avec une tabulation (« /%09/pirate.example ») et renvoie à l'accueil", async () => {
    vi.stubGlobal('fetch', reussite());
    rendre('/connexion?suite=/%09/pirate.example');
    await remplir();
    await waitFor(() => expect(adresse).toBe('/'));
  });

  it('affiche le refus du serveur pour un compte client et ne garde aucun jeton', async () => {
    vi.stubGlobal('fetch', vi.fn(() => reponse(403, { detail: "Ce compte n'a pas accès au tableau de bord." })));
    rendre('/connexion');
    await remplir('c@exemple.cm');
    expect(await screen.findByRole('alert')).toHaveTextContent("Ce compte n'a pas accès au tableau de bord.");
    expect(localStorage.getItem('cir-tdb.jetons')).toBeNull();
    expect(adresse).toBe('/connexion');
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeEnabled();
  });

  it('refuse un client que le serveur aurait laissé passer', async () => {
    vi.stubGlobal('fetch', vi.fn(() => reponse(200, { acces: 'A', rafraichissement: 'R', utilisateur: CLIENT })));
    rendre('/connexion');
    await remplir('c@exemple.cm');
    expect(await screen.findByRole('alert')).toHaveTextContent("Ce compte n'a pas accès au tableau de bord.");
    expect(localStorage.getItem('cir-tdb.jetons')).toBeNull();
    expect(adresse).toBe('/connexion');
  });

  it.each([
    [401, { detail: 'E-mail ou mot de passe incorrect.' }, 'E-mail ou mot de passe incorrect.'],
    [429, { detail: "Trop d'essais incorrects. Réessayez dans 15 minutes." }, "Trop d'essais incorrects. Réessayez dans 15 minutes."],
    [500, '<html>Server Error</html>', 'Le serveur rencontre un problème. Réessayez dans un instant.'],
  ])('affiche un message lisible pour une réponse %i', async (statut, corps, message) => {
    vi.stubGlobal('fetch', vi.fn(() => reponse(statut, corps)));
    rendre('/connexion');
    await remplir();
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });

  it('affiche les erreurs de champ du serveur sous le bon champ', async () => {
    vi.stubGlobal('fetch', vi.fn(() => reponse(400, { mot_de_passe: ['Ce champ est obligatoire.'] })));
    rendre('/connexion');
    await remplir();
    const mdp = screen.getByLabelText(/Mot de passe/);
    await waitFor(() => expect(mdp).toHaveAttribute('aria-invalid', 'true'));
    expect(mdp).toHaveAccessibleDescription('Ce champ est obligatoire.');
  });

  it('prévient quand le serveur est injoignable', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    rendre('/connexion');
    await remplir();
    expect(await screen.findByRole('alert')).toHaveTextContent('Connexion au serveur impossible');
  });

  it('renvoie directement une personne déjà connectée vers ?suite=', async () => {
    localStorage.setItem('cir-tdb.jetons', JSON.stringify({ acces: 'a', rafraichissement: 'r' }));
    vi.stubGlobal('fetch', vi.fn(() => reponse(200, { count: 0, next: null, previous: null, results: [], ...MEMBRE })));
    rendre('/connexion?suite=/clients');
    await waitFor(() => expect(adresse).toBe('/clients'));
  });
});

describe('RouteEquipe', () => {
  it('renvoie vers la connexion en gardant la page demandée et sa requête', async () => {
    vi.stubGlobal('fetch', vi.fn());
    rendre('/clients?q=paul&ville=Douala');
    await screen.findByRole('heading', { level: 1, name: 'Connexion' });
    expect(adresse).toBe(`/connexion?suite=${encodeURIComponent('/clients?q=paul&ville=Douala')}`);
  });

  it("renvoie vers /connexion sans ?suite= pour l'accueil", async () => {
    vi.stubGlobal('fetch', vi.fn());
    rendre('/');
    await screen.findByRole('heading', { level: 1, name: 'Connexion' });
    expect(adresse).toBe('/connexion');
  });

  it('affiche « Vérification de votre session… » pendant la restauration', async () => {
    localStorage.setItem('cir-tdb.jetons', JSON.stringify({ acces: 'a', rafraichissement: 'r' }));
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    rendre('/clients');
    expect(await screen.findByText('Vérification de votre session…')).toBeInTheDocument();
  });

  it("ne laisse jamais un client entrer, même avec des jetons valides", async () => {
    localStorage.setItem('cir-tdb.jetons', JSON.stringify({ acces: 'a', rafraichissement: 'r' }));
    vi.stubGlobal('fetch', vi.fn(() => reponse(200, CLIENT)));
    rendre('/clients');
    await screen.findByRole('heading', { level: 1, name: 'Connexion' });
    expect(localStorage.getItem('cir-tdb.jetons')).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Menu du tableau de bord' })).toBeNull();
  });

  it("refuse la page Équipe à un simple membre, sans appeler l'API de l'équipe", async () => {
    localStorage.setItem('cir-tdb.jetons', JSON.stringify({ acces: 'a', rafraichissement: 'r' }));
    const simule = vi.fn(() => reponse(200, MEMBRE));
    vi.stubGlobal('fetch', simule);
    rendre('/equipe');
    expect(await screen.findByRole('heading', { level: 1, name: 'Accès réservé' })).toBeInTheDocument();
    expect(screen.getByText('Cette page est réservée au super-administrateur.')).toBeInTheDocument();
    expect(simule.mock.calls.some(([u]) => String(u).includes('/api/admin/comptes/equipe/'))).toBe(false);
  });
});
