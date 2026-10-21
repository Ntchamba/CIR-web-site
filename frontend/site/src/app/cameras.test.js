// Cadrages de la caméra : chaque vue connue a un cadrage valide, dans l'image, et deux vues ne se confondent pas.
import { CAMERAS, cadrageDe, nomDeVue, PLAN_LARGE, transformDe } from './cameras.js';

const valide = (c) => c.x >= 0 && c.x <= 100 && c.y >= 0 && c.y <= 100 && c.zoom >= 1 && c.zoom <= 4;

describe('cameras', () => {
  it.each(CAMERAS.flatMap((c) => [[c.nom, 'bureau', c.bureau], [c.nom, 'tel', c.tel]]))(
    '%s (%s) : cadrage dans l\'image', (nom, ecran, cadrage) => {
      expect(valide(cadrage)).toBe(true);
    });

  it('deux vues différentes n\'ont jamais le même cadrage (on sent toujours un déplacement)', () => {
    for (const ecran of ['bureau', 'tel']) {
      const vus = new Set();
      for (const c of CAMERAS) {
        const { x, y, zoom } = c[ecran];
        const cle = `${x}|${y}|${zoom}`;
        if (c.nom !== 'accueil') expect(vus.has(cle), `${c.nom} (${ecran})`).toBe(false);
        vus.add(cle);
      }
    }
  });

  it('les vues voisines se décalent d\'au moins 4 % ou changent de zoom', () => {
    const voisines = [['/catalogue', '/catalogue/yd-500'], ['/commandes', '/commandes/12'], ['/commandes/12', '/commandes/12/payer'],
      ['/commandes', '/commandes/nouvelle'], ['/connexion', '/inscription'], ['/catalogue', '/selection']];
    for (const [a, b] of voisines) {
      const [ca, cb] = [cadrageDe(a), cadrageDe(b)];
      expect(Math.abs(ca.x - cb.x) >= 4 || Math.abs(ca.y - cb.y) >= 4 || Math.abs(ca.zoom - cb.zoom) >= 0.3, `${a} -> ${b}`).toBe(true);
    }
  });

  it('retrouve la vue d\'une adresse avec paramètres ; page inconnue : plan large', () => {
    expect(nomDeVue('/catalogue/sol-autolissant')).toBe('produit');
    expect(nomDeVue('/commandes/7/payer')).toBe('paiement');
    expect(cadrageDe('/n-importe-quoi')).toEqual(PLAN_LARGE);
    expect(nomDeVue('/n-importe-quoi')).toBe('inconnue');
    expect(cadrageDe('/catalogue', true)).not.toEqual(cadrageDe('/catalogue', false));
  });

  it('le décalage reste borné : jamais de bord de l\'image visible', () => {
    for (const c of CAMERAS) {
      for (const ecran of ['bureau', 'tel']) {
        const { tx, ty, echelle } = transformDe(c[ecran]);
        const max = (echelle - 1) * 50;
        expect(Math.abs(tx)).toBeLessThanOrEqual(max + 1e-9);
        expect(Math.abs(ty)).toBeLessThanOrEqual(max + 1e-9);
      }
    }
    expect(transformDe(PLAN_LARGE)).toEqual({ tx: 0, ty: 0, echelle: 1 });
  });
});
