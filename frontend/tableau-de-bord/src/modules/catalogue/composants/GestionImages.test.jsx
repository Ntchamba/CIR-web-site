// Photos d'un produit (testeur) : routes réelles du back-end (/api/admin/catalogue/produits/<id>/images/,
// /api/admin/catalogue/images/<id>/), envoi multipart, ordre conforme au tri du serveur (ordre, id),
// suppression confirmée, erreur 400 sous le champ.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { appels, reponse, simulerApi } from '@/test/api-simulee.jsx';

import GestionImages from './GestionImages.jsx';

// Forme réelle renvoyée par ImageProduitAdminSerializer (vérifiée sur le back-end).
const image = (id, ordre, alt = '') => ({
  id, url: `http://testserver/media/catalogue/produits/${id}.webp`, alt, ordre, traductions: {}, langues_incompletes: [],
});

/** Serveur simulé qui garde l'état des photos et les trie comme Django : (ordre, id). */
function serveurImages(initiales) {
  const etat = new Map(initiales.map((i) => [i.id, { ...i }]));
  const simule = simulerApi([
    ['PATCH', /\/api\/admin\/catalogue\/images\/\d+\/$/, (u, o) => {
      const id = Number(u.match(/images\/(\d+)\//)[1]);
      Object.assign(etat.get(id), JSON.parse(o.body));
      return reponse(200, etat.get(id));
    }],
    ['DELETE', /\/api\/admin\/catalogue\/images\/\d+\/$/, (u) => {
      etat.delete(Number(u.match(/images\/(\d+)\//)[1]));
      return reponse(204, null);
    }],
  ]);
  const ordreServeur = () => [...etat.values()].sort((a, b) => a.ordre - b.ordre || a.id - b.id).map((i) => i.id);
  return { simule, ordreServeur };
}

function Gestion({ initiales }) {
  const [images, setImages] = useState(initiales);
  return (
    <>
      <GestionImages produitId={10} images={images} surChangement={setImages} />
      <output data-testid="ordre-affiche">{[...images].sort((a, b) => a.ordre - b.ordre).map((i) => i.id).join(',')}</output>
    </>
  );
}

beforeEach(() => {
  localStorage.setItem('cir-tdb.jetons', JSON.stringify({ acces: 'a', rafraichissement: 'r' }));
});

describe('GestionImages', () => {
  it('ajoute une photo en multipart sur produits/<id>/images/ (traductions en chaîne JSON)', async () => {
    const simule = simulerApi([['POST', '/api/admin/catalogue/produits/10/images/', image(5, 0, 'Sol gris')]]);
    const u = userEvent.setup();
    render(<Gestion initiales={[]} />);
    await u.click(screen.getByRole('button', { name: 'Envoyer la photo' }));
    expect(screen.getByLabelText(/^Photo/)).toHaveAccessibleDescription(/Choisissez une photo\./);
    expect(appels(simule, 'POST', '/images/')).toHaveLength(0);

    await u.upload(screen.getByLabelText(/^Photo/), new File(['x'], 'sol.png', { type: 'image/png' }));
    await u.type(screen.getByLabelText('Description de la photo'), 'Sol gris');
    await u.click(screen.getByRole('tab', { name: /English/ }));
    await u.type(screen.getByLabelText('Description de la photo (English)'), 'Grey floor');
    await u.click(screen.getByRole('button', { name: 'Envoyer la photo' }));

    await waitFor(() => expect(appels(simule, 'POST', '/produits/10/images/')).toHaveLength(1));
    const corps = appels(simule, 'POST', '/produits/10/images/')[0][1].body;
    expect(corps).toBeInstanceOf(FormData);
    expect(corps.get('image').name).toBe('sol.png');
    expect(corps.get('alt')).toBe('Sol gris');
    expect(JSON.parse(corps.get('traductions'))).toEqual({ en: { alt: 'Grey floor' } });
    expect(await screen.findByText('Vignette')).toBeInTheDocument();
  });

  it("affiche sous le champ l'erreur 400 du serveur (ImageInvalide)", async () => {
    simulerApi([['POST', '/produits/10/images/', () => reponse(400, { image: ['Image trop lourde (10 Mo au plus).'] })]]);
    const u = userEvent.setup();
    render(<Gestion initiales={[]} />);
    await u.upload(screen.getByLabelText(/^Photo/), new File(['x'], 'sol.png', { type: 'image/png' }));
    await u.click(screen.getByRole('button', { name: 'Envoyer la photo' }));
    await waitFor(() => expect(screen.getByLabelText(/^Photo/)).toHaveAccessibleDescription(/Image trop lourde/));
  });

  it('échange deux photos par PATCH { ordre } sur images/<id>/', async () => {
    const { simule, ordreServeur } = serveurImages([image(1, 0, 'A'), image(2, 1, 'B'), image(3, 2, 'C')]);
    render(<Gestion initiales={[image(1, 0, 'A'), image(2, 1, 'B'), image(3, 2, 'C')]} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Monter C' }));
    await waitFor(() => expect(screen.getByTestId('ordre-affiche')).toHaveTextContent('1,3,2'));
    expect(appels(simule, 'PATCH', '/api/admin/catalogue/images/').map(([, o]) => JSON.parse(o.body)))
      .toEqual(expect.arrayContaining([{ ordre: 1 }, { ordre: 2 }]));
    expect(ordreServeur()).toEqual([1, 3, 2]);
  });

  // Le back-end ne renumérote pas les photos après une suppression (ordre = max + 1 à l'ajout) :
  // des ordres 5, 6, 7 sont donc possibles. L'ordre enregistré doit rester celui affiché.
  it("garde sur le serveur l'ordre affiché quand les ordres ne commencent pas à 0", async () => {
    const initiales = [image(1, 5, 'A'), image(2, 6, 'B'), image(3, 7, 'C')];
    const { ordreServeur } = serveurImages(initiales);
    render(<Gestion initiales={initiales} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Descendre B' }));
    await waitFor(() => expect(screen.getByTestId('ordre-affiche')).toHaveTextContent('1,3,2'));
    expect(ordreServeur()).toEqual([1, 3, 2]);
  });

  it('supprime une photo après confirmation (DELETE images/<id>/)', async () => {
    const { simule } = serveurImages([image(1, 0, 'A'), image(2, 1, 'B')]);
    const u = userEvent.setup();
    render(<Gestion initiales={[image(1, 0, 'A'), image(2, 1, 'B')]} />);
    await u.click(screen.getByRole('button', { name: 'Supprimer A' }));
    expect(appels(simule, 'DELETE', '/images/')).toHaveLength(0);
    await u.click(within(screen.getByRole('group', { name: 'Confirmer la suppression de A' }))
      .getByRole('button', { name: 'Confirmer la suppression' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Supprimer A' })).toBeNull());
    expect(appels(simule, 'DELETE', '/api/admin/catalogue/images/1/')).toHaveLength(1);
    expect(screen.getByText('Vignette')).toBeInTheDocument(); // B devient la vignette
  });

  it('modifie le texte alternatif par PATCH JSON { alt, traductions }', async () => {
    const { simule } = serveurImages([image(1, 0, 'A')]);
    const u = userEvent.setup();
    render(<Gestion initiales={[image(1, 0, 'A')]} />);
    await u.click(screen.getByRole('button', { name: 'Modifier A' }));
    const champs = screen.getAllByLabelText('Description de la photo');
    await u.clear(champs[0]);
    await u.type(champs[0], 'Sol bleu');
    await u.click(screen.getAllByRole('button', { name: 'Enregistrer' })[0]);
    await waitFor(() => expect(appels(simule, 'PATCH', '/images/1/')).toHaveLength(1));
    expect(JSON.parse(appels(simule, 'PATCH', '/images/1/')[0][1].body)).toEqual({ alt: 'Sol bleu', traductions: {} });
    expect(await screen.findByText('Sol bleu')).toBeInTheDocument();
  });
});
