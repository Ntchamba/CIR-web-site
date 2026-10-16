// Clients : construction de la requête, suggestions de villes, liste filtrée (critères dans l'adresse),
// pagination, erreurs et fiche client (dont le cas introuvable).
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { vi } from 'vitest';

import App from '@/app/App.jsx';

import { requeteClients } from './api.js';
import { suggestionsVilles, VILLES_COURANTES } from './villes.js';

const MEMBRE = { id: 2, email: 'm@cir.cm', nom_complet: 'Jean Mbarga', role: 'membre', est_equipe: true };
const PAUL = { id: 7, email: 'paul@exemple.cm', nom_complet: 'Paul Ekwalla', telephone: '+237 600 00 00 00',
  ville: 'Douala', quartier: 'Akwa', adresse_complete: true, actif: true, date_inscription: '2026-10-01T10:00:00Z' };
const MARIE = { id: 8, email: 'marie@exemple.cm', nom_complet: '', telephone: '', ville: 'Kumba', quartier: '',
  adresse_complete: false, actif: false, date_inscription: '2026-10-02T10:00:00Z' };

function reponse(statut, corps) {
  return Promise.resolve(new Response(corps == null ? null : JSON.stringify(corps), {
    status: statut,
    headers: { 'Content-Type': 'application/json' },
  }));
}

const page = (results, extra = {}) => ({ count: results.length, next: null, previous: null, results, ...extra });

function simuler(rappel) {
  const simule = vi.fn((url, options) => {
    const u = String(url);
    if (u.includes('/api/comptes/moi/')) return reponse(200, MEMBRE);
    return rappel(u, options);
  });
  vi.stubGlobal('fetch', simule);
  return simule;
}
const appelsClients = (simule) => simule.mock.calls.map(([u]) => String(u)).filter((u) => u.includes('/admin/comptes/clients'));

let adresse;
function Adresse() {
  const { pathname, search } = useLocation();
  adresse = pathname + search;
  return null;
}

function rendre(chemin = '/clients') {
  localStorage.setItem('cir-tdb.jetons', JSON.stringify({ acces: 'a', rafraichissement: 'r' }));
  return render(<MemoryRouter initialEntries={[chemin]}><App /><Adresse /></MemoryRouter>);
}

describe('requeteClients', () => {
  it('utilise les paramètres du back-end (search, ville, page)', () => {
    expect(requeteClients()).toBe('/api/admin/comptes/clients/');
    expect(requeteClients({ recherche: '  paul ', ville: ' Douala ', page: 3 }))
      .toBe('/api/admin/comptes/clients/?search=paul&ville=Douala&page=3');
    expect(requeteClients({ page: 1 })).toBe('/api/admin/comptes/clients/');
    expect(requeteClients({ recherche: 'a&b=c' })).toBe('/api/admin/comptes/clients/?search=a%26b%3Dc');
  });
});

describe('suggestionsVilles', () => {
  it('ajoute les villes des résultats, sans doublon, triées en français', () => {
    const villes = suggestionsVilles([{ ville: 'Kumba' }, { ville: 'Douala' }, { ville: '' }, null]);
    expect(villes).toContain('Kumba');
    expect(villes.filter((v) => v === 'Douala')).toHaveLength(1);
    expect(villes.length).toBe(VILLES_COURANTES.length + 1);
    expect(villes).toEqual([...villes].sort((a, b) => a.localeCompare(b, 'fr')));
  });
});

describe('ClientsPage', () => {
  it('affiche les clients, leur adresse et le statut du compte', async () => {
    simuler(() => reponse(200, page([PAUL, MARIE])));
    rendre();
    expect(await screen.findByRole('link', { name: 'Paul Ekwalla' })).toHaveAttribute('href', '/clients/7');
    // Sans nom, on affiche l'e-mail.
    expect(screen.getByRole('link', { name: 'marie@exemple.cm' })).toHaveAttribute('href', '/clients/8');
    expect(screen.getByText('2 clients')).toBeInTheDocument();
    expect(screen.getByText('Adresse complète')).toBeInTheDocument();
    expect(screen.getByText('Adresse incomplète')).toBeInTheDocument();
    expect(screen.getByText('Compte désactivé')).toBeInTheDocument();
    expect(screen.getByText('Douala, Akwa')).toBeInTheDocument();
    expect(screen.getByLabelText('Rechercher')).toHaveAttribute('type', 'search');
    expect(screen.getByLabelText('Ville')).toBeInTheDocument();
  });

  it("lit les critères dans l'adresse de la page", async () => {
    const simule = simuler(() => reponse(200, page([PAUL])));
    rendre('/clients?q=paul&ville=Douala&page=2');
    await screen.findByRole('link', { name: 'Paul Ekwalla' });
    expect(appelsClients(simule).at(-1)).toMatch(/\/api\/admin\/comptes\/clients\/\?search=paul&ville=Douala&page=2$/);
    expect(screen.getByLabelText('Rechercher')).toHaveValue('paul');
    expect(screen.getByLabelText('Ville')).toHaveValue('Douala');
  });

  it("ignore un numéro de page invalide dans l'adresse", async () => {
    const simule = simuler(() => reponse(200, page([PAUL])));
    rendre('/clients?page=-4');
    await screen.findByRole('link', { name: 'Paul Ekwalla' });
    expect(appelsClients(simule).at(-1)).toMatch(/\/clients\/$/);
  });

  it("attend la fin de la frappe, puis écrit la recherche dans l'adresse et revient à la page 1", async () => {
    const simule = simuler(() => reponse(200, page([PAUL])));
    rendre('/clients?page=3');
    await screen.findByRole('link', { name: 'Paul Ekwalla' });
    const avant = appelsClients(simule).length;
    await userEvent.setup().type(screen.getByLabelText('Rechercher'), 'akwa');
    // Une seule requête pour toute la frappe.
    await waitFor(() => expect(adresse).toBe('/clients?q=akwa'));
    await waitFor(() => expect(appelsClients(simule).length).toBe(avant + 1));
    expect(appelsClients(simule).at(-1)).toMatch(/\?search=akwa$/);
  });

  it('pagine par 24 et garde les autres critères', async () => {
    const simule = simuler((u) => (u.includes('page=2')
      ? reponse(200, page([MARIE], { count: 30, previous: 'x' }))
      : reponse(200, page([PAUL], { count: 30, next: 'x' }))));
    rendre('/clients?ville=Douala');
    await screen.findByRole('link', { name: 'Paul Ekwalla' });
    expect(screen.getByText('Page 1 sur 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page précédente' })).toBeDisabled();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Page suivante' }));
    expect(await screen.findByRole('link', { name: 'marie@exemple.cm' })).toBeInTheDocument();
    expect(adresse).toBe('/clients?ville=Douala&page=2');
    expect(screen.getByText('Page 2 sur 2')).toBeInTheDocument();
    expect(appelsClients(simule).at(-1)).toMatch(/\?ville=Douala&page=2$/);
  });

  it('distingue la liste vide et les filtres sans résultat, et permet de les effacer', async () => {
    simuler(() => reponse(200, page([])));
    rendre('/clients?q=zzz');
    expect(await screen.findByText('Aucun client ne correspond à ces critères')).toBeInTheDocument();
    const boutons = screen.getAllByRole('button', { name: 'Effacer les filtres' });
    await userEvent.setup().click(boutons.at(-1));
    expect(await screen.findByText('Aucun client pour le moment')).toBeInTheDocument();
    expect(adresse).toBe('/clients');
    expect(screen.getByLabelText('Rechercher')).toHaveValue('');
  });

  it("affiche l'erreur et réessaie", async () => {
    let echec = true;
    simuler(() => (echec ? Promise.reject(new TypeError('Failed to fetch')) : reponse(200, page([PAUL]))));
    rendre();
    expect(await screen.findByRole('alert')).toHaveTextContent('Connexion au serveur impossible');
    echec = false;
    await userEvent.setup().click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('link', { name: 'Paul Ekwalla' })).toBeInTheDocument();
  });
});

describe('FicheClientPage', () => {
  const FICHE = { ...PAUL, rue_ou_repere: 'Face pharmacie du Port', adresse_formatee: 'Face pharmacie du Port, Akwa, Douala',
    derniere_connexion: null };

  it('affiche coordonnées et adresse, avec un retour vers la liste filtrée', async () => {
    simuler((u) => (u.includes('/clients/7/') ? reponse(200, FICHE) : reponse(200, page([PAUL]))));
    rendre('/clients?ville=Douala');
    await userEvent.setup().click(await screen.findByRole('link', { name: 'Paul Ekwalla' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Paul Ekwalla' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'paul@exemple.cm' })).toHaveAttribute('href', 'mailto:paul@exemple.cm');
    expect(screen.getByRole('link', { name: '+237 600 00 00 00' })).toHaveAttribute('href', 'tel:+237600000000');
    expect(screen.getByText('Face pharmacie du Port')).toBeInTheDocument();
    expect(screen.getByText('Jamais')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Retour à la liste des clients/ })).toHaveAttribute('href', '/clients?ville=Douala');
  });

  it("signale une adresse incomplète (le client ne pourra pas commander)", async () => {
    simuler(() => reponse(200, { ...MARIE, rue_ou_repere: '', adresse_formatee: '', derniere_connexion: null }));
    rendre('/clients/8');
    expect(await screen.findByRole('heading', { level: 1, name: 'marie@exemple.cm' })).toBeInTheDocument();
    expect(screen.getByText('Le client devra compléter son adresse avant de pouvoir commander.')).toBeInTheDocument();
    expect(screen.getAllByText('Compte désactivé').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /Retour à la liste des clients/ })).toHaveAttribute('href', '/clients');
  });

  it('affiche « Client introuvable » sur un 404', async () => {
    simuler(() => reponse(404, { detail: 'Pas trouvé.' }));
    rendre('/clients/999');
    expect(await screen.findByRole('heading', { level: 1, name: 'Client introuvable' })).toBeInTheDocument();
  });

  it("affiche l'erreur et réessaie pour une autre panne", async () => {
    let echec = true;
    simuler(() => (echec ? reponse(500, null) : reponse(200, { ...PAUL, rue_ou_repere: 'Rue 1', derniere_connexion: null })));
    rendre('/clients/7');
    expect(await screen.findByRole('alert')).toHaveTextContent('Le serveur rencontre un problème');
    echec = false;
    await userEvent.setup().click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Paul Ekwalla' })).toBeInTheDocument();
  });
});
