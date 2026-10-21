// Cohérence entre les routes de l'application (routes.jsx), les cadrages de la caméra (cameras.js) et les
// pages parentes (parents.js) : aucune route oubliée, aucun cadrage orphelin, voisines distinctes.
import { readFileSync } from 'node:fs';

import { CAMERAS, cadrageDe, nomDeVue, PLAN_LARGE } from './cameras.js';
import { estRacine, parentDe, RACINES } from './parents.js';

const source = readFileSync('src/app/routes.jsx', 'utf8');
const routes = ['/', ...[...source.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => `/${m[1]}`).filter((p) => p !== '/*')];
const exemple = (motif) => motif.replace(/:\w+/g, 'x7');

describe('routes et cadrages', () => {
  it('lit bien les routes de routes.jsx (garde-fou du test)', () => {
    expect(routes.length).toBeGreaterThanOrEqual(20);
    expect(routes).toContain('/commandes/:id/payer');
  });

  it.each(routes)('la route %s a un cadrage propre (pas « inconnue », pas le plan large)', (route) => {
    const chemin = exemple(route);
    expect(nomDeVue(chemin), route).not.toBe('inconnue');
    expect(cadrageDe(chemin), route).not.toEqual(PLAN_LARGE);
  });

  it('chaque cadrage correspond à une vraie route (pas de cadrage mort) et inversement', () => {
    const motifs = CAMERAS.map((c) => c.motif).sort();
    expect(motifs).toEqual([...routes].sort());
  });

  it('noms de vue uniques', () => {
    const noms = CAMERAS.map((c) => c.nom);
    expect(new Set(noms).size).toBe(noms.length);
  });

  it('une route précise n\'est pas masquée par une route à paramètre (/commandes/nouvelle, /catalogue/:slug)', () => {
    expect(nomDeVue('/commandes/nouvelle')).toBe('nouvelle-commande');
    expect(nomDeVue('/commandes/12')).toBe('commande');
    expect(nomDeVue('/commandes/12/')).toBe('commande');
    expect(nomDeVue('/catalogue/')).toBe('catalogue');
  });

  it('chaque page parente est elle-même une route avec cadrage ; chaque sous-page a un parent différent d\'elle', () => {
    for (const route of routes) {
      const chemin = exemple(route);
      if (estRacine(chemin)) continue;
      const parent = parentDe(chemin);
      expect(parent, route).not.toBe(chemin);
      expect(nomDeVue(parent), `${route} -> ${parent}`).not.toBe('inconnue');
    }
  });

  it('chaque couple page / page parente a des cadrages distincts (bureau et téléphone)', () => {
    for (const route of routes) {
      const chemin = exemple(route);
      if (estRacine(chemin)) continue;
      const parent = parentDe(chemin);
      for (const tel of [false, true]) {
        const [a, b] = [cadrageDe(chemin, tel), cadrageDe(parent, tel)];
        const distinct = Math.abs(a.x - b.x) >= 4 || Math.abs(a.y - b.y) >= 4 || Math.abs(a.zoom - b.zoom) >= 0.3;
        expect(distinct, `${chemin} / ${parent} (${tel ? 'tel' : 'bureau'})`).toBe(true);
      }
    }
  });

  it('les cinq racines se distinguent deux à deux', () => {
    for (const tel of [false, true]) {
      for (let i = 0; i < RACINES.length; i += 1) {
        for (let j = i + 1; j < RACINES.length; j += 1) {
          const [a, b] = [cadrageDe(RACINES[i], tel), cadrageDe(RACINES[j], tel)];
          expect(`${a.x}|${a.y}|${a.zoom}` !== `${b.x}|${b.y}|${b.zoom}`, `${RACINES[i]} / ${RACINES[j]}`).toBe(true);
        }
      }
    }
  });

  it('le cadrage de l\'accueil vise la lumière des fenêtres définie dans le CSS (--fx, --fy)', () => {
    const css = readFileSync('src/styles/profondeur.css', 'utf8');
    const bureau = /:root \{ --fx: (\d+)%; --fy: (\d+)%;/.exec(css);
    const tel = /@media \(max-width: 900px\) { :root \{ --fx: (\d+)%; --fy: (\d+)%;/.exec(css);
    const accueil = CAMERAS.find((c) => c.nom === 'accueil');
    expect([accueil.bureau.x, accueil.bureau.y]).toEqual([Number(bureau[1]), Number(bureau[2])]);
    expect([accueil.tel.x, accueil.tel.y]).toEqual([Number(tel[1]), Number(tel[2])]);
  });
});
