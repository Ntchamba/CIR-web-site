// Tests du titre d'onglet et de la description de page (BNF-10).
import { render } from '@testing-library/react';

import usePageMeta, { configurerPageMeta, titreComplet } from './usePageMeta.js';

function Page({ titre, description }) {
  usePageMeta(titre, description);
  return null;
}

describe('usePageMeta', () => {
  beforeEach(() => {
    configurerPageMeta({ suffixe: ' | CIR', titreParDefaut: 'CIR, accueil' });
    document.head.querySelector('meta[name="description"]')?.remove();
  });

  it('titreComplet : suffixe, sinon titre par défaut', () => {
    expect(titreComplet('Catalogue')).toBe('Catalogue | CIR');
    expect(titreComplet('')).toBe('CIR, accueil');
  });

  it('règle le titre et crée puis met à jour la balise description', () => {
    const { rerender } = render(<Page titre="Connexion" description="Se connecter au CIR." />);
    expect(document.title).toBe('Connexion | CIR');
    const balises = document.head.querySelectorAll('meta[name="description"]');
    expect(balises).toHaveLength(1);
    expect(balises[0]).toHaveAttribute('content', 'Se connecter au CIR.');

    rerender(<Page titre="Inscription" description="Créer un compte." />);
    expect(document.title).toBe('Inscription | CIR');
    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1);
    expect(document.head.querySelector('meta[name="description"]')).toHaveAttribute('content', 'Créer un compte.');
  });

  it('sans description : balise inchangée', () => {
    render(<Page titre="Mon compte" />);
    expect(document.title).toBe('Mon compte | CIR');
    expect(document.head.querySelector('meta[name="description"]')).toBeNull();
  });
});
