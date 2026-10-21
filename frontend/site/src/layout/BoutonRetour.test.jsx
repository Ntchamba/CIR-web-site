// Flèche de retour (téléphone) : absente des pages racines, présente ailleurs ; historique du site ou page parente.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';

import { changerLangue } from '@/i18n/index.js';

import BoutonRetour from './BoutonRetour.jsx';

function Lieu() {
  return <output data-testid="lieu">{useLocation().pathname}</output>;
}
const rendre = (chemin, entrees = [chemin]) => render(
  <MemoryRouter initialEntries={entrees} initialIndex={entrees.length - 1}>
    <BoutonRetour />
    <Routes><Route path="*" element={<Lieu />} /></Routes>
  </MemoryRouter>,
);
const bouton = () => screen.queryByRole('button', { name: 'Retour à la page précédente' });

describe('BoutonRetour', () => {
  afterEach(() => { window.history.replaceState(null, ''); });

  it.each(['/', '/catalogue', '/realisations', '/commandes', '/compte'])('absent sur la page racine %s', (chemin) => {
    rendre(chemin);
    expect(bouton()).toBeNull();
  });

  it.each(['/catalogue/yd-500', '/commandes/3', '/commandes/nouvelle', '/commandes/3/payer', '/paiements/2/recu',
    '/devis/demande', '/selection', '/messages', '/notifications', '/actualites/une', '/contact', '/connexion', '/inscription'])(
    'présent sur la sous-page %s, vrai bouton', (chemin) => {
      rendre(chemin);
      const b = bouton();
      expect(b).toBeInTheDocument();
      expect(b.tagName).toBe('BUTTON');
      expect(b).toHaveAttribute('type', 'button');
    });

  it('sans page précédente du site : retour vers la page parente (jamais hors du site)', async () => {
    window.history.replaceState({ idx: 0 }, '');
    rendre('/commandes/3/payer');
    await userEvent.click(bouton());
    expect(screen.getByTestId('lieu')).toHaveTextContent(/^\/commandes\/3$/);
  });

  it('avec une page précédente du site : retour dans l\'historique (navigate(-1))', async () => {
    window.history.replaceState({ idx: 1 }, '');
    rendre('/catalogue/yd-500', ['/realisations', '/catalogue/yd-500']);
    await userEvent.click(bouton());
    expect(screen.getByTestId('lieu')).toHaveTextContent(/^\/realisations$/);
  });

  it('libellé traduit', async () => {
    await changerLangue('en');
    rendre('/contact');
    expect(screen.getByRole('button', { name: 'Back to the previous page' })).toBeInTheDocument();
  });
});
