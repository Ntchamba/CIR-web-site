// Vitrine (testeur) : formats réels du back-end (images en adresse, produits en ids, réalisation liée en id,
// date YYYY-MM-DD ou null), retrait d'une photo facultative (null en JSON, '' en multipart), durée des démos
// acceptée par le modèle Demo, modération des témoignages.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { appels, page, rendre, simulerApi } from '@/test/api-simulee.jsx';

import { validerDemo } from './TiroirDemo.jsx';
import { versFormulaireRealisation } from './TiroirRealisation.jsx';

// Réponses réelles de RealisationAdminSerializer / DemoAdminSerializer (client de test DRF).
const REALISATION = {
  id: 1, titre: 'Villa à Bonapriso', slug: 'villa-a-bonapriso', type_chantier: 'maison', ville: 'Douala', description: '',
  image_apres: 'http://testserver/media/vitrine/realisations/a.webp',
  image_avant: 'http://testserver/media/vitrine/realisations/b.webp',
  produits: [3], publie: true, date: '2026-05-01', ordre: 0, cree_le: '2026-10-16T11:28:38.897351+01:00',
  traductions: {}, langues_incompletes: ['en', 'zh', 'de', 'ja'],
};
const DEMO = {
  id: 1, titre: 'Pose d’un autolissant', description: '', video: null, lien: 'https://youtu.be/dQw4w9WgXcQ',
  integration: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', miniature: 'http://testserver/media/vitrine/demos/a.webp',
  duree: '1:45', realisation: 1, publie: true, ordre: 0, cree_le: '2026-10-16T11:28:39+01:00', traductions: {},
  langues_incompletes: [],
};
const PRODUITS = page([{ id: 3, nom: 'Sol autolissant', reference: 'YD-500' }, { id: 4, nom: 'Primaire', reference: 'YD-103' }]);

describe('validerDemo : mêmes règles que le modèle Demo (durée, lien)', () => {
  // Back-end : RegexValidator r"^\d{1,2}(:[0-5]\d){1,2}$" (« 1:45 » ou « 1:02:30 »).
  const base = { titre: 'Démo', lien: 'https://youtu.be/dQw4w9WgXcQ', duree: '' };
  it('accepte une durée en heures:minutes:secondes (1:02:30), acceptée par le serveur', () => {
    expect(validerDemo({ ...base, duree: '1:02:30' }, { video: null })).toEqual({});
  });
  it('refuse une durée que le serveur refuse (123:45)', () => {
    expect(validerDemo({ ...base, duree: '123:45' }, { video: null })).toHaveProperty('duree');
  });
  it('accepte un lien youtube-nocookie, accepté par le serveur', () => {
    expect(validerDemo({ ...base, lien: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' }, { video: null })).toEqual({});
  });
});

describe('versFormulaireRealisation', () => {
  it('lit les produits en ids et la date YYYY-MM-DD ; date null → champ vide', () => {
    expect(versFormulaireRealisation(REALISATION)).toMatchObject({ produits: [3], date: '2026-05-01', type_chantier: 'maison' });
    expect(versFormulaireRealisation({ ...REALISATION, date: null }).date).toBe('');
  });
});

describe('Réalisations (format réel)', () => {
  it('retire la photo avant : PATCH JSON image_avant null, date null, produits en ids', async () => {
    const simule = simulerApi([
      ['GET', 'temoignages/', page([])],
      ['GET', '/catalogue/produits/', PRODUITS],
      ['GET', '/vitrine/realisations/', page([REALISATION])],
      ['PATCH', '/vitrine/realisations/1/', (u, o) => ({ ...REALISATION, ...JSON.parse(o.body) })],
    ]);
    rendre('/vitrine/realisations');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Villa à Bonapriso' }));
    expect(appels(simule, 'GET', '/vitrine/realisations/?taille=100').length).toBeGreaterThan(0);
    const tiroir = screen.getByRole('dialog', { name: 'Modifier la réalisation' });
    expect(await within(tiroir).findByLabelText('Sol autolissant (YD-500)')).toBeChecked();
    expect(within(tiroir).getByLabelText('Primaire (YD-103)')).not.toBeChecked();
    expect(within(tiroir).getByLabelText('Date du chantier')).toHaveValue('2026-05-01');
    expect(within(tiroir).getAllByRole('img', { name: 'Aperçu' })[0]).toHaveAttribute('src', REALISATION.image_apres);

    await u.click(within(tiroir).getByRole('button', { name: "Retirer l'image" }));
    await u.clear(within(tiroir).getByLabelText('Date du chantier'));
    await u.click(within(tiroir).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(appels(simule, 'PATCH', '/realisations/1/')).toHaveLength(1));
    const options = appels(simule, 'PATCH', '/realisations/1/')[0][1];
    expect(options.body).not.toBeInstanceOf(FormData);
    const corps = JSON.parse(options.body);
    expect(corps).toMatchObject({ image_avant: null, date: null, produits: [3] });
    expect(corps).not.toHaveProperty('image_apres');
  });

  it("en multipart, la photo avant retirée part en chaîne vide et l'objet traductions en JSON", async () => {
    const simule = simulerApi([
      ['GET', 'temoignages/', page([])],
      ['GET', '/catalogue/produits/', PRODUITS],
      ['GET', '/vitrine/realisations/', page([REALISATION])],
      ['PATCH', '/vitrine/realisations/1/', { ...REALISATION, image_avant: null }],
    ]);
    rendre('/vitrine/realisations');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Villa à Bonapriso' }));
    const tiroir = screen.getByRole('dialog', { name: 'Modifier la réalisation' });
    await u.click(within(tiroir).getByRole('button', { name: "Retirer l'image" }));
    await u.upload(within(tiroir).getByLabelText(/Photo après/), new File(['x'], 'apres.jpg', { type: 'image/jpeg' }));
    await u.click(within(tiroir).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(appels(simule, 'PATCH', '/realisations/1/')).toHaveLength(1));
    const corps = appels(simule, 'PATCH', '/realisations/1/')[0][1].body;
    expect(corps).toBeInstanceOf(FormData);
    expect(corps.get('image_avant')).toBe('');
    expect(corps.get('image_apres').name).toBe('apres.jpg');
    expect(corps.get('traductions')).toBe('{}');
    expect(corps.get('produits')).toBe('[3]');
    expect(corps.get('date')).toBe('2026-05-01');
  });
});

describe('Démos (format réel)', () => {
  it('lit la réalisation liée (id) et la miniature (adresse) ; « Aucune » envoie realisation null', async () => {
    const simule = simulerApi([
      ['GET', 'temoignages/', page([])],
      ['GET', '/vitrine/realisations/', page([REALISATION])],
      ['GET', '/vitrine/demos/', page([DEMO])],
      ['PATCH', '/vitrine/demos/1/', (u, o) => ({ ...DEMO, ...JSON.parse(o.body) })],
    ]);
    rendre('/vitrine/demos');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: DEMO.titre }));
    const tiroir = screen.getByRole('dialog', { name: 'Modifier la démo' });
    expect(within(tiroir).getByLabelText('Réalisation liée')).toHaveValue('1');
    expect(within(tiroir).getByRole('img', { name: 'Aperçu' })).toHaveAttribute('src', DEMO.miniature);
    await u.selectOptions(within(tiroir).getByLabelText('Réalisation liée'), '');
    await u.click(within(tiroir).getByRole('button', { name: "Retirer l'image" }));
    await u.click(within(tiroir).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(appels(simule, 'PATCH', '/demos/1/')).toHaveLength(1));
    expect(JSON.parse(appels(simule, 'PATCH', '/demos/1/')[0][1].body))
      .toMatchObject({ realisation: null, miniature: null, lien: DEMO.lien, duree: '1:45' });
  });

  it('retirer la vidéo sans lien : refusé avant tout envoi (le serveur exige l’un des deux)', async () => {
    const avecVideo = { ...DEMO, lien: '', integration: null, video: 'http://testserver/media/vitrine/demos/v.mp4' };
    const simule = simulerApi([
      ['GET', 'temoignages/', page([])],
      ['GET', '/vitrine/demos/', page([avecVideo])],
    ]);
    rendre('/vitrine/demos');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: DEMO.titre }));
    const tiroir = screen.getByRole('dialog', { name: 'Modifier la démo' });
    await u.click(within(tiroir).getByRole('button', { name: 'Retirer la vidéo' }));
    await u.click(within(tiroir).getByRole('button', { name: 'Enregistrer' }));
    expect(within(tiroir).getByLabelText(/^Lien YouTube ou Vimeo/)).toHaveAccessibleDescription(/Envoyez une vidéo ou indiquez un lien\./);
    expect(appels(simule, 'PATCH', '/demos/')).toHaveLength(0);
  });
});

describe('Témoignages (modération)', () => {
  const TEMOIGNAGE = {
    id: 5, auteur: null, nom_affiche: 'Awa N.', ville: '', type_chantier: '', texte: 'Très bon travail, sol impeccable.',
    note: 5, langue: 'en', statut: 'en_attente', motif_refus: '', cree_le: '2026-10-15T09:00:00+01:00', modere_le: null, modere_par: null,
  };

  it('refus sans motif : corps {} ; publication ; filtre « Tous » sans paramètre statut', async () => {
    const simule = simulerApi([
      ['POST', '/temoignages/5/refuser/', { ...TEMOIGNAGE, statut: 'refuse' }],
      ['GET', '/vitrine/temoignages/', page([TEMOIGNAGE])],
    ]);
    rendre('/vitrine/temoignages');
    const u = userEvent.setup();
    const carte = (await screen.findByRole('heading', { level: 3, name: 'Awa N.' })).closest('li');
    expect(within(carte).getByText('Compte supprimé')).toBeInTheDocument();
    expect(within(carte).getByText(TEMOIGNAGE.texte)).toHaveAttribute('lang', 'en');
    await u.click(within(carte).getByRole('button', { name: 'Refuser le témoignage de Awa N.' }));
    await u.click(within(carte).getByRole('button', { name: 'Confirmer le refus' }));
    await waitFor(() => expect(appels(simule, 'POST', '/temoignages/5/refuser/')).toHaveLength(1));
    expect(JSON.parse(appels(simule, 'POST', '/temoignages/5/refuser/')[0][1].body)).toEqual({});

    await u.click(screen.getByRole('button', { name: 'Tous' }));
    await waitFor(() => expect(appels(simule, 'GET', '/api/admin/vitrine/temoignages/').some(([url]) => String(url).endsWith('/temoignages/'))).toBe(true));
    expect(screen.getByRole('button', { name: 'Tous' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('publie un témoignage par POST <id>/publier/ et supprime avec confirmation', async () => {
    const simule = simulerApi([
      ['POST', '/temoignages/5/publier/', { ...TEMOIGNAGE, statut: 'publie' }],
      ['DELETE', '/temoignages/5/', () => Promise.resolve(new Response(null, { status: 204 }))],
      ['GET', '/vitrine/temoignages/', page([TEMOIGNAGE])],
    ]);
    rendre('/vitrine/temoignages');
    const u = userEvent.setup();
    const carte = (await screen.findByRole('heading', { level: 3, name: 'Awa N.' })).closest('li');
    await u.click(within(carte).getByRole('button', { name: 'Supprimer Awa N.' }));
    expect(appels(simule, 'DELETE', '/temoignages/5/')).toHaveLength(0);
    await u.click(within(carte).getByRole('button', { name: 'Annuler' }));
    await u.click(within(carte).getByRole('button', { name: 'Publier le témoignage de Awa N.' }));
    await waitFor(() => expect(appels(simule, 'POST', '/temoignages/5/publier/')).toHaveLength(1));
    // Filtre « En attente » : la carte publiée disparaît de la liste.
    expect(await screen.findByText('Aucun témoignage en attente')).toBeInTheDocument();
  });
});
