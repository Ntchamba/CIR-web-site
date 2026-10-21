// Flèche « < » : taille tactile et seuil d'affichage lus dans le CSS réel (jsdom ne calcule pas les médias).
import { readFileSync } from 'node:fs';

import { pagePrecedenteDuSite } from './BoutonRetour.jsx';

const css = readFileSync('src/layout/Entete.module.css', 'utf8');
const jetons = readFileSync('../partage/styles/jetons.css', 'utf8');

describe('flèche de retour : CSS', () => {
  it('masquée par défaut (ordinateur), affichée à 900 px et moins, comme la barre d\'onglets', () => {
    expect(/\.retour \{\s*display: none;/.test(css)).toBe(true);
    expect(/@media \(max-width: 900px\) \{\s*\.retour \{ display: inline-flex; \}/.test(css)).toBe(true);
    const onglets = readFileSync('src/layout/BarreOnglets.module.css', 'utf8');
    expect(onglets).toMatch(/max-width: 900px/);
  });

  it('cible tactile de 44 px (largeur et hauteur)', () => {
    expect(/--cible-tactile: 44px/.test(jetons)).toBe(true);
    expect(/\.retour \{[^}]*width: var\(--cible-tactile\); height: var\(--cible-tactile\)/.test(css)).toBe(true);
  });
});

describe('pagePrecedenteDuSite', () => {
  afterEach(() => window.history.replaceState(null, ''));
  it.each([[null, false], [{}, false], [{ idx: 0 }, false], [{ idx: '0' }, false], [{ idx: 1 }, true], [{ idx: 5 }, true]])(
    'état %j -> %s', (etat, attendu) => {
      window.history.replaceState(etat, '');
      expect(pagePrecedenteDuSite()).toBe(attendu);
    });
});
