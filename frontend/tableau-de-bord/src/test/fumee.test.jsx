// Test de fumée : l'application démarre, protège ses pages, connecte un membre de l'équipe et refuse un client.
// La suite complète est écrite par l'agent tableau-de-bord-testeur.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';

import App from '@/app/App.jsx';

const SUPER_ADMIN = {
  id: 1, email: 'admin@revelation-sarl.com', nom_complet: 'Awa Nana', role: 'super_admin', est_equipe: true,
};

function reponse(statut, corps) {
  return Promise.resolve(new Response(corps == null ? null : JSON.stringify(corps), {
    status: statut,
    headers: { 'Content-Type': 'application/json' },
  }));
}

function rendre(chemin = '/') {
  return render(
    <MemoryRouter initialEntries={[chemin]}>
      <App />
    </MemoryRouter>,
  );
}

async function seConnecter() {
  const u = userEvent.setup();
  await u.type(await screen.findByLabelText(/E-mail/), 'admin@revelation-sarl.com');
  await u.type(screen.getByLabelText(/Mot de passe/), 'secret-solide');
  await u.click(screen.getByRole('button', { name: 'Se connecter' }));
}

describe('Tableau de bord (fumée)', () => {
  it("renvoie vers la connexion quand personne n'est connecté", async () => {
    vi.stubGlobal('fetch', vi.fn());
    rendre('/clients');
    expect(await screen.findByRole('heading', { level: 1, name: 'Connexion' })).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("connecte un super-administrateur par la route de l'équipe et affiche la coque", async () => {
    const simule = vi.fn(() => reponse(200, { acces: 'a', rafraichissement: 'r', utilisateur: SUPER_ADMIN }));
    vi.stubGlobal('fetch', simule);
    rendre('/');
    await seConnecter();

    expect(await screen.findByRole('heading', { level: 1, name: 'Bonjour Awa' })).toBeInTheDocument();
    expect(String(simule.mock.calls[0][0])).toContain('/api/admin/comptes/connexion/');
    const menu = screen.getByRole('navigation', { name: 'Menu du tableau de bord' });
    expect(menu).toHaveTextContent('Équipe');
    expect(menu).toHaveTextContent('Assistant IA');
    expect(menu).not.toHaveTextContent('Bientôt disponible');
    expect(screen.getByRole('button', { name: /Se déconnecter/ })).toBeInTheDocument();
    expect(screen.getByText('Super-administrateur')).toBeInTheDocument();
  });

  it('refuse un compte client avec le message du serveur', async () => {
    vi.stubGlobal('fetch', vi.fn(() => reponse(403, { detail: "Ce compte n'a pas accès au tableau de bord." })));
    rendre('/connexion');
    await seConnecter();
    expect(await screen.findByRole('alert')).toHaveTextContent("Ce compte n'a pas accès au tableau de bord.");
    expect(localStorage.getItem('cir-tdb.jetons')).toBeNull();
  });

  it('affiche la liste des clients puis la fiche en lecture', async () => {
    localStorage.setItem('cir-tdb.jetons', JSON.stringify({ acces: 'a', rafraichissement: 'r' }));
    const client = {
      id: 7, email: 'client@exemple.cm', nom_complet: 'Paul Ekwalla', telephone: '+237 600 00 00 00',
      ville: 'Douala', quartier: 'Akwa', rue_ou_repere: 'Face pharmacie', adresse_complete: true, actif: true,
      date_inscription: '2026-10-01T10:00:00Z', adresse_formatee: 'Face pharmacie, Akwa, Douala', derniere_connexion: null,
    };
    vi.stubGlobal('fetch', vi.fn((url) => {
      const u = String(url);
      if (u.includes('/api/comptes/moi/')) return reponse(200, { ...SUPER_ADMIN, role: 'membre' });
      if (u.includes('/clients/7/')) return reponse(200, client);
      return reponse(200, { count: 1, next: null, previous: null, results: [client] });
    }));
    rendre('/clients');
    const lien = await screen.findByRole('link', { name: 'Paul Ekwalla' });
    expect(screen.getByText('1 client')).toBeInTheDocument();
    // Un simple membre ne voit pas l'entrée « Équipe ».
    expect(screen.getByRole('navigation', { name: 'Menu du tableau de bord' })).not.toHaveTextContent('Équipe');
    await userEvent.setup().click(lien);
    expect(await screen.findByRole('heading', { level: 1, name: 'Paul Ekwalla' })).toBeInTheDocument();
    expect(screen.getByText('Face pharmacie')).toBeInTheDocument();
  });

  it("liste l'équipe et désactive un membre (super-administrateur)", async () => {
    localStorage.setItem('cir-tdb.jetons', JSON.stringify({ acces: 'a', rafraichissement: 'r' }));
    const membre = { id: 2, email: 'm@cir.cm', nom_complet: 'Jean Mbarga', telephone: '', role: 'membre', actif: true,
      date_inscription: '2026-09-01T10:00:00Z', derniere_connexion: null };
    const simule = vi.fn((url, options) => {
      const u = String(url);
      if (u.includes('/api/comptes/moi/')) return reponse(200, SUPER_ADMIN);
      if (u.includes('/2/desactiver/')) return reponse(200, { ...membre, actif: false });
      return reponse(200, { count: 2, next: null, previous: null, results: [{ ...SUPER_ADMIN, actif: true }, membre] });
    });
    vi.stubGlobal('fetch', simule);
    rendre('/equipe');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Désactiver Jean Mbarga' }));
    await u.click(screen.getByRole('button', { name: 'Confirmer' }));
    expect(await screen.findByRole('button', { name: 'Réactiver Jean Mbarga' })).toBeInTheDocument();
    expect(screen.getByText('Désactivé')).toBeInTheDocument();
    // Pas de bouton pour se retirer soi-même.
    expect(screen.queryByRole('button', { name: 'Désactiver Awa Nana' })).toBeNull();
  });
});
