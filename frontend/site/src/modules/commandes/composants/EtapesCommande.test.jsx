import { render, screen, within } from '@testing-library/react';

import { COMMANDE, COMMANDE_SIGNEE } from '../fixtures.js';
import EtapesCommande from './EtapesCommande.jsx';

describe('EtapesCommande', () => {
  it('contrat signé : deux étapes faites, une courante, deux à venir, dates de l’historique', () => {
    render(<EtapesCommande commande={COMMANDE_SIGNEE} />);
    const items = screen.getAllByRole('listitem').filter((li) => li.parentElement.tagName === 'OL');
    expect(items).toHaveLength(5);
    expect(items.filter((li) => li.hasAttribute('aria-current'))).toEqual([items[2]]);
    expect(within(items[2]).getByText('étape en cours')).toBeInTheDocument();
    expect(within(items[3]).getByText('étape à venir')).toBeInTheDocument();
    expect(within(items[1]).getByText('16 octobre 2026')).toBeInTheDocument();
  });

  it('historique : lignes lisibles, « Création » pour l’étape initiale', () => {
    render(<EtapesCommande commande={COMMANDE} />);
    expect(screen.getByText(/Création → Nouvelle, par vous/)).toBeInTheDocument();
    expect(screen.getByText(/Nouvelle → En négociation, par l'équipe CIR/)).toBeInTheDocument();
  });
});
