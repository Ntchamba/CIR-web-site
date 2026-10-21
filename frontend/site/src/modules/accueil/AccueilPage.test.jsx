// Tests de l'accueil : contenus de l'équipe (une seule requête), textes par défaut, bandeaux, sphère,
// vidéo de fond (image seule si mouvement réduit), sections à la une, actualités, réalisations, coordonnées.
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import App from '@/app/App.jsx';
import { appels, page, parametresDes, reponse, simulerApi, simulerMouvementReduit } from '@/test/outils.jsx';

const CONTENU = {
  titre: 'Révélation',
  accroche: 'Là où naissent les sols durables.',
  video_fond: 'https://api.test/media/fond.mp4',
  image_affiche: { url: 'https://api.test/media/affiche.webp', alt: '' },
  texte_partenaire: 'Texte partenaire saisi par l’équipe.',
  coordonnees: { telephones: ['+237 600 000 001'], whatsapp: '+237 600 000 002', email: 'contact@exemple.cm', adresse: 'Adresse de test' },
  bandeaux: [{ id: 1, texte: 'Nouvelle gamme disponible', lien: '/catalogue' }, { id: 2, texte: 'Lien externe', lien: 'https://exemple.com' }],
  sphere: [1, 2, 3, 4, 5].map((id) => ({
    id, image: { url: `https://api.test/media/s${id}.webp`, alt: `Photo ${id}` },
    produit: id === 1 ? { slug: 'yd-500', nom: 'Sol autolissant' } : null,
  })),
};

const VIDE = {
  titre: '', accroche: '', video_fond: null, image_affiche: null, texte_partenaire: '',
  coordonnees: { telephones: [], whatsapp: '', email: '', adresse: '' }, bandeaux: [], sphere: [],
};

function rendre() {
  return render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
}

function api(contenu, { produits = [], actualites = [], realisations = [], temoignages = [] } = {}) {
  return simulerApi({
    'GET /api/contenus/accueil/': reponse(200, contenu),
    'GET /api/catalogue/produits/': reponse(200, page(produits)),
    'GET /api/actualites/': reponse(200, page(actualites)),
    'GET /api/vitrine/realisations/': reponse(200, page(realisations)),
    'GET /api/vitrine/temoignages/': reponse(200, page(temoignages)),
  });
}

beforeEach(() => {
  // jsdom ne lit pas les vidéos : play() simulé
  window.HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
});

describe('AccueilPage', () => {
  it('contenus de l’équipe : titre, accroche, bandeaux (liens internes seulement), sphère, vidéo', async () => {
    const fetch = api(CONTENU);
    rendre();
    expect(await screen.findByRole('heading', { level: 1, name: 'Révélation' })).toBeInTheDocument();
    expect(screen.getByText('Là où naissent les sols durables.')).toBeInTheDocument();

    const bandeaux = screen.getByRole('complementary', { name: 'Annonces' });
    expect(within(bandeaux).getByRole('link', { name: 'Nouvelle gamme disponible' })).toHaveAttribute('href', '/catalogue');
    expect(within(bandeaux).queryByRole('link', { name: 'Lien externe' })).toBeNull();

    const sphere = screen.getByRole('group', { name: 'Photos de sols en résine époxy' });
    expect(within(sphere).getByRole('link', { name: 'Voir le produit Sol autolissant' })).toHaveAttribute('href', '/catalogue/yd-500');
    expect(within(sphere).getByRole('link', { name: 'Photo 2 : voir le catalogue' })).toHaveAttribute('href', '/catalogue');

    const video = screen.getByTestId('video-fond');
    expect(video).toHaveAttribute('src', CONTENU.video_fond);
    expect(video).not.toHaveAttribute('loop');
    expect(video.muted).toBe(true);

    // Une seule requête de contenus pour l'en-tête, le pied de page et l'accueil
    await waitFor(() => expect(appels(fetch, 'GET', '/api/contenus/accueil/')).toHaveLength(1));
  });

  it('coordonnées de l’en-tête et du pied de page venant des contenus', async () => {
    api(CONTENU);
    rendre();
    const pied = screen.getByRole('contentinfo');
    expect(await within(pied).findByText(/Téléphone : \+237 600 000 001/)).toBeInTheDocument();
    expect(within(pied).getByText(/WhatsApp : \+237 600 000 002/)).toBeInTheDocument();
    expect(within(pied).getByRole('link', { name: 'E-mail : contact@exemple.cm' })).toHaveAttribute('href', 'mailto:contact@exemple.cm');
    expect(within(pied).getByText(/Adresse de test, Cameroun/)).toBeInTheDocument();
    // Section Contact de la maquette : numéros cliquables, bouton WhatsApp
    const contact = screen.getByRole('heading', { name: 'Parlons de votre sol' }).closest('section');
    expect(within(contact).getByRole('link', { name: '+237 600 000 001' })).toHaveAttribute('href', 'tel:+237600000001');
    expect(within(contact).getByRole('link', { name: 'Écrire sur WhatsApp' })).toHaveAttribute('href', 'https://wa.me/237600000002');
    expect(within(contact).getByText('Adresse de test')).toBeInTheDocument();
    // Téléphone : l'icône du combiné mène à Contact (maquette)
    expect(within(screen.getByRole('banner')).getAllByRole('link', { name: 'Contact' })).toHaveLength(2);
  });

  it('contenus vides ou API injoignable : textes par défaut traduits et coordonnées de secours', async () => {
    api(VIDE);
    rendre();
    expect(await screen.findByRole('heading', { level: 1, name: 'Révélation.' })).toBeInTheDocument();
    expect(screen.getByText("Là où naissent les sols durables : la résine époxy pour la maison, l'industrie et l'entreprise.")).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Annonces' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Photos de sols en résine époxy' })).toBeNull();
    expect(screen.queryByTestId('video-fond')).toBeNull();
    const pied = screen.getByRole('contentinfo');
    expect(within(pied).getByText(/Téléphone : \+237 6 99 81 16 35 · \+237 6 78 82 93 13 · \+237 6 56 43 58 46/)).toBeInTheDocument();
    expect(within(pied).getByText(/WhatsApp : \+237 622 191 931/)).toBeInTheDocument();
    expect(within(pied).getByText(/Total Nkolmbong, Douala, Cameroun/)).toBeInTheDocument();
    // Pas de section sans données (aucun produit, chantier ni actualité inventé)
    expect(screen.queryByRole('heading', { name: 'Produits à la une' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Nos réalisations' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Témoignages' })).toBeNull();
  });

  it('mouvement réduit : affiche au lieu de la vidéo, sphère immobile', async () => {
    simulerMouvementReduit();
    api(CONTENU);
    rendre();
    await screen.findByRole('heading', { level: 1, name: 'Révélation' });
    expect(screen.queryByTestId('video-fond')).toBeNull();
    expect(screen.getByTestId('affiche-fond')).toHaveAttribute('src', CONTENU.image_affiche.url);
    const sphere = screen.getByRole('group', { name: 'Photos de sols en résine époxy' }); // sphère immobile, même géométrie
    expect(sphere.querySelector('img')).toHaveAttribute('loading', 'lazy');
  });

  it('sections à la une, actualités (3 dernières) et réalisations', async () => {
    const fetch = api(VIDE, {
      produits: [{ id: 1, slug: 'yd-500', reference: 'YD-500', nom: 'Sol autolissant', accroche: '', famille: { slug: 'f', nom: 'Famille' }, usages: [], prix: null, unite_prix: 'm2', image: null, est_nouveau: false, a_la_une: true }],
      actualites: [{ id: 1, slug: 'a', titre: 'Une actualité', resume: '', texte: '', image: null, produit: null, publie_le: '2026-10-01T08:00:00Z' }],
      realisations: [{ id: 1, slug: 'r', titre: 'Un chantier', type_chantier: 'industrie', ville: 'Douala', description: '', image_avant: null, image_apres: { url: 'https://api.test/media/r.webp', alt: '' }, date: null, produits: [] }],
    });
    rendre();
    expect(await screen.findByRole('heading', { name: 'Produits à la une' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Sol autolissant/ })).toHaveAttribute('href', '/catalogue/yd-500');
    expect(screen.getByText('Prix sur devis')).toBeInTheDocument(); // jamais de prix inventé
    expect(await screen.findByRole('link', { name: 'Une actualité' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Un chantier' })).toBeInTheDocument();
    expect(screen.getByText('Industrie · Douala')).toBeInTheDocument();
    expect(Object.fromEntries(parametresDes(fetch, '/api/catalogue/produits/')[0])).toEqual({ a_la_une: '1', taille: '4' });
    expect(parametresDes(fetch, '/api/actualites/')[0].get('taille')).toBe('3');
    expect(parametresDes(fetch, '/api/vitrine/realisations/')[0].get('taille')).toBe('3');
  });
});

describe('maquette : avant / après et témoignages', () => {
  it('« Avant, après » : béton brut (affiche de la vidéo) et salon (dernière image), masqués sans affiche', async () => {
    api(CONTENU, { realisations: [] });
    rendre();
    expect(await screen.findByRole('heading', { name: 'Nos réalisations' })).toBeInTheDocument();
    expect(screen.getByText('Avant : béton brut')).toBeInTheDocument();
    expect(screen.getByText('Après : résine époxy')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /dalle de béton brut fissurée/ })).toHaveAttribute('src', CONTENU.image_affiche.url);
  });

  it('sans affiche ni chantier : aucune section « Nos réalisations » (rien d’inventé)', async () => {
    api({ ...CONTENU, image_affiche: null });
    rendre();
    await screen.findByRole('heading', { level: 1, name: 'Révélation' });
    expect(screen.queryByRole('heading', { name: 'Nos réalisations' })).toBeNull();
  });

  it('témoignages publiés : deux au plus, nom · type · ville ; aucun s’il n’y en a pas', async () => {
    api(VIDE, { temoignages: [
      { id: 1, nom_affiche: 'Awa N.', ville: 'Douala', type_chantier: 'maison', texte: 'Très satisfaite.', note: 5, langue: 'fr', date: '2026-09-01' },
      { id: 2, nom_affiche: 'Paul K.', ville: '', type_chantier: 'industrie', texte: 'Sol impeccable.', note: 4, langue: 'fr', date: '2026-09-02' },
      { id: 3, nom_affiche: 'Troisième', ville: '', type_chantier: '', texte: 'Pas affiché.', note: 3, langue: 'fr', date: '2026-09-03' },
    ] });
    rendre();
    expect(await screen.findByRole('heading', { name: 'Témoignages' })).toBeInTheDocument();
    expect(screen.getByText(/Très satisfaite\./)).toBeInTheDocument();
    expect(screen.getByText('Awa N. · Maison · Douala')).toBeInTheDocument();
    expect(screen.getByText('Paul K. · Industrie')).toBeInTheDocument();
    expect(screen.queryByText(/Pas affiché/)).toBeNull();
  });
});
