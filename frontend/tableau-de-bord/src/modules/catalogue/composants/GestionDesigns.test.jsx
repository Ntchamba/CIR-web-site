// Designs d'un produit (testeur) : JSON sans fichier, multipart avec image, routes réelles
// (produits/<id>/designs/, designs/<id>/), couleur #RRGGBB, image renvoyée en adresse (chaîne) par le serveur.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { appels, reponse, simulerApi } from '@/test/api-simulee.jsx';

import GestionDesigns, { validerDesign } from './GestionDesigns.jsx';

// Forme réelle renvoyée par DesignAdminSerializer : `image` est une adresse absolue ou null.
const design = (id, extra = {}) => ({
  id, nom: 'Gris béton', image: null, couleur: '#AABBCC', ordre: 0, traductions: {}, langues_incompletes: ['en'], ...extra,
});

function Gestion({ initiaux }) {
  const [designs, setDesigns] = useState(initiaux);
  return <GestionDesigns produitId={10} designs={designs} surChangement={setDesigns} />;
}

beforeEach(() => {
  localStorage.setItem('cir-tdb.jetons', JSON.stringify({ acces: 'a', rafraichissement: 'r' }));
});

describe('validerDesign', () => {
  it('exige un nom et une couleur au format #RRGGBB (comme le modèle Design)', () => {
    expect(validerDesign({ nom: ' ', couleur: '' })).toHaveProperty('nom');
    expect(validerDesign({ nom: 'Bleu', couleur: '#12345' })).toHaveProperty('couleur');
    expect(validerDesign({ nom: 'Bleu', couleur: 'bleu' })).toHaveProperty('couleur');
    expect(validerDesign({ nom: 'Bleu', couleur: '#1177a8' })).toEqual({});
    expect(validerDesign({ nom: 'Bleu', couleur: '' })).toEqual({});
  });
});

describe('GestionDesigns', () => {
  it('ajoute un design sans image en JSON sur produits/<id>/designs/', async () => {
    const simule = simulerApi([['POST', '/api/admin/catalogue/produits/10/designs/', design(3, { nom: 'Bleu', couleur: '#1177A8' })]]);
    const u = userEvent.setup();
    render(<Gestion initiaux={[]} />);
    await u.type(screen.getByLabelText(/^Nom du design/), 'Bleu');
    await u.type(screen.getByLabelText('Couleur (facultative)'), '#1177A8');
    await u.click(screen.getByRole('button', { name: 'Ajouter le design' }));
    await waitFor(() => expect(appels(simule, 'POST', '/produits/10/designs/')).toHaveLength(1));
    const options = appels(simule, 'POST', '/produits/10/designs/')[0][1];
    expect(options.body).not.toBeInstanceOf(FormData);
    expect(JSON.parse(options.body)).toEqual({ nom: 'Bleu', couleur: '#1177A8', traductions: {} });
    expect(await screen.findByRole('button', { name: 'Modifier Bleu' })).toBeInTheDocument();
  });

  it('ajoute un design avec image en multipart (champ « image »)', async () => {
    const simule = simulerApi([['POST', '/produits/10/designs/', design(4, { image: 'http://testserver/media/catalogue/designs/a.webp' })]]);
    const u = userEvent.setup();
    render(<Gestion initiaux={[]} />);
    await u.type(screen.getByLabelText(/^Nom du design/), 'Gris béton');
    await u.upload(screen.getByLabelText('Image du design (facultative)'), new File(['x'], 'gris.png', { type: 'image/png' }));
    await u.click(screen.getByRole('button', { name: 'Ajouter le design' }));
    await waitFor(() => expect(appels(simule, 'POST', '/produits/10/designs/')).toHaveLength(1));
    const corps = appels(simule, 'POST', '/produits/10/designs/')[0][1].body;
    expect(corps).toBeInstanceOf(FormData);
    expect(corps.get('image').name).toBe('gris.png');
    expect(corps.get('nom')).toBe('Gris béton');
    expect(corps.get('traductions')).toBe('{}');
    expect(corps.has('fichier')).toBe(false);
    // L'adresse renvoyée par le serveur (chaîne) sert de miniature.
    const ligne = (await screen.findByRole('button', { name: 'Modifier Gris béton' })).closest('li');
    expect(ligne.querySelector('img')).toHaveAttribute('src', 'http://testserver/media/catalogue/designs/a.webp');
  });

  it('refuse une couleur invalide sans appeler le serveur', async () => {
    const simule = simulerApi();
    const u = userEvent.setup();
    render(<Gestion initiaux={[]} />);
    await u.type(screen.getByLabelText(/^Nom du design/), 'Bleu');
    await u.type(screen.getByLabelText('Couleur (facultative)'), 'bleu');
    await u.click(screen.getByRole('button', { name: 'Ajouter le design' }));
    expect(screen.getByLabelText('Couleur (facultative)')).toHaveAccessibleDescription(/Utilisez le format #RRGGBB\./);
    expect(appels(simule, 'POST', '/designs/')).toHaveLength(0);
  });

  it('modifie un design par PATCH sur designs/<id>/ et affiche une erreur 400 sous le champ', async () => {
    let essai = 0;
    const simule = simulerApi([['PATCH', '/api/admin/catalogue/designs/3/', (u, o) => {
      essai += 1;
      return essai === 1 ? reponse(400, { couleur: ['Couleur attendue au format #RRGGBB.'] })
        : reponse(200, { ...design(3), ...JSON.parse(o.body) });
    }]]);
    const u = userEvent.setup();
    render(<Gestion initiaux={[design(3)]} />);
    await u.click(screen.getByRole('button', { name: 'Modifier Gris béton' }));
    const edition = screen.getByRole('button', { name: 'Annuler' }).closest('div').parentElement;
    const nom = within(edition).getByLabelText(/^Nom du design/);
    await u.clear(nom);
    await u.type(nom, 'Gris clair');
    await u.click(within(edition).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(within(edition).getByLabelText('Couleur (facultative)'))
      .toHaveAccessibleDescription(/Couleur attendue au format #RRGGBB\./));
    await u.click(within(edition).getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByRole('button', { name: 'Modifier Gris clair' })).toBeInTheDocument();
    expect(JSON.parse(appels(simule, 'PATCH', '/designs/3/')[1][1].body)).toEqual({ nom: 'Gris clair', couleur: '#AABBCC', traductions: {} });
  });

  it('supprime un design après confirmation (DELETE designs/<id>/)', async () => {
    const simule = simulerApi([['DELETE', '/api/admin/catalogue/designs/3/', () => reponse(204, null)]]);
    const u = userEvent.setup();
    render(<Gestion initiaux={[design(3)]} />);
    await u.click(screen.getByRole('button', { name: 'Supprimer Gris béton' }));
    await u.click(screen.getByRole('button', { name: 'Confirmer la suppression' }));
    await waitFor(() => expect(screen.getByText('Aucun design pour le moment.')).toBeInTheDocument());
    expect(appels(simule, 'DELETE', '/designs/3/')).toHaveLength(1);
  });
});
