// Actualités (testeur) : formats réels (publie_le ISO avec fuseau, produit en id, image en adresse),
// date envoyée en ISO UTC ou omise, retrait de l'image (null en JSON), multipart avec image.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { depuisDateHeureLocale, versDateHeureLocale } from '@/composants/envoi.js';
import { appels, page, rendre, simulerApi } from '@/test/api-simulee.jsx';

import { etatActualite } from '../useActualites.js';
import { validerActualite } from './TiroirActualite.jsx';

// Réponse réelle de ActualiteAdminSerializer (client de test DRF).
const ACTUALITE = {
  id: 1, titre: 'Nouveau YD-518', slug: 'nouveau-yd-518', resume: 'Terrazzo époxy.', texte: '', produit: 3,
  image: 'http://testserver/media/actualites/a.webp', publie: true, publie_le: '2030-01-01T09:00:00+01:00', programmee: true,
  cree_le: '2026-10-16T11:28:39+01:00', modifie_le: '2026-10-16T11:28:39+01:00', traductions: {}, langues_incompletes: ['en', 'zh', 'de', 'ja'],
};
const PRODUITS = page([{ id: 3, nom: 'Terrazzo époxy', reference: 'YD-518' }]);

describe('dates de publication', () => {
  it('aller-retour ISO serveur → champ datetime-local → ISO UTC sans décalage', () => {
    const local = versDateHeureLocale(ACTUALITE.publie_le);
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(new Date(depuisDateHeureLocale(local)).getTime()).toBe(new Date(ACTUALITE.publie_le).getTime());
    expect(depuisDateHeureLocale(local)).toMatch(/Z$/);
    expect(depuisDateHeureLocale('')).toBeNull();
    expect(versDateHeureLocale(null)).toBe('');
  });

  it('état : brouillon, programmée (drapeau serveur ou date future), publiée', () => {
    const maintenant = new Date('2026-10-16T10:00:00Z').getTime();
    expect(etatActualite({ ...ACTUALITE, publie: false }, maintenant)).toBe('brouillon');
    expect(etatActualite(ACTUALITE, maintenant)).toBe('programmee');
    expect(etatActualite({ ...ACTUALITE, programmee: false, publie_le: '2026-10-01T09:00:00+01:00' }, maintenant)).toBe('publiee');
  });

  it('validerActualite : titre obligatoire, résumé de 280 caractères au plus', () => {
    expect(validerActualite({ titre: ' ', resume: '' })).toHaveProperty('titre');
    expect(validerActualite({ titre: 'A', resume: 'r'.repeat(281) })).toHaveProperty('resume');
    expect(validerActualite({ titre: 'A', resume: 'r'.repeat(280) })).toEqual({});
  });
});

describe('TiroirActualite (format réel)', () => {
  it('ouvre une actualité réelle, retire l’image et enregistre en JSON (publie_le en ISO UTC)', async () => {
    const simule = simulerApi([
      ['GET', '/catalogue/produits/', PRODUITS],
      ['GET', '/api/admin/actualites/', page([ACTUALITE])],
      ['PATCH', '/api/admin/actualites/1/', (u, o) => ({ ...ACTUALITE, ...JSON.parse(o.body) })],
    ]);
    rendre('/actualites');
    const u = userEvent.setup();
    const table = await screen.findByRole('table', { name: 'Liste des actualités' });
    expect(within(table).getByText('Programmée')).toBeInTheDocument();
    expect(appels(simule, 'GET', '/api/admin/actualites/?taille=100').length).toBeGreaterThan(0);
    await u.click(within(table).getByRole('button', { name: 'Nouveau YD-518' }));
    const tiroir = screen.getByRole('dialog', { name: "Modifier l'actualité" });
    await waitFor(() => expect(within(tiroir).getByLabelText(/^Produit lié/)).toHaveValue('3'));
    expect(within(tiroir).getByRole('img', { name: 'Aperçu' })).toHaveAttribute('src', ACTUALITE.image);
    expect(within(tiroir).getByRole('button', { name: 'Programmer' })).toBeInTheDocument();

    await u.click(within(tiroir).getByRole('button', { name: "Retirer l'image" }));
    await u.click(within(tiroir).getByRole('button', { name: 'Programmer' }));
    await waitFor(() => expect(appels(simule, 'PATCH', '/actualites/1/')).toHaveLength(1));
    const options = appels(simule, 'PATCH', '/actualites/1/')[0][1];
    expect(options.body).not.toBeInstanceOf(FormData);
    const corps = JSON.parse(options.body);
    expect(corps).toMatchObject({ image: null, produit: 3, publie: true });
    expect(new Date(corps.publie_le).getTime()).toBe(new Date(ACTUALITE.publie_le).getTime());
    expect(corps.publie_le).toMatch(/Z$/);
  });

  it('création sans date : publie_le omis (le serveur publie maintenant) ; avec image : multipart', async () => {
    const simule = simulerApi([
      ['GET', '/catalogue/produits/', PRODUITS],
      ['GET', '/api/admin/actualites/', page([])],
      ['POST', '/api/admin/actualites/', { ...ACTUALITE, id: 2, titre: 'Salon', programmee: false, publie_le: '2026-10-16T11:00:00+01:00' }],
    ]);
    rendre('/actualites');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Nouvelle actualité' }));
    const tiroir = screen.getByRole('dialog', { name: 'Nouvelle actualité' });
    await u.type(within(tiroir).getByLabelText(/^Titre/), 'Salon');
    await u.upload(within(tiroir).getByLabelText(/^Image/), new File(['x'], 'salon.jpg', { type: 'image/jpeg' }));
    await u.click(within(tiroir).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(appels(simule, 'POST', '/api/admin/actualites/')).toHaveLength(1));
    const fd = appels(simule, 'POST', '/api/admin/actualites/')[0][1].body;
    expect(fd).toBeInstanceOf(FormData);
    expect(fd.has('publie_le')).toBe(false);
    expect(fd.get('produit')).toBe(''); // null → '' (lu comme null par DRF)
    expect(fd.get('image').name).toBe('salon.jpg');
    expect(fd.get('traductions')).toBe('{}');
    expect(await screen.findByText("L'actualité « Salon » a été enregistrée.", { selector: 'p:not([role])' })).toBeInTheDocument();
  });
});
