// Actualités : états (publiée, programmée, non publiée), création programmée.
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { appels, page, rendre, simulerApi } from '@/test/api-simulee.jsx';

import { etatActualite } from './useActualites.js';

const FUTUR = '2099-01-15T08:00:00Z';

describe('etatActualite', () => {
  it('distingue brouillon, programmée et publiée', () => {
    expect(etatActualite({ publie: false })).toBe('brouillon');
    expect(etatActualite({ publie: true, publie_le: FUTUR })).toBe('programmee');
    expect(etatActualite({ publie: true, publie_le: '2020-01-01T00:00:00Z' })).toBe('publiee');
  });
});

describe('ActualitesPage', () => {
  it('affiche la pastille « Programmée » et crée une actualité programmée', async () => {
    const simule = simulerApi([
      ['GET', '/api/admin/actualites/', page([
        { id: 1, titre: 'Salon de Douala', resume: '', publie: true, publie_le: FUTUR, programmee: true, langues_incompletes: [] },
      ])],
      ['POST', '/api/admin/actualites/', { id: 2, titre: 'Nouveau primaire', publie: true, publie_le: FUTUR, programmee: true }],
    ]);
    rendre('/actualites');
    const ligne = (await screen.findByRole('button', { name: 'Salon de Douala' })).closest('tr');
    expect(within(ligne).getByText('Programmée')).toBeInTheDocument();
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Nouvelle actualité' }));
    const tiroir = screen.getByRole('dialog', { name: 'Nouvelle actualité' });
    await u.type(within(tiroir).getByLabelText(/^Titre/), 'Nouveau primaire');
    await u.type(within(tiroir).getByLabelText('Date et heure de publication'), '2099-01-15T09:00');
    expect(within(tiroir).getByText(/Programmée : publiée le/)).toBeInTheDocument();
    await u.click(within(tiroir).getByRole('button', { name: 'Programmer' }));
    expect(await screen.findByText("L'actualité « Nouveau primaire » a été enregistrée.", { selector: 'p:not([role])' })).toBeInTheDocument();
    const corps = JSON.parse(appels(simule, 'POST', '/api/admin/actualites/')[0][1].body);
    expect(corps).toMatchObject({ titre: 'Nouveau primaire', publie: true, produit: null });
    expect(new Date(corps.publie_le).getTime()).toBe(new Date('2099-01-15T09:00').getTime());
  });

  it('affiche un état vide', async () => {
    simulerApi();
    rendre('/actualites');
    expect(await screen.findByText('Aucune actualité pour le moment')).toBeInTheDocument();
  });
});
