// Fidélité aux maquettes : garde-fous lus dans le CSS réel (jsdom ne calcule pas la mise en page).
import { readFileSync } from 'node:fs';

import { TAILLE_PAGE } from '@/modules/catalogue/useCatalogue.js';

const css = readFileSync('src/styles/maquette.css', 'utf8');
const bloc = (selecteur) => new RegExp(`${selecteur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`).exec(css)?.[1] ?? '';

describe('maquette.css : bandeau et fiche', () => {
  it('le bandeau fait 440 px sous l\'en-tête fixe, sans marge négative (sinon 84 px de photo sont coupés)', () => {
    const b = bloc('.m-bandeau');
    expect(b).toMatch(/height: 440px/);
    expect(b).not.toMatch(/margin-top/);
  });

  it('le catalogue demande 10 produits par page comme la maquette', () => {
    expect(TAILLE_PAGE).toBe(10);
  });

  it('fond de la fiche produit : image floutée une fois, jamais animée, assez sombre pour du texte blanc', () => {
    const luminosite = Number(/blur\(\d+px\) brightness\(([\d.]+)\)/.exec(css)?.[1]);
    expect(luminosite).toBeGreaterThan(0);
    expect(luminosite).toBeLessThanOrEqual(0.5);
    expect(css).not.toMatch(/@keyframes[^{]*\{[^]*?filter:/);
  });

  it('bandeau et fenêtre téléphone : voile assez foncé pour le texte blanc (contraste mesuré 3,5 et 4)', () => {
    const alpha = (re) => Number(re.exec(css)?.[1]);
    expect(alpha(/\.m-bandeau::after \{[^}]*rgba\(14, 42, 56, ([\d.]+)\)/)).toBeGreaterThanOrEqual(0.5);
    expect(alpha(/\.m-fenetre-tel::after \{[^}]*rgba\(14, 42, 56, ([\d.]+)\)/)).toBeGreaterThanOrEqual(0.5);
  });

  it('téléphone : la fenêtre du catalogue et celle de l\'écran de compte montrent le salon net (image propre)', () => {
    expect(bloc('.m-fenetre-tel')).toMatch(/bandeau-maison-800\.webp/);
    expect(css).toMatch(/\.m-compte-visuel \.fenetre \{[^}]*bandeau-maison-800\.webp/);
  });
});
