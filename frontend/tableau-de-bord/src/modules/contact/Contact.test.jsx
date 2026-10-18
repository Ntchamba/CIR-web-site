// Demandes de contact (équipe) : boîte de réception, filtres, tiroir, réponse, notes internes.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { appels, page, rendre, simulerApi } from '@/test/api-simulee.jsx';

const DEMANDE = {
  id: 4, reference: 'CTC-2026-0004', nom: 'Paul Eto', email: 'paul@x.cm', telephone: '699 11 22 33', type: 'rappel', creneau: 'soir',
  message: 'Merci de me rappeler pour un devis.', produit: { slug: 'v', nom: 'Vernis' }, langue: 'de', etat: 'nouvelle',
  reponse_equipe: '', notes_internes: 'RAS', auteur: null, cree_le: '2026-10-17T10:00:00Z', traitee_le: null,
};

const routes = (extra = []) => [
  ['GET', 'demandes/resume/', { nouvelle: 1, en_cours: 0, traitee: 5, total: 6 }],
  ...extra,
  ['GET', '/api/admin/contact/demandes/', page([DEMANDE])],
];

describe('DemandesPage', () => {
  it('liste les demandes avec onglets par état, liens tel:/mailto: et créneau', async () => {
    simulerApi(routes());
    rendre('/contact');
    expect(await screen.findByRole('button', { name: 'CTC-2026-0004' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'paul@x.cm' })).toHaveAttribute('href', 'mailto:paul@x.cm');
    expect(screen.getByRole('link', { name: '699 11 22 33' })).toHaveAttribute('href', 'tel:699112233');
    expect(screen.getByText('Le soir')).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: /^Nouvelle\s*1$/ })).toBeInTheDocument();
  });

  it('filtre par état et par type auprès du serveur', async () => {
    const simule = simulerApi(routes());
    rendre('/contact');
    const u = userEvent.setup();
    await screen.findByRole('button', { name: 'CTC-2026-0004' });
    await u.click(screen.getByRole('tab', { name: /^Traitée/ }));
    await waitFor(() => expect(simule.mock.calls.some(([x]) => String(x).includes('etat=traitee'))).toBe(true));
    await u.selectOptions(screen.getByLabelText('Type'), 'question');
    await waitFor(() => expect(simule.mock.calls.some(([x]) => /etat=traitee.*type=question|type=question.*etat=traitee/.test(String(x)))).toBe(true));
  });

  it('tiroir : langue du visiteur, réponse et état enregistrés, notes à part', async () => {
    const simule = simulerApi(routes([['PATCH', 'demandes/4/', { ...DEMANDE, etat: 'traitee', reponse_equipe: 'Rappelé.' }]]));
    rendre('/contact');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'CTC-2026-0004' }));
    const tiroir = await screen.findByRole('dialog', { name: 'Demande CTC-2026-0004' });
    expect(within(tiroir).getByText(/répondez en Deutsch/)).toBeInTheDocument();
    expect(within(tiroir).getByText('Merci de me rappeler pour un devis.')).toBeInTheDocument();
    expect(within(tiroir).getByText('Visiteur sans compte')).toBeInTheDocument();
    await u.selectOptions(within(tiroir).getByLabelText('État'), 'traitee');
    await u.type(within(tiroir).getByLabelText('Réponse de l\'équipe'), 'Rappelé.');
    await u.click(within(tiroir).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(appels(simule, 'PATCH', 'demandes/4/')).toHaveLength(1));
    expect(JSON.parse(appels(simule, 'PATCH', 'demandes/4/')[0][1].body)).toEqual({ etat: 'traitee', reponse_equipe: 'Rappelé.' });
    await u.type(within(tiroir).getByLabelText('Notes'), ' !');
    await u.click(within(tiroir).getByRole('button', { name: 'Enregistrer les notes' }));
    await waitFor(() => expect(appels(simule, 'PATCH', 'demandes/4/')).toHaveLength(2));
    expect(JSON.parse(appels(simule, 'PATCH', 'demandes/4/')[1][1].body)).toEqual({ notes_internes: 'RAS !' });
  });

  it('le tiroir garde le focus à l’intérieur et se ferme avec Échap', async () => {
    simulerApi(routes());
    rendre('/contact');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'CTC-2026-0004' }));
    const tiroir = await screen.findByRole('dialog');
    await u.tab();
    expect(tiroir.contains(document.activeElement)).toBe(true);
    await u.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
