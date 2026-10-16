// Page Équipe (super-administrateur) : liste, ajout avec erreurs du serveur, désactivation, réactivation.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';

import App from '@/app/App.jsx';

import { validerMembre } from './composants/FormulaireMembre.jsx';

const SUPER_ADMIN = { id: 1, email: 'a@cir.cm', nom_complet: 'Awa Nana', telephone: '', role: 'super_admin',
  est_equipe: true, actif: true, date_inscription: '2026-09-01T10:00:00Z', derniere_connexion: '2026-10-15T08:30:00Z' };
const MEMBRE = { id: 2, email: 'm@cir.cm', nom_complet: 'Jean Mbarga', telephone: '+237 699 00 00 00', role: 'membre',
  actif: true, date_inscription: '2026-09-02T10:00:00Z', derniere_connexion: null };
const INACTIF = { id: 3, email: 'b@cir.cm', nom_complet: 'Béatrice Ondoa', telephone: '', role: 'membre',
  actif: false, date_inscription: '2026-09-03T10:00:00Z', derniere_connexion: null };

function reponse(statut, corps) {
  return Promise.resolve(new Response(corps == null ? null : JSON.stringify(corps), {
    status: statut,
    headers: { 'Content-Type': 'application/json' },
  }));
}

/** `routes` : { motif: (url, options) => Promise<Response> } ; /moi/ renvoie le super-admin. */
function simuler(routes = {}, liste = [SUPER_ADMIN, MEMBRE, INACTIF]) {
  const simule = vi.fn((url, options = {}) => {
    const u = String(url);
    if (u.includes('/api/comptes/moi/')) return reponse(200, SUPER_ADMIN);
    for (const [motif, rappel] of Object.entries(routes)) if (u.includes(motif)) return rappel(u, options);
    return reponse(200, { count: liste.length, next: null, previous: null, results: liste });
  });
  vi.stubGlobal('fetch', simule);
  return simule;
}

function rendre() {
  localStorage.setItem('cir-tdb.jetons', JSON.stringify({ acces: 'a', rafraichissement: 'r' }));
  return render(<MemoryRouter initialEntries={['/equipe']}><App /></MemoryRouter>);
}

const ligne = (nom) => screen.getByText(nom, { selector: 'td > strong' }).closest('tr');

describe('validerMembre', () => {
  const ok = { nom_complet: 'Jean', email: 'j@cir.cm', telephone: '', role: 'membre', mot_de_passe: '12345678' };
  it('accepte un formulaire complet', () => expect(validerMembre(ok)).toEqual({}));
  it('exige nom, e-mail valide et 8 caractères de mot de passe', () => {
    expect(validerMembre({ ...ok, nom_complet: '  ', email: 'x', mot_de_passe: '1234567' })).toEqual({
      nom_complet: 'Indiquez le nom complet.',
      email: "Cet e-mail n'est pas valide.",
      mot_de_passe: 'Au moins 8 caractères.',
    });
    expect(validerMembre({ ...ok, email: '' }).email).toBe("Indiquez l'e-mail.");
  });
});

describe('EquipePage', () => {
  it("liste l'équipe triée par nom, demande au plus 100 membres et affiche statut et rôle", async () => {
    const simule = simuler({}, [MEMBRE, INACTIF, SUPER_ADMIN]);
    rendre();
    const table = await screen.findByRole('table', { name: "Membres de l'équipe" });
    const noms = within(table).getAllByRole('cell')
      .map((c) => c.querySelector('strong')?.textContent).filter(Boolean);
    expect(noms).toEqual(['Awa Nana', 'Béatrice Ondoa', 'Jean Mbarga']);
    expect(simule.mock.calls.some(([u]) => String(u).endsWith('/api/admin/comptes/equipe/?taille=100'))).toBe(true);
    expect(within(ligne('Awa Nana')).getByText('(vous)')).toBeInTheDocument();
    expect(within(ligne('Jean Mbarga')).getByText("Membre de l'équipe")).toBeInTheDocument();
    expect(within(ligne('Jean Mbarga')).getByText('Jamais')).toBeInTheDocument();
    expect(within(ligne('Béatrice Ondoa')).getByText('Désactivé')).toBeInTheDocument();
  });

  it('ne propose aucun bouton pour se retirer soi-même', async () => {
    simuler();
    rendre();
    await screen.findByRole('table');
    expect(within(ligne('Awa Nana')).queryByRole('button')).toBeNull();
  });

  it("demande une confirmation et permet d'annuler sans appeler le serveur", async () => {
    const simule = simuler();
    rendre();
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Désactiver Jean Mbarga' }));
    expect(screen.getByRole('group', { name: "Confirmer le retrait d'accès de Jean Mbarga" })).toBeInTheDocument();
    await u.click(within(ligne('Jean Mbarga')).getByRole('button', { name: 'Annuler' }));
    expect(screen.getByRole('button', { name: 'Désactiver Jean Mbarga' })).toBeInTheDocument();
    expect(simule.mock.calls.some(([u2]) => String(u2).includes('/desactiver/'))).toBe(false);
  });

  it('affiche le refus du serveur lors de la désactivation', async () => {
    const simule = simuler({
      '/2/desactiver/': () => reponse(400, { detail: 'Il doit rester au moins un super-administrateur actif.' }),
    });
    rendre();
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Désactiver Jean Mbarga' }));
    await u.click(screen.getByRole('button', { name: 'Confirmer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Il doit rester au moins un super-administrateur actif.');
    const appel = simule.mock.calls.find(([u2]) => String(u2).includes('/2/desactiver/'));
    expect(appel[1].method).toBe('POST');
    expect(within(ligne('Jean Mbarga')).getByText('Actif')).toBeInTheDocument();
  });

  it('réactive un membre désactivé', async () => {
    const simule = simuler({ '/3/reactiver/': () => reponse(200, { ...INACTIF, actif: true }) });
    rendre();
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Réactiver Béatrice Ondoa' }));
    expect(await screen.findByRole('button', { name: 'Désactiver Béatrice Ondoa' })).toBeInTheDocument();
    expect(simule.mock.calls.find(([u]) => String(u).includes('/api/admin/comptes/equipe/3/reactiver/'))[1].method)
      .toBe('POST');
  });

  it('ajoute un membre avec les noms de champs du back-end, puis annonce le succès', async () => {
    const nouveau = { id: 4, email: 'n@cir.cm', nom_complet: 'Nadège Fotso', telephone: '+237 677 11 22 33',
      role: 'super_admin', actif: true, date_inscription: '2026-10-16T09:00:00Z', derniere_connexion: null };
    const simule = simuler({
      '/equipe/': (u, o) => (o.method === 'POST' ? reponse(201, nouveau)
        : reponse(200, { count: 2, next: null, previous: null, results: [SUPER_ADMIN, MEMBRE] })),
    });
    rendre();
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Ajouter un membre' }));
    const form = screen.getByRole('form', { name: 'Ajouter un membre' });
    await u.type(within(form).getByLabelText(/Nom complet/), '  Nadège Fotso ');
    await u.type(within(form).getByLabelText(/E-mail/), ' N@CIR.cm ');
    await u.type(within(form).getByLabelText(/Téléphone/), '+237 677 11 22 33');
    await u.selectOptions(within(form).getByLabelText(/Rôle/), 'super_admin');
    await u.type(within(form).getByLabelText(/Mot de passe provisoire/), 'provisoire-123');
    await u.click(within(form).getByRole('button', { name: 'Ajouter le membre' }));

    expect(await screen.findByText("Nadège Fotso a été ajouté à l'équipe.", { selector: 'p:not([role])' })).toBeInTheDocument();
    const appel = simule.mock.calls.find(([, o]) => o?.method === 'POST');
    expect(String(appel[0])).toMatch(/\/api\/admin\/comptes\/equipe\/$/);
    expect(JSON.parse(appel[1].body)).toEqual({
      nom_complet: 'Nadège Fotso', email: 'n@cir.cm', telephone: '+237 677 11 22 33',
      role: 'super_admin', mot_de_passe: 'provisoire-123',
    });
    expect(screen.queryByRole('form', { name: 'Ajouter un membre' })).toBeNull();
    expect(ligne('Nadège Fotso')).toBeInTheDocument();
  });

  it('bloque un formulaire incomplet sans appeler le serveur', async () => {
    const simule = simuler();
    rendre();
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Ajouter un membre' }));
    await u.click(screen.getByRole('button', { name: 'Ajouter le membre' }));
    expect(screen.getByText('Indiquez le nom complet.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Mot de passe provisoire/)).toHaveAttribute('aria-invalid', 'true');
    expect(simule.mock.calls.some(([, o]) => o?.method === 'POST')).toBe(false);
  });

  it('affiche les erreurs du serveur sous chaque champ', async () => {
    simuler({
      '/equipe/': (u, o) => (o.method === 'POST'
        ? reponse(400, { email: ['Un compte existe déjà avec cet e-mail.'], mot_de_passe: ['Ce mot de passe est trop courant.'] })
        : reponse(200, { count: 1, next: null, previous: null, results: [SUPER_ADMIN] })),
    });
    rendre();
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Ajouter un membre' }));
    await u.type(screen.getByLabelText(/Nom complet/), 'Jean');
    await u.type(screen.getByLabelText(/E-mail/), 'm@cir.cm');
    await u.type(screen.getByLabelText(/Mot de passe provisoire/), 'password');
    await u.click(screen.getByRole('button', { name: 'Ajouter le membre' }));
    await waitFor(() => expect(screen.getByLabelText(/E-mail/)).toHaveAccessibleDescription('Un compte existe déjà avec cet e-mail.'));
    expect(screen.getByLabelText(/Mot de passe provisoire/)).toHaveAccessibleDescription(/Ce mot de passe est trop courant\./);
    expect(screen.queryByRole('alert')).toBeNull();
    // Le formulaire reste ouvert avec la saisie.
    expect(screen.getByLabelText(/Nom complet/)).toHaveValue('Jean');
  });

  it("affiche un message général pour une erreur qui ne concerne aucun champ", async () => {
    simuler({
      '/equipe/': (u, o) => (o.method === 'POST'
        ? reponse(403, { detail: "Vous n'avez pas la permission d'effectuer cette action." })
        : reponse(200, { count: 1, next: null, previous: null, results: [SUPER_ADMIN] })),
    });
    rendre();
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Ajouter un membre' }));
    await u.type(screen.getByLabelText(/Nom complet/), 'Jean');
    await u.type(screen.getByLabelText(/E-mail/), 'm@cir.cm');
    await u.type(screen.getByLabelText(/Mot de passe provisoire/), 'password');
    await u.click(screen.getByRole('button', { name: 'Ajouter le membre' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Vous n'avez pas la permission d'effectuer cette action.");
  });

  it('propose de réessayer quand la liste ne se charge pas', async () => {
    let echec = true;
    simuler({
      '/equipe/': () => (echec ? reponse(503, null)
        : reponse(200, { count: 1, next: null, previous: null, results: [SUPER_ADMIN] })),
    });
    rendre();
    expect(await screen.findByRole('alert')).toHaveTextContent('Le serveur rencontre un problème');
    echec = false;
    await userEvent.setup().click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('affiche un état vide sans membre', async () => {
    simuler({}, []);
    rendre();
    expect(await screen.findByText("Aucun membre pour l'instant")).toBeInTheDocument();
  });
});
