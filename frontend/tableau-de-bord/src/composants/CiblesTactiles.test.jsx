// Cibles tactiles de la vague 2 (testeur) : tout ce qui se touche au doigt (liens tel:/mailto:, liens de référence
// qui ouvrent un détail, onglets, boutons de ligne) fait au moins 44 px (--cible-tactile), règle de CLAUDE.md.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const RACINE = resolve(__dirname, '../..');
const css = (chemin) => readFileSync(resolve(RACINE, chemin), 'utf8');
const regle = (source, selecteur) => {
  const m = source.match(new RegExp(`${selecteur.replace(/[.[\]]/g, '\\$&')}\\s*{([^}]*)}`));
  return m ? m[1] : '';
};

describe('cibles tactiles (CSS)', () => {
  const pilotage = css('src/composants/Pilotage.module.css');

  it('les onglets font au moins 44 px', () => {
    expect(regle(pilotage, '.onglet')).toMatch(/min-height:\s*var\(--cible-tactile\)/);
  });

  it('les liens tel: et mailto: font au moins 44 px (appel au doigt depuis un téléphone)', () => {
    expect(regle(pilotage, '.liensContact a')).toMatch(/min-height:\s*(var\(--cible-tactile\)|4[4-9]px|[5-9]\dpx)/);
  });

  it.each([
    ['src/modules/commandes/Commandes.module.css'],
    ['src/modules/devis/Devis.module.css'],
  ])('le lien de référence qui ouvre un détail (%s) fait au moins 44 px', (chemin) => {
    expect(regle(css(chemin), '.reference')).toMatch(/min-height:\s*var\(--cible-tactile\)/);
  });

  it('les boutons de ligne (↑ ↓ ✕) du devis font au moins 44 px', () => {
    const devis = css('src/modules/devis/Devis.module.css');
    const gestion = css('src/composants/Gestion.module.css');
    expect(regle(gestion, '.icone')).toMatch(/min-width:\s*var\(--cible-tactile\)/);
    expect(devis).toMatch(/boutonsLigne/);
  });
});
