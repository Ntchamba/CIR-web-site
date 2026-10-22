// L'impression ne doit jamais laisser de contenu masqué par les animations de profondeur.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/styles/profondeur.css', 'utf8');

describe('profondeur.css : impression', () => {
  it("coupe les animations liées au défilement à l'impression", () => {
    const bloc = css.slice(css.lastIndexOf('@media print'));
    expect(bloc).toMatch(/\.p3d\b/);
    expect(bloc).toMatch(/\.p3d-grand/);
    expect(bloc).toMatch(/\.m-bandeau-fond/);
    expect(bloc).toMatch(/animation:\s*none\s*!important/);
    expect(bloc).toMatch(/opacity:\s*1\s*!important/);
  });
});
