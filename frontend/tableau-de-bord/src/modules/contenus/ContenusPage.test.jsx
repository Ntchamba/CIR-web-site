// Contenus : accueil (textes, coordonnées), bandeaux (lien interne), sphère (ordre).
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { appels, rendre, simulerApi } from '@/test/api-simulee.jsx';

const ACCUEIL = {
  titre: '', accroche: '', texte_partenaire: '', video_fond: null, image_affiche: null,
  telephones: ['+237 600 00 00 01'], whatsapp: '+237 622 191 931', email: '', adresse: 'Total Nkolmbong, Douala',
  traductions: {}, langues_incompletes: [],
};

describe('ContenusPage', () => {
  it("enregistre l'accueil en JSON avec la liste des téléphones", async () => {
    const simule = simulerApi([
      ['GET', '/contenus/accueil/', ACCUEIL],
      ['PATCH', '/contenus/accueil/', (u, o) => ({ ...ACCUEIL, ...JSON.parse(o.body) })],
    ]);
    rendre('/contenus');
    const u = userEvent.setup();
    expect(await screen.findByDisplayValue('Total Nkolmbong, Douala')).toBeInTheDocument();
    await u.type(screen.getByLabelText('Titre principal'), 'Sols en résine époxy');
    await u.click(screen.getByRole('button', { name: 'Ajouter un numéro' }));
    await u.type(screen.getByLabelText('Téléphone 2'), '+237 600 00 00 02');
    await u.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText("Contenu de l'accueil enregistré.", { selector: 'p:not([role])' })).toBeInTheDocument();
    const corps = JSON.parse(appels(simule, 'PATCH', '/contenus/accueil/')[0][1].body);
    expect(corps).toMatchObject({ titre: 'Sols en résine époxy', telephones: ['+237 600 00 00 01', '+237 600 00 00 02'] });
  });

  it('refuse un lien de bandeau qui ne commence pas par « / »', async () => {
    const simule = simulerApi([['GET', '/contenus/bandeaux/', []]]);
    rendre('/contenus/bandeaux');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Nouveau bandeau' }));
    const tiroir = screen.getByRole('dialog', { name: 'Nouveau bandeau' });
    await u.type(within(tiroir).getByLabelText(/^Texte/), 'Promotion du mois');
    await u.type(within(tiroir).getByLabelText(/^Lien/), 'https://exemple.cm');
    await u.click(within(tiroir).getByRole('button', { name: 'Enregistrer' }));
    expect(within(tiroir).getByLabelText(/^Lien/)).toHaveAccessibleDescription(/commençant par « \/ »\.$/);
    expect(appels(simule, 'POST', '/bandeaux/')).toHaveLength(0);
  });

  it('change l’ordre des photos de la sphère', async () => {
    const simule = simulerApi([
      ['GET', '/contenus/sphere/', [
        { id: 1, image: { url: 'https://x/1.webp', alt: '' }, alt: 'Sol bleu', produit: null, ordre: 0, langues_incompletes: [] },
        { id: 2, image: { url: 'https://x/2.webp', alt: '' }, alt: 'Sol gris', produit: null, ordre: 1, langues_incompletes: [] },
      ]],
      ['POST', '/sphere/ordre/', { detail: 'ok' }],
    ]);
    rendre('/contenus/sphere');
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Monter Sol gris' }));
    await waitFor(() => expect(appels(simule, 'POST', '/sphere/ordre/')).toHaveLength(1));
    expect(JSON.parse(appels(simule, 'POST', '/sphere/ordre/')[0][1].body)).toEqual({ ids: [2, 1] });
    expect(await screen.findByRole('button', { name: 'Monter Sol bleu' })).toBeInTheDocument();
  });
});
