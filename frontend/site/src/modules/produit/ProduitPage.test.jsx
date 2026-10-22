// Tests de la fiche produit : galerie, designs, contact WhatsApp, fiche technique, plan de coupe, 404, langue.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { changerLangue } from '@/i18n/index.js';
import { appels, emplacement, page, reponse, rendreAvecRoutes, simulerApi } from '@/test/outils.jsx';

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
  it('maquette : « ← Catalogue », famille · produit du moment, titre, « Réf. … · accroche », prix, description, grand carré', async () => {
    simulerApi({ 'GET /api/catalogue/produits/yd-500/': reponse(200, PRODUIT) });
    const { container } = rendre();
    expect(await screen.findByRole('heading', { level: 1, name: 'Sol autolissant' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Catalogue/ })).toHaveAttribute('href', '/catalogue');
    expect(screen.getByText('Sols autolissants · Produit du moment')).toBeInTheDocument();
    expect(screen.getByText('Réf. YD-500 · Un sol lisse et continu.')).toBeInTheDocument();
    expect(screen.getByText('Prix sur devis')).toBeInTheDocument(); // jamais de prix inventé
    expect(container.querySelector('.desc')).toHaveTextContent('Premier paragraphe.'); // première ligne de la description
    // Le produit au premier plan : grande image carrée nommée pour le zoom depuis la vignette
    const grande = screen.getByRole('img', { name: 'Vue A' });
    expect(grande).toHaveClass('grand');
    expect(grande.style.viewTransitionName).toBe('produit-image');
    // Arrière-plan : la même image, agrandie et floutée (couche décorative)
    const fond = container.querySelector('.m-fiche-fond');
    expect(fond).toHaveAttribute('aria-hidden', 'true');
    expect(fond.querySelector('img')).toHaveAttribute('src', 'https://api.test/media/a.webp');
    expect(screen.getByRole('button', { name: /Commander ou personnaliser/ })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Sélectionner ce produit/ })).toHaveAttribute('href', expect.stringContaining('/connexion'));
  });

  it('produit sans « à la une » : pas de « produit du moment » ; sans image : carré neutre avec la référence', async () => {
    simulerApi({ 'GET /api/catalogue/produits/yd-500/': reponse(200, { ...PRODUIT, a_la_une: false, image: null, images: [] }) });
    const { container } = rendre();
    await screen.findByRole('heading', { level: 1, name: 'Sol autolissant' });
    expect(screen.getByText('Sols autolissants')).toBeInTheDocument();
    expect(screen.queryByText(/Produit du moment/)).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('img', { name: 'Sol autolissant' })).toHaveTextContent('YD-500');
  });

  it('galerie, fiche technique et plan de coupe restent disponibles sous la fiche', async () => {
    simulerApi({ 'GET /api/catalogue/produits/yd-500/': reponse(200, PRODUIT) });
    rendre();
    await screen.findByRole('heading', { level: 1, name: 'Sol autolissant' });
    // Galerie : la vignette 2 remplace le grand carré
    await userEvent.click(screen.getByRole('button', { name: 'Voir la photo 2 sur 2' }));
    expect(screen.getByRole('img', { name: 'Vue B' })).toHaveClass('grand');
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

  it('panneau « Commander ou personnaliser » : fermé au départ, ouvert par le bouton, fermé par Échap (focus rendu au bouton)', async () => {
    simulerApi({ 'GET /api/catalogue/produits/yd-500/': reponse(200, PRODUIT) });
    rendre();
    const u = userEvent.setup();
    const bouton = await screen.findByRole('button', { name: /Commander ou personnaliser/ });
    expect(screen.queryByRole('dialog')).toBeNull();
    await u.click(bouton);
    const panneau = screen.getByRole('dialog', { name: 'Sol autolissant' });
    expect(panneau).toHaveAttribute('aria-modal', 'true');
    expect(within(panneau).getByText('Prix indicatif, négociable avec l\'équipe')).toBeInTheDocument();
    [
      'Négocier le prix', 'Envoyer un message', 'Nous contacter sur WhatsApp', 'Appeler l\'équipe', 'Demander un rendu particulier',
      'Demander un devis', 'Visite du chantier', 'Fiche technique', 'Réalisations avec ce produit',
    ].forEach((nom) => expect(within(panneau).getByRole('link', { name: nom })).toBeInTheDocument());
    await u.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(bouton).toHaveFocus();
  });

  it('panneau : couleur (designs), WhatsApp prérempli avec le produit et la couleur, appel', async () => {
    simulerApi({ 'GET /api/catalogue/produits/yd-500/': reponse(200, PRODUIT) });
    rendre();
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: /Commander ou personnaliser/ }));
    const panneau = screen.getByRole('dialog');
    const whatsapp = () => within(panneau).getByRole('link', { name: 'Nous contacter sur WhatsApp' });
    expect(decodeURIComponent(whatsapp().getAttribute('href'))).toContain('produit YD-500 Sol autolissant.');
    await u.selectOptions(within(panneau).getByLabelText('Couleur'), '10');
    expect(decodeURIComponent(whatsapp().getAttribute('href'))).toContain('design « Gris perle »');
    expect(whatsapp().getAttribute('href')).toMatch(/^https:\/\/wa\.me\/237622191931\?text=/);
    expect(whatsapp()).toHaveAttribute('rel', 'noopener noreferrer');
    expect(within(panneau).getByRole('link', { name: 'Appeler l\'équipe' })).toHaveAttribute('href', 'tel:+237699811635');
  });

  it('panneau : « Lancer la commande » ouvre la commande avec produit, couleur, type et surface', async () => {
    simulerApi({ 'GET /api/catalogue/produits/yd-500/': reponse(200, PRODUIT) });
    rendreAvecRoutes('/catalogue/yd-500', { '/catalogue/:slug': <ProduitPage />, '/commandes/nouvelle': <p>Nouvelle commande</p> });
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: /Commander ou personnaliser/ }));
    const panneau = screen.getByRole('dialog');
    await u.selectOptions(within(panneau).getByLabelText('Couleur'), '10');
    await u.type(within(panneau).getByLabelText('Surface (m²)'), '45');
    await u.click(within(panneau).getByRole('button', { name: 'Industrie' }));
    expect(within(panneau).getByRole('button', { name: 'Industrie' })).toHaveAttribute('aria-pressed', 'true');
    await u.click(within(panneau).getByRole('button', { name: 'Lancer la commande' }));
    await waitFor(() => expect(emplacement()).toBe('/commandes/nouvelle?produit=yd-500&design=10&type=industrie&surface=45'));
  });

  it('« Préc. » et « Suiv. » : produits voisins du catalogue (rien en bout de liste)', async () => {
    const voisin = (id, slug, nom) => ({ ...PRODUIT, id, slug, nom, reference: `YD-${id}` });
    simulerApi({
      'GET /api/catalogue/produits/yd-500/': reponse(200, PRODUIT),
      'GET /api/catalogue/produits/': reponse(200, page([voisin(5, 'yd-400', 'Avant'), voisin(1, 'yd-500', 'Sol autolissant'), voisin(7, 'yd-600', 'Après')])),
    });
    rendre();
    const precedent = await screen.findByRole('link', { name: 'Produit précédent : Avant' });
    expect(precedent).toHaveAttribute('href', '/catalogue/yd-400');
    expect(precedent).toHaveTextContent('Préc.');
    const suivant = screen.getByRole('link', { name: 'Produit suivant : Après' });
    expect(suivant).toHaveAttribute('href', '/catalogue/yd-600');
    expect(suivant).toHaveTextContent('Suiv.');
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
