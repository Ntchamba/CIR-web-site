// Navigation (routeur de données) : focus et annonce après un changement de page, défilement (haut de page,
// retour arrière, filtres), ordre de tabulation, routes protégées, 404, adresse profonde, bascule « à plat ».
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';

import App from '@/app/App.jsx';
import { oublierPositions } from '@/app/changementDePage.js';
import { activerZoomEntrePages } from '@/app/profondeur.js';
import { connecterLocalement, reponse, routesClient, simulerApi, simulerMouvementReduit, UTILISATEUR } from '@/test/outils.jsx';

function demarrer(chemin = '/', entrees) {
  const routeur = activerZoomEntrePages(createMemoryRouter([{ path: '*', element: <App /> }], {
    initialEntries: entrees || [chemin],
  }));
  const rendu = render(<RouterProvider router={routeur} />);
  return { routeur, ...rendu };
}
const aller = (routeur, vers, options) => act(async () => { await routeur.navigate(vers, options); });
const chemin = (routeur) => routeur.state.location.pathname + routeur.state.location.search;

describe('Gabarit : changement de page', () => {
  let defilement;
  beforeEach(() => {
    sessionStorage.clear();
    oublierPositions();
    defilement = 0;
    Object.defineProperty(window, 'scrollY', { configurable: true, get: () => defilement });
    vi.spyOn(window, 'scrollTo').mockImplementation((o) => { defilement = o.top; });
  });
  afterEach(() => { delete window.scrollY; });
  const defiler = (y) => { defilement = y; window.dispatchEvent(new Event('scroll')); };

  it('le focus passe sur le contenu principal après un changement de page (pas au premier affichage)', async () => {
    simulerApi();
    const { routeur } = demarrer('/');
    await screen.findByRole('heading', { level: 1, name: /Révélation/ });
    expect(document.activeElement).toBe(document.body);
    await aller(routeur, '/catalogue');
    await screen.findByRole('heading', { level: 1, name: 'Catalogue' });
    expect(document.activeElement).toBe(screen.getByRole('main'));
    expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1');
  });

  it('annonce le titre de la nouvelle page aux lecteurs d\'écran (zone status, invisible)', async () => {
    simulerApi();
    const { routeur } = demarrer('/');
    await screen.findByRole('heading', { level: 1, name: /Révélation/ });
    const zone = screen.getByTestId('annonce-page');
    expect(zone).toHaveAttribute('role', 'status');
    expect(zone).toHaveAttribute('aria-live', 'polite');
    expect(zone).toHaveClass('visuellement-cache');
    expect(zone).toHaveTextContent('');
    await aller(routeur, '/catalogue');
    await waitFor(() => expect(zone.textContent).toBe(document.title));
    expect(zone.textContent).toMatch(/Catalogue/);
  });

  it('la scène décorative est masquée aux lecteurs d\'écran et ne contient rien de focalisable', async () => {
    simulerApi();
    const { container } = demarrer('/connexion');
    await screen.findByRole('heading', { level: 1, name: /Votre sol, révélé/ });
    const scene = container.querySelector('.scene');
    expect(scene).toHaveAttribute('aria-hidden', 'true');
    expect(scene.querySelectorAll('a, button, input, [tabindex]')).toHaveLength(0);
  });

  it('une nouvelle page s\'ouvre en haut, sans défilement animé', async () => {
    simulerApi();
    const { routeur } = demarrer('/catalogue');
    await screen.findByRole('heading', { level: 1, name: 'Catalogue' });
    defiler(800);
    window.scrollTo.mockClear();
    await aller(routeur, '/realisations');
    await screen.findByRole('heading', { level: 1, name: /Réalisations/ });
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' });
    expect(defilement).toBe(0);
  });

  it('retour arrière : la position quittée est retrouvée', async () => {
    simulerApi();
    const { routeur } = demarrer('/catalogue');
    await screen.findByRole('heading', { level: 1, name: 'Catalogue' });
    defiler(640);
    await aller(routeur, '/realisations');
    await screen.findByRole('heading', { level: 1, name: /Réalisations/ });
    expect(defilement).toBe(0);
    await aller(routeur, -1);
    await screen.findByRole('heading', { level: 1, name: 'Catalogue' });
    await waitFor(() => expect(defilement).toBe(640));
  });

  it('un filtre (même page, adresse remplacée) ne ramène pas en haut', async () => {
    simulerApi();
    const { routeur } = demarrer('/catalogue');
    await screen.findByRole('heading', { level: 1, name: 'Catalogue' });
    defiler(500);
    window.scrollTo.mockClear();
    await aller(routeur, '/catalogue?usage=maison', { replace: true });
    await aller(routeur, '?famille=sols');
    expect(chemin(routeur)).toBe('/catalogue?famille=sols');
    expect(window.scrollTo).not.toHaveBeenCalled();
    expect(defilement).toBe(500);
  });

  it('adresse profonde rechargée : aucun défilement forcé au premier affichage', async () => {
    simulerApi();
    demarrer('/actualites/une-actualite');
    await screen.findByRole('main');
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('adresse profonde rechargée : la position retenue est retrouvée', async () => {
    simulerApi();
    const routeur0 = createMemoryRouter([{ path: '*', element: <App /> }], { initialEntries: ['/contact'] });
    const cle = routeur0.state.location.key;
    sessionStorage.setItem('cir-site.defilement', JSON.stringify({ [cle]: 420 }));
    oublierPositions();
    render(<RouterProvider router={routeur0} />);
    await screen.findByRole('main');
    await waitFor(() => expect(defilement).toBe(420));
  });

  it('page inconnue : 404 avec lien vers l\'accueil, focus sur le contenu', async () => {
    simulerApi();
    const { routeur } = demarrer('/');
    await screen.findByRole('heading', { level: 1, name: /Révélation/ });
    await aller(routeur, '/page/qui/nexiste/pas');
    expect(await screen.findByRole('heading', { level: 1, name: "Cette page n'existe pas" })).toBeInTheDocument();
    expect(within(screen.getByRole('main')).getByRole('link', { name: "Retour à l'accueil" })).toHaveAttribute('href', '/');
    expect(document.activeElement).toBe(screen.getByRole('main'));
  });

  it('ordre de tabulation : lien d\'évitement, puis en-tête, puis contenu, puis pied de page', async () => {
    simulerApi();
    const { container } = demarrer('/contact');
    await screen.findByRole('heading', { level: 1, name: 'Parlons de votre sol' });
    const ordre = [...container.querySelectorAll('a[href], button, input, select')].filter((e) => !e.closest('[aria-hidden="true"]'));
    expect(ordre[0]).toHaveAttribute('href', '#contenu');
    const position = (e) => ordre.indexOf(e);
    const retour = screen.getByRole('button', { name: 'Retour à la page précédente' });
    const logo = screen.getAllByRole('link', { name: /Retour à l'accueil|accueil/i })[0];
    expect(position(retour)).toBeLessThan(position(logo)); // la flèche « < » vient avant le logo
    expect(position(logo)).toBeLessThan(position(screen.getByLabelText(/Nom complet/)));
    expect(position(screen.getByLabelText(/Nom complet/))).toBeLessThan(position(within(screen.getByRole('contentinfo')).getAllByRole('link')[0]));
    // la scène (pas de focus possible) et le contenu restent dans l'ordre du document
    expect(container.querySelector('.scene').compareDocumentPosition(screen.getByRole('main')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('l\'écran de connexion n\'a ni en-tête ni pied de page (maquette) mais porte sa propre flèche de retour', async () => {
    simulerApi();
    const { container } = demarrer('/connexion');
    await screen.findByRole('heading', { level: 1, name: /Votre sol, révélé/ });
    expect(container.querySelector('header')).toBeNull();
    expect(container.querySelector('footer')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Retour à la page précédente' })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Créer un compte' })).toHaveAttribute('href', '/inscription');
    expect(screen.getByRole('link', { name: 'Se connecter' })).toHaveAttribute('aria-current', 'page');
  });

  it('Tab depuis le contenu principal focalisé va au premier élément interactif du contenu', async () => {
    simulerApi();
    const { routeur } = demarrer('/');
    await screen.findByRole('heading', { level: 1, name: /Révélation/ });
    await aller(routeur, '/connexion');
    await screen.findByRole('heading', { level: 1, name: /Votre sol, révélé/ });
    expect(document.activeElement).toBe(screen.getByRole('main'));
    await userEvent.tab();
    expect(screen.getByRole('main').contains(document.activeElement)).toBe(true);
    // Dans l'écran de connexion, le premier élément interactif du contenu est la flèche de retour (téléphone).
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Retour à la page précédente' }));
  });
});

describe('Routeur de données : routes protégées et redirections', () => {
  beforeEach(() => { sessionStorage.clear(); oublierPositions(); });

  it('sans session, une adresse profonde protégée mène à la connexion avec la suite complète (chemin + filtres)', async () => {
    simulerApi();
    const { routeur } = demarrer('/commandes/5/payer?mode=mtn');
    expect(await screen.findByRole('heading', { level: 1, name: /Votre sol, révélé/ })).toBeInTheDocument();
    expect(chemin(routeur)).toBe('/connexion?suite=%2Fcommandes%2F5%2Fpayer%3Fmode%3Dmtn');
    // la redirection remplace l'entrée : le retour arrière ne reboucle pas
    expect(routeur.state.historyAction).toBe('REPLACE');
  });

  it('connexion réussie : retour à la page demandée avec ses paramètres', async () => {
    const fetch = simulerApi({
      'POST /api/comptes/connexion/': reponse(200, { acces: 'A1', rafraichissement: 'R1', utilisateur: UTILISATEUR }),
      'GET /api/comptes/moi/': reponse(200, UTILISATEUR),
      'GET /api/selection/resume/': reponse(200, { count: 0, produits: [] }),
    });
    const { routeur } = demarrer('/commandes?filtre=en-cours');
    await screen.findByRole('heading', { level: 1, name: /Votre sol, révélé/ });
    await userEvent.type(screen.getByLabelText(/E-mail/), 'awa@exemple.cm');
    await userEvent.type(screen.getByLabelText(/Mot de passe/), 'MotDePasse-Test-2026');
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
    await waitFor(() => expect(chemin(routeur)).toBe('/commandes?filtre=en-cours'));
    expect(fetch).toHaveBeenCalled();
  });

  it('session valide : les pages protégées s\'ouvrent, y compris par adresse directe', async () => {
    simulerApi(routesClient({ 'GET /api/commandes/': reponse(200, { count: 0, next: null, previous: null, results: [] }) }));
    const { routeur } = demarrer('/commandes');
    expect(await screen.findByRole('heading', { level: 1, name: /commandes/i })).toBeInTheDocument();
    expect(chemin(routeur)).toBe('/commandes');
  });

  it('lien externe ou protocole dans ?suite= : ignoré', async () => {
    simulerApi(routesClient());
    const { routeur } = demarrer('/connexion?suite=%2F%2Fpirate.example');
    await waitFor(() => expect(chemin(routeur)).toBe('/compte'));
  });

  it('les liens de notification et de messagerie restent des chemins internes du site', async () => {
    connecterLocalement();
    simulerApi(routesClient());
    const { routeur } = demarrer('/messages?commande=12');
    await screen.findByRole('main');
    expect(chemin(routeur)).toBe('/messages?commande=12');
    await aller(routeur, '/notifications');
    expect(chemin(routeur)).toBe('/notifications');
  });
});

describe('Bascule « à plat » (amélioration progressive)', () => {
  it('jsdom (aucun animation-timeline) : <html data-plat> posé dès le premier rendu, retiré au démontage', async () => {
    simulerApi();
    const { unmount } = demarrer('/');
    expect(document.documentElement).toHaveAttribute('data-plat');
    await screen.findByRole('heading', { level: 1, name: /Révélation/ });
    unmount();
    expect(document.documentElement).not.toHaveAttribute('data-plat');
  });

  it('prise en charge complète sans préférence : pas de data-plat', async () => {
    simulerApi();
    simulerMouvementReduit(false);
    vi.stubGlobal('CSS', { supports: () => true });
    demarrer('/');
    await screen.findByRole('heading', { level: 1, name: /Révélation/ });
    expect(document.documentElement).not.toHaveAttribute('data-plat');
  });

  it('économie de données : data-plat, contenu complet de l\'accueil dans l\'ordre du document', async () => {
    simulerApi();
    simulerMouvementReduit(false);
    vi.stubGlobal('CSS', { supports: () => true });
    Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true });
    try {
      demarrer('/');
      await screen.findByRole('heading', { level: 1, name: /Révélation/ });
      expect(document.documentElement).toHaveAttribute('data-plat');
      const titres = screen.getAllByRole('heading').map((h) => h.textContent);
      expect(titres.length).toBeGreaterThan(1); // titre principal et contact ; les autres sections n'apparaissent qu'avec des données réelles
      // le titre principal vient avant les sections
      expect(screen.getAllByRole('heading')[0]).toHaveProperty('tagName', 'H1');
    } finally {
      delete navigator.connection;
    }
  });
});
