// Vitrine : réalisations (photo après obligatoire, multipart), démos (vidéo ou lien), modération des témoignages.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { appels, page, rendre, simulerApi } from '@/test/api-simulee.jsx';

import { validerDemo } from './composants/TiroirDemo.jsx';

const TEMOIGNAGE = {
  id: 5, auteur: { id: 9, email: 'client@exemple.cm', nom_complet: 'Client test' }, nom_affiche: 'Client test',
  ville: 'Douala', type_chantier: 'maison', texte: 'Texte du client, conservé tel quel.', note: 4, langue: 'fr',
  statut: 'en_attente', motif_refus: '', cree_le: '2026-10-15T09:00:00Z', modere_le: null,
};

describe('validerDemo', () => {
  const base = { titre: 'Démo', lien: '', duree: '' };
  it('exige une vidéo ou un lien YouTube / Vimeo', () => {
    expect(validerDemo(base, { video: null }).lien).toBe('Envoyez une vidéo ou indiquez un lien.');
    expect(validerDemo({ ...base, lien: 'https://exemple.cm/v' }, { video: null }).lien).toMatch(/YouTube ou Vimeo/);
    expect(validerDemo({ ...base, lien: 'https://youtu.be/abc', duree: '1:45' }, { video: null })).toEqual({});
    expect(validerDemo({ ...base, duree: '90' }, { video: 'https://x/v.mp4' }).duree).toMatch(/minutes:secondes/);
  });
});

describe('VitrinePage', () => {
  it('ouvre les réalisations et exige la photo après avant tout envoi', async () => {
    const simule = simulerApi([['GET', 'temoignages/', page([])]]);
    rendre('/vitrine');
    expect(await screen.findByRole('heading', { level: 1, name: 'Vitrine' })).toBeInTheDocument();
    expect(await screen.findByText('Aucune réalisation pour le moment')).toBeInTheDocument();
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Nouvelle réalisation' }));
    const tiroir = screen.getByRole('dialog', { name: 'Nouvelle réalisation' });
    await u.type(within(tiroir).getByLabelText(/^Titre/), 'Villa à Bonapriso');
    await u.click(within(tiroir).getByRole('button', { name: 'Enregistrer' }));
    expect(within(tiroir).getByText('Ajoutez la photo après travaux.')).toBeInTheDocument();
    expect(appels(simule, 'POST', 'realisations/')).toHaveLength(0);
  });

  it('envoie une réalisation en multipart avec les produits en JSON', async () => {
    const simule = simulerApi([
      ['GET', 'temoignages/', page([])],
      ['GET', '/catalogue/produits/', page([{ id: 3, nom: 'Sol autolissant', reference: 'YD-500' }])],
      ['POST', 'realisations/', { id: 1, titre: 'Villa', type_chantier: 'maison', publie: true, image_apres: 'https://x/a.webp' }],
    ]);
    rendre('/vitrine/realisations');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Nouvelle réalisation' }));
    const tiroir = screen.getByRole('dialog');
    await u.type(within(tiroir).getByLabelText(/^Titre/), 'Villa');
    await u.upload(within(tiroir).getByLabelText(/Photo après/), new File(['x'], 'apres.jpg', { type: 'image/jpeg' }));
    await u.click(await within(tiroir).findByLabelText('Sol autolissant (YD-500)'));
    await u.click(within(tiroir).getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('La réalisation « Villa » a été enregistrée.', { selector: 'p:not([role])' })).toBeInTheDocument();
    const corps = appels(simule, 'POST', 'realisations/')[0][1].body;
    expect(corps).toBeInstanceOf(FormData);
    expect(corps.get('produits')).toBe('[3]');
    expect(corps.get('image_apres').name).toBe('apres.jpg');
  });

  it('modère un témoignage : compteur, refus avec motif', async () => {
    let refuse = false;
    const simule = simulerApi([
      ['GET', 'statut=en_attente&taille=1', () => Promise.resolve(new Response(JSON.stringify(page(refuse ? [] : [TEMOIGNAGE])),
        { status: 200, headers: { 'Content-Type': 'application/json' } }))],
      ['GET', 'temoignages/', page([TEMOIGNAGE])],
      ['POST', '/5/refuser/', () => { refuse = true; return { ...TEMOIGNAGE, statut: 'refuse', motif_refus: 'Hors sujet' }; }],
    ]);
    rendre('/vitrine/temoignages');
    expect(await screen.findByText('1 en attente')).toBeInTheDocument();
    const carte = (await screen.findByRole('heading', { level: 3, name: 'Client test' })).closest('li');
    expect(within(carte).getByText('Texte du client, conservé tel quel.')).toBeInTheDocument();
    expect(within(carte).getByRole('img', { name: 'Note : 4 sur 5' })).toBeInTheDocument();
    const u = userEvent.setup();
    await u.click(within(carte).getByRole('button', { name: 'Refuser le témoignage de Client test' }));
    await u.type(within(carte).getByLabelText(/Motif du refus/), 'Hors sujet');
    await u.click(within(carte).getByRole('button', { name: 'Confirmer le refus' }));
    expect(await screen.findByText('Aucun témoignage en attente')).toBeInTheDocument();
    expect(JSON.parse(appels(simule, 'POST', '/5/refuser/')[0][1].body)).toEqual({ motif: 'Hors sujet' });
    await waitFor(() => expect(screen.queryByText('1 en attente')).toBeNull());
  });
});
