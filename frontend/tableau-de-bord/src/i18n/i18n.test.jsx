// Multilingue du tableau de bord : fichiers de textes complets, changement de langue depuis l'en-tête,
// menu, rôles et nombre de clients traduits, langue gardée dans le compte du membre.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';

import { ecartsAvecFrancais } from '@partage/i18n/verification.js';

import App from '@/app/App.jsx';
import { libelleRole } from '@/modules/connexion/roles.js';

import de from './de.js';
import en from './en.js';
import fr from './fr.js';
import { changerLangue } from './index.js';
import ja from './ja.js';
import zh from './zh.js';

const MEMBRE = { id: 2, email: 'm@cir.cm', nom_complet: 'Jean Mbarga', role: 'membre', est_equipe: true, langue: 'fr' };

const json = (statut, corps) => Promise.resolve(new Response(JSON.stringify(corps), {
  status: statut, headers: { 'Content-Type': 'application/json' },
}));

function rendre(chemin, clients = { count: 0, next: null, previous: null, results: [] }) {
  localStorage.setItem('cir-tdb.jetons', JSON.stringify({ acces: 'a', rafraichissement: 'r' }));
  const simule = vi.fn((url, init = {}) => {
    const u = String(url);
    if (u.includes('/api/comptes/moi/') && init.method === 'PATCH') {
      return json(200, { ...MEMBRE, ...JSON.parse(init.body) });
    }
    if (u.includes('/api/comptes/moi/')) return json(200, MEMBRE);
    return json(200, clients);
  });
  vi.stubGlobal('fetch', simule);
  render(<MemoryRouter initialEntries={[chemin]}><App /></MemoryRouter>);
  return simule;
}

const choixEntete = () => within(screen.getByRole('banner')).getByRole('combobox');

describe('fichiers de textes du tableau de bord', () => {
  it.each([['en', en], ['zh', zh], ['de', de], ['ja', ja]])('%s : mêmes clés et variables que le français', (code, textes) => {
    expect(ecartsAvecFrancais(fr, textes)).toEqual([]);
  });

  it('rôles traduits, code inconnu laissé tel quel', async () => {
    expect(libelleRole('membre')).toBe("Membre de l'équipe");
    await changerLangue('ja');
    expect(libelleRole('super_admin')).toBe('スーパー管理者');
    expect(libelleRole('inconnu')).toBe('inconnu');
  });
});

describe('changement de langue', () => {
  it('menu, en-tête et page passent en allemand ; la langue est enregistrée dans le compte', async () => {
    const fetch = rendre('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Bonjour Jean' })).toBeInTheDocument();
    await userEvent.selectOptions(choixEntete(), 'de');
    expect(await screen.findByRole('heading', { level: 1, name: 'Hallo Jean' })).toBeInTheDocument();
    const menu = screen.getByRole('navigation', { name: 'Dashboard-Menü' });
    expect(within(menu).getByRole('link', { name: /Kunden/ })).toHaveAttribute('href', '/clients');
    expect(within(menu).getAllByText('Demnächst verfügbar').length).toBeGreaterThan(0);
    expect(screen.getByText('Teammitglied')).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('Startseite | CIR-Dashboard'));
    await waitFor(() => {
      const patch = fetch.mock.calls.find(([, init = {}]) => init.method === 'PATCH');
      expect(patch).toBeTruthy();
      expect(JSON.parse(patch[1].body)).toEqual({ langue: 'de' });
    });
  });

  it('liste des clients en chinois : titre, colonnes et nombre de clients', async () => {
    rendre('/clients', {
      count: 2, next: null, previous: null,
      results: [
        { id: 7, email: 'a@x.cm', nom_complet: 'Awa', ville: 'Douala', quartier: 'Akwa', adresse_complete: true, date_inscription: '2026-10-16T10:00:00Z' },
        { id: 8, email: 'b@x.cm', nom_complet: 'Paul', ville: '', quartier: '', adresse_complete: false, date_inscription: '2026-10-15T10:00:00Z' },
      ],
    });
    await screen.findByText('2 clients');
    await userEvent.selectOptions(choixEntete(), 'zh');
    expect(await screen.findByRole('heading', { level: 1, name: '客户' })).toBeInTheDocument();
    expect(screen.getByText('2 位客户')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '城市和街区' })).toBeInTheDocument();
    expect(screen.getByText('地址不完整')).toBeInTheDocument();
    expect(screen.getByText('2026年10月16日')).toBeInTheDocument();
  });
});
