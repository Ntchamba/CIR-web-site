// Test de fumée : l'application démarre, affiche l'en-tête, le pied de page et protège /compte.
// La suite complète est écrite par l'agent site-testeur.
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import App from '@/app/App.jsx';
import { simulerApi } from '@/test/outils.jsx';

function rendre(chemin) {
  return render(
    <MemoryRouter initialEntries={[chemin]}>
      <App />
    </MemoryRouter>,
  );
}

describe('Site public (fumée)', () => {
  it("affiche l'accueil avec la navigation et le partenaire Jiuye", async () => {
    simulerApi(); // API vide : l'accueil affiche ses textes par défaut
    rendre('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Des sols en résine époxy faits pour durer' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Navigation mobile' })).toBeInTheDocument();
    expect(within(screen.getByRole('contentinfo')).getByAltText('Jiuye')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Se connecter' })).toHaveAttribute('href', '/connexion');
  });

  it('renvoie vers la connexion quand on ouvre /compte sans être connecté', async () => {
    simulerApi();
    rendre('/compte');
    expect(await screen.findByRole('heading', { level: 1, name: 'Se connecter' })).toBeInTheDocument();
  });
});
