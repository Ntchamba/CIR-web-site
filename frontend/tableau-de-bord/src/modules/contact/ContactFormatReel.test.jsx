// Contact (testeur, vague 2) : réponses relevées sur le vrai back-end : liste et détail identiques, `auteur`
// {id, nom_complet} ou null, `produit` {slug, nom} ou null, e-mail vide pour un rappel, `traitee_le`.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { appels, page, rendre, reponse, simulerApi } from '@/test/api-simulee.jsx';

const RAPPEL = {
  id: 1, reference: 'CTC-2026-0001', type: 'rappel', creneau: 'matin', message: 'Rappelez-moi svp', produit: null, etat: 'nouvelle',
  reponse_equipe: '', cree_le: '2026-10-18T12:07:34.561295+01:00', traitee_le: null, nom: 'Paul', email: '', telephone: '+237 600 000 000',
  langue: 'fr', auteur: null, notes_internes: '',
};
const QUESTION = {
  id: 2, reference: 'CTC-2026-0002', type: 'question', creneau: '', message: 'Quel délai ?', produit: { slug: 'sol-autolissant-yd-500', nom: 'Sol autolissant' },
  etat: 'en_cours', reponse_equipe: 'Je regarde', cree_le: '2026-10-18T12:08:00+01:00', traitee_le: null, nom: 'Awa Nana', email: 'awa@x.cm',
  telephone: '+237 677 00 11 22', langue: 'en', auteur: { id: 2, nom_complet: 'Awa Nana' }, notes_internes: 'Cliente fidèle',
};
const RESUME = { nouvelle: 1, en_cours: 1, traitee: 0, total: 2 };

const routes = (extra = []) => [
  ['GET', 'demandes/resume/', RESUME],
  ...extra,
  ['GET', '/api/admin/contact/demandes/', page([RAPPEL, QUESTION])],
];

describe('DemandesPage (format réel)', () => {
  it('une demande de rappel sans e-mail ne montre que le téléphone ; une question affiche son produit et pas de créneau', async () => {
    simulerApi(routes());
    rendre('/contact');
    const table = await screen.findByRole('table');
    const lignes = within(table).getAllByRole('row');
    expect(within(lignes[1]).getByRole('link', { name: '+237 600 000 000' })).toHaveAttribute('href', 'tel:+237600000000');
    expect(within(lignes[1]).queryByRole('link', { name: /@/ })).toBeNull();
    expect(within(lignes[1]).getByText('Le matin')).toBeInTheDocument();
    expect(within(lignes[2]).getByText('Question')).toBeInTheDocument();
    expect(within(lignes[2]).queryByText(/Le matin|Le soir|Peu importe/)).toBeNull();
    const onglets = screen.getByRole('tablist');
    expect(await within(onglets).findByRole('tab', { name: /^Toutes\s*2$/ })).toHaveAttribute('aria-selected', 'true');
    expect(within(onglets).getByRole('tab', { name: /^En cours\s*1$/ })).toBeInTheDocument();
  });

  it('tiroir d’une demande de client connecté : lien vers la fiche, langue, produit, notes déjà enregistrées', async () => {
    simulerApi(routes());
    rendre('/contact');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'CTC-2026-0002' }));
    const tiroir = await screen.findByRole('dialog', { name: 'Demande CTC-2026-0002' });
    expect(within(tiroir).getByRole('link', { name: 'Awa Nana' })).toHaveAttribute('href', '/clients/2');
    expect(within(tiroir).getByText(/répondez en English/)).toBeInTheDocument();
    expect(within(tiroir).getByText('Sol autolissant')).toBeInTheDocument();
    expect(within(tiroir).getByLabelText('État')).toHaveValue('en_cours');
    expect(within(tiroir).getByLabelText("Réponse de l'équipe")).toHaveValue('Je regarde');
    expect(within(tiroir).getByLabelText('Notes')).toHaveValue('Cliente fidèle');
    // Le message du client est affiché tel quel (texte, pas du HTML).
    expect(within(tiroir).getByText('Quel délai ?')).toBeInTheDocument();
  });

  it('le texte du visiteur n’est jamais interprété comme du HTML', async () => {
    const piege = { ...RAPPEL, message: '<img src=x onerror=alert(1)> <b>gras</b>', nom: '<script>alert(1)</script>' };
    simulerApi([
      ['GET', 'demandes/resume/', RESUME],
      ['GET', '/api/admin/contact/demandes/', page([piege])],
    ]);
    const { container } = rendre('/contact');
    await screen.findByRole('button', { name: 'CTC-2026-0001' });
    expect(container.querySelector('img[src="x"]')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(document.body.querySelector('b')).toBeNull();
  });

  it('passer à « traitée » : PATCH, `traitee_le` affichée, la liste et les nombres suivent', async () => {
    let traitee = false;
    const simule = simulerApi([
      ['GET', 'demandes/resume/', () => reponse(200, traitee ? { nouvelle: 0, en_cours: 1, traitee: 1, total: 2 } : RESUME)],
      ['PATCH', 'demandes/1/', (u, o) => {
        traitee = true;
        return reponse(200, { ...RAPPEL, ...JSON.parse(o.body), traitee_le: '2026-10-18T13:00:00+01:00' });
      }],
      ['GET', '/api/admin/contact/demandes/', page([RAPPEL, QUESTION])],
    ]);
    rendre('/contact');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'CTC-2026-0001' }));
    const tiroir = await screen.findByRole('dialog');
    expect(within(tiroir).queryByText('Traitée le')).toBeNull();
    await u.selectOptions(within(tiroir).getByLabelText('État'), 'traitee');
    await u.click(within(tiroir).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(appels(simule, 'PATCH', 'demandes/1/')).toHaveLength(1));
    expect(JSON.parse(appels(simule, 'PATCH', 'demandes/1/')[0][1].body)).toEqual({ etat: 'traitee', reponse_equipe: '' });
    expect(await within(tiroir).findByText('Traitée le')).toBeInTheDocument();
    await waitFor(() => expect(appels(simule, 'GET', 'demandes/resume/').length).toBeGreaterThanOrEqual(2));
    await u.keyboard('{Escape}');
    const ligne = (await screen.findByRole('button', { name: 'CTC-2026-0001' })).closest('tr');
    expect(within(ligne).getByText('Traitée')).toBeInTheDocument();
  });

  it('erreur 400 sur l’état ou la réponse : sous le champ, pas en haut', async () => {
    simulerApi(routes([['PATCH', 'demandes/1/', () => reponse(400, { reponse_equipe: ['Ce champ ne peut pas être vide.'] })]]));
    rendre('/contact');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'CTC-2026-0001' }));
    const tiroir = await screen.findByRole('dialog');
    await u.click(within(tiroir).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(within(tiroir).getByLabelText("Réponse de l'équipe")).toHaveAccessibleDescription(/ne peut pas être vide/));
  });

  it('recherche différée : un seul appel avec search=… après la frappe', async () => {
    const simule = simulerApi(routes());
    rendre('/contact');
    const u = userEvent.setup();
    await screen.findByRole('button', { name: 'CTC-2026-0001' });
    await u.type(screen.getByLabelText('Rechercher'), 'paul');
    await waitFor(() => expect(simule.mock.calls.some(([x]) => /search=paul/.test(String(x)))).toBe(true));
    expect(simule.mock.calls.filter(([x]) => /demandes\/\?.*search=/.test(String(x)) && !/search=paul$/.test(String(x).split('&')[0])).length).toBeLessThanOrEqual(1);
  });
});
