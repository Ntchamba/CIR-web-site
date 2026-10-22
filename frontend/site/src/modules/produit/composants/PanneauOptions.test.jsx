// Tests (site-testeur) de la fiche produit : galerie au clavier, designs (flèches), WhatsApp et appel avec les
// coordonnées de l'équipe, prix fixé, rubriques vides masquées, changement de produit, requêtes sans jeton.
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router';

import { AuthProvider } from '@/modules/compte/AuthContext.jsx';
import { appels, connecterLocalement, reponse, rendreAvecRoutes, simulerApi, UTILISATEUR } from '@/test/outils.jsx';

import ProduitPage from '../ProduitPage.jsx';
import FicheTechnique from './FicheTechnique.jsx';
import PlanCoupe from './PlanCoupe.jsx';

const BASE = {
  id: 1, slug: 'yd-306', reference: 'YD-306', nom: 'Sable coloré', accroche: '', famille: { slug: 'f', nom: 'Famille' },
  usages: [], prix: '8000', unite_prix: 'kg', image: null, est_nouveau: false, a_la_une: false,
  description: '', domaine_application: '', performances: '',
  mise_en_oeuvre: { preparation: '', methode_application: '', dosage: '', conditions_chantier: '' },
  images: [
    { url: 'https://api.test/media/1.webp', alt: 'Vue 1' },
    { url: 'https://api.test/media/2.webp', alt: '' },
  ],
  designs: [
    { id: 1, nom: 'Gris', image: null, couleur: '#888888' },
    { id: 2, nom: 'Rouge & or', image: null, couleur: '#AA0000' },
  ],
  caracteristiques: [], couches: [],
};

const rendre = (slug = 'yd-306') => rendreAvecRoutes(`/catalogue/${slug}`, { '/catalogue/:slug': <ProduitPage /> });

describe('ProduitPage (compléments)', () => {
  it('prix fixé mis en forme avec son unité ; rubriques vides non affichées', async () => {
    simulerApi({ 'GET /api/catalogue/produits/yd-306/': reponse(200, BASE) });
    rendre();
    expect(await screen.findByText(/8\s000 FCFA \/ kg/)).toBeInTheDocument();
    expect(screen.queryByText('Prix sur devis')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Fiche technique' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Plan de coupe' })).toBeNull();
  });

  it('galerie : vignettes en boutons, image choisie annoncée (aria-pressed), alt de secours = nom', async () => {
    simulerApi({ 'GET /api/catalogue/produits/yd-306/': reponse(200, BASE) });
    rendre();
    const u = userEvent.setup();
    const vignettes = within(await screen.findByRole('list', { name: /./ , hidden: false }));
    const boutons = vignettes.getAllByRole('button');
    expect(boutons).toHaveLength(2);
    expect(boutons[0]).toHaveAttribute('aria-pressed', 'true');
    boutons[1].focus();
    await u.keyboard('{Enter}');
    expect(boutons[1]).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('img', { name: 'Sable coloré' })).toHaveAttribute('src', 'https://api.test/media/2.webp');
  });

  it('couleur : liste des designs du panneau, message WhatsApp encodé, coordonnées venant des contenus', async () => {
    simulerApi({
      'GET /api/catalogue/produits/yd-306/': reponse(200, BASE),
      'GET /api/contenus/accueil/': reponse(200, { coordonnees: { telephones: ['+237 611 111 111'], whatsapp: '+237 622 222 222', email: '', adresse: '' } }),
    });
    rendre();
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: /Commander ou personnaliser/ }));
    const couleur = screen.getByLabelText('Couleur');
    expect(within(couleur).getAllByRole('option').map((o) => o.textContent)).toEqual(['Choisir', 'Gris', 'Rouge & or']);
    await u.selectOptions(couleur, '2');
    const whatsapp = screen.getByRole('link', { name: /WhatsApp/ });
    await waitFor(() => expect(whatsapp.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/237622222222\?text=/));
    const texte = decodeURIComponent(whatsapp.getAttribute('href').split('?text=')[1]);
    expect(texte).toContain('YD-306 Sable coloré');
    expect(texte).toContain('Rouge & or');
    expect(whatsapp).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('link', { name: /Appeler/ })).toHaveAttribute('href', 'tel:+237611111111');
  });

  it('focus : l\'ouverture place le focus dans le panneau, Tab y reste (Maj+Tab depuis le premier va au dernier)', async () => {
    simulerApi({ 'GET /api/catalogue/produits/yd-306/': reponse(200, BASE) });
    rendre();
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: /Commander ou personnaliser/ }));
    const panneau = screen.getByRole('dialog');
    expect(panneau).toContainElement(document.activeElement);
    await u.keyboard('{Shift>}{Tab}{/Shift}');
    expect(panneau).toContainElement(document.activeElement);
    expect(document.activeElement).not.toBe(screen.getByRole('button', { name: 'Fermer' }));
  });

  it('client connecté : fiche demandée sans jeton', async () => {
    connecterLocalement();
    const fetch = simulerApi({
      'GET /api/comptes/moi/': reponse(200, UTILISATEUR),
      'GET /api/catalogue/produits/yd-306/': reponse(200, BASE),
    });
    rendre();
    await screen.findByRole('heading', { level: 1, name: 'Sable coloré' });
    appels(fetch, 'GET', '/api/catalogue/produits/yd-306/').forEach(([, init]) => expect(init.headers.Authorization).toBeUndefined());
  });

  it('slug avec caractères spéciaux encodé dans l’adresse de l’API', async () => {
    const fetch = simulerApi();
    rendre('a%2Fb');
    await screen.findByRole('heading', { level: 1, name: 'Produit introuvable' });
    expect(fetch.mock.calls.some(([url]) => String(url).includes('/api/catalogue/produits/a%2Fb/'))).toBe(true);
  });

  it('erreur réseau (pas 404) : message et « Réessayer », pas « introuvable »', async () => {
    let echec = true;
    simulerApi({
      'GET /api/catalogue/produits/yd-306/': () => {
        if (echec) {
          echec = false;
          return reponse(500, null);
        }
        return reponse(200, BASE);
      },
    });
    rendre();
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Réessayer' }));
    expect(screen.queryByText('Produit introuvable')).toBeNull();
    expect(await screen.findByRole('heading', { level: 1, name: 'Sable coloré' })).toBeInTheDocument();
  });

  it('passage d’un produit à un autre : l’ancien produit n’est plus affiché sous la nouvelle adresse', async () => {
    let finirB;
    simulerApi({
      'GET /api/catalogue/produits/yd-306/': reponse(200, BASE),
      'GET /api/catalogue/produits/yd-500/': () => new Promise((ok) => {
        finirB = () => ok(reponse(200, { ...BASE, id: 2, slug: 'yd-500', reference: 'YD-500', nom: 'Sol autolissant' }));
      }),
    });
    render(
      <MemoryRouter initialEntries={['/catalogue/yd-306']}>
        <AuthProvider>
          <Routes><Route path="/catalogue/:slug" element={<><ProduitPage /><Link to="/catalogue/yd-500">Suivant</Link></>} /></Routes>
        </AuthProvider>
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { level: 1, name: 'Sable coloré' });
    await userEvent.click(screen.getByRole('link', { name: 'Suivant' }));
    await waitFor(() => expect(finirB).toBeDefined());
    expect(screen.queryByRole('heading', { level: 1, name: 'Sable coloré' })).toBeNull();
    await act(async () => finirB());
    expect(await screen.findByRole('heading', { level: 1, name: 'Sol autolissant' })).toBeInTheDocument();
  });
});

describe('FicheTechnique et PlanCoupe', () => {
  it('fiche : seules les rubriques renseignées, tableau avec en-têtes de lignes et de colonnes', () => {
    render(<FicheTechnique produit={{
      ...BASE, performances: 'Très résistant.',
      mise_en_oeuvre: { preparation: '', methode_application: 'Rouleau.', dosage: '', conditions_chantier: '' },
      caracteristiques: [{ libelle: 'Dureté', valeur: '2H' }, { libelle: 'Dureté', valeur: '3H' }],
    }} />);
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toHaveLength(2);
    expect(screen.getAllByRole('rowheader')).toHaveLength(2);
    expect(screen.getAllByRole('columnheader')).toHaveLength(2);
    expect(screen.getByRole('table')).toHaveAccessibleName();
  });

  it('plan de coupe : liste ordonnée de la surface au support, épaisseur lue par les lecteurs d’écran', () => {
    render(<PlanCoupe couches={[{ nom: 'Finition', epaisseur: '0,3 mm' }, { nom: 'Primaire', epaisseur: '' }]} />);
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items).toHaveLength(3); // deux couches + support
    expect(screen.getByRole('list').tagName).toBe('OL');
    expect(items[0]).toHaveTextContent('Finition');
    expect(items[2]).toHaveTextContent('Support');
  });

  it('plan de coupe sans couche : rien (aucune couche inventée)', () => {
    const { container } = render(<PlanCoupe couches={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
