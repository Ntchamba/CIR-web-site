// Tests de la fiche produit : galerie, designs, contact WhatsApp, fiche technique, plan de coupe, 404, langue.
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { changerLangue } from '@/i18n/index.js';
import { appels, reponse, rendreAvecRoutes, simulerApi } from '@/test/outils.jsx';

import ProduitPage from './ProduitPage.jsx';

const PRODUIT = {
  id: 1,
  slug: 'yd-500',
  reference: 'YD-500',
  nom: 'Sol autolissant',
  accroche: 'Un sol lisse et continu.',
  famille: { slug: 'sols-autolissants', nom: 'Sols autolissants' },
  usages: ['maison'],
  prix: null,
  unite_prix: 'm2',
  image: { url: 'https://api.test/media/a.webp', alt: 'Vue A' },
  est_nouveau: true,
  a_la_une: true,
  description: 'Premier paragraphe.\n\nSecond paragraphe.',
  domaine_application: 'Habitat.',
  performances: '',
  mise_en_oeuvre: { preparation: 'Poncer le support.', methode_application: '', dosage: 'A:B = 5:1', conditions_chantier: '' },
  images: [{ url: 'https://api.test/media/a.webp', alt: 'Vue A' }, { url: 'https://api.test/media/b.webp', alt: 'Vue B' }],
  designs: [
    { id: 10, nom: 'Gris perle', image: null, couleur: '#C0C4C8' },
    { id: 11, nom: 'Bleu', image: { url: 'https://api.test/media/d.webp', alt: '' }, couleur: '' },
  ],
  caracteristiques: [{ libelle: 'Dureté', valeur: '2H' }],
  couches: [{ nom: 'Finition', epaisseur: '0,5 mm' }, { nom: 'Primaire', epaisseur: '' }],
};

const rendre = (slug = 'yd-500') => rendreAvecRoutes(`/catalogue/${slug}`, {
  '/catalogue/:slug': <ProduitPage />,
  '/catalogue': <p>Catalogue</p>,
});

describe('ProduitPage', () => {
  it('affiche la fiche : titre, prix sur devis, galerie, fiche technique, plan de coupe accessible', async () => {
    simulerApi({ 'GET /api/catalogue/produits/yd-500/': reponse(200, PRODUIT) });
    rendre();
    expect(await screen.findByRole('heading', { level: 1, name: 'Sol autolissant' })).toBeInTheDocument();
    expect(screen.getByText('Prix sur devis')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sols autolissants' })).toHaveAttribute('href', '/catalogue?famille=sols-autolissants');

    // Galerie : la vignette 2 remplace la grande image
    expect(screen.getByRole('img', { name: 'Vue A' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Voir la photo 2 sur 2' }));
    expect(screen.getByRole('img', { name: 'Vue B' })).toBeInTheDocument();

    // Fiche technique : rubriques renseignées seulement
    expect(screen.getByRole('heading', { level: 3, name: 'Présentation' })).toBeInTheDocument();
    expect(screen.getByText('Second paragraphe.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Performances' })).toBeNull();
    expect(screen.getByText('Préparation du support')).toBeInTheDocument();
    expect(screen.queryByText("Méthode d'application")).toBeNull();
    const tableau = screen.getByRole('table', { name: 'Indicateurs techniques' });
    expect(within(tableau).getByRole('rowheader', { name: 'Dureté' })).toBeInTheDocument();

    // Plan de coupe : liste ordonnée, de la surface au support
    const coupe = screen.getByRole('region', { name: 'Plan de coupe' });
    const couches = within(coupe).getAllByRole('listitem');
    expect(within(coupe).getByRole('list').tagName).toBe('OL');
    expect(couches.map((li) => li.textContent)).toEqual(['FinitionSurface0,5 mmÉpaisseur : 0,5 mm', 'Primaire', 'Support']);
  });

  it('designs : choix au clavier, message WhatsApp prérempli avec le produit et le design', async () => {
    simulerApi({ 'GET /api/catalogue/produits/yd-500/': reponse(200, PRODUIT) });
    rendre();
    await screen.findByRole('heading', { level: 1 });
    const whatsapp = () => screen.getByRole('link', { name: 'Écrire sur WhatsApp' });
    expect(decodeURIComponent(whatsapp().getAttribute('href'))).toContain('produit YD-500 Sol autolissant.');
    await userEvent.click(screen.getByRole('radio', { name: 'Gris perle' }));
    expect(screen.getByRole('radio', { name: 'Gris perle' })).toBeChecked();
    expect(screen.getByText('Design choisi : Gris perle')).toBeInTheDocument();
    expect(decodeURIComponent(whatsapp().getAttribute('href'))).toContain('design « Gris perle »');
    expect(whatsapp().getAttribute('href')).toMatch(/^https:\/\/wa\.me\/237622191931\?text=/);
    expect(screen.getByRole('link', { name: 'Appeler le CIR' })).toHaveAttribute('href', 'tel:+237699811635');
  });

  it('produit hors ligne (404) : message « introuvable » et retour au catalogue', async () => {
    simulerApi();
    rendre('inconnu');
    expect(await screen.findByRole('heading', { level: 1, name: 'Produit introuvable' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Retour au catalogue' })).toHaveAttribute('href', '/catalogue');
  });

  it('changement de langue : la fiche est redemandée dans la nouvelle langue', async () => {
    const fetch = simulerApi({
      'GET /api/catalogue/produits/yd-500/': (corps, init) => reponse(200, {
        ...PRODUIT, nom: init.headers['Accept-Language'] === 'en' ? 'Self-levelling floor' : 'Sol autolissant',
      }),
    });
    rendre();
    await screen.findByRole('heading', { level: 1, name: 'Sol autolissant' });
    await changerLangue('en');
    expect(await screen.findByRole('heading', { level: 1, name: 'Self-levelling floor' })).toBeInTheDocument();
    expect(screen.getByText('Price on quotation')).toBeInTheDocument();
    const langues = appels(fetch, 'GET', '/api/catalogue/produits/yd-500/').map(([, init]) => init.headers['Accept-Language']);
    expect(langues).toEqual(['fr', 'en']);
  });
});
