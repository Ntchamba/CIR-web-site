// Multilingue de la vague 3 (messagerie, appels, notifications) : tous les codes renvoyés par le back-end ont un
// libellé dans les cinq langues, les pluriels et variables se résolvent, aucun texte visible n'est écrit en dur.
import { t, changerLangue } from './index.js';

const CODES = {
  'appels.etats': ['sonne', 'en_cours', 'termine', 'manque', 'refuse', 'annule'],
  'appels.types': ['audio', 'video'],
  'notifications.envois.etats': ['en_attente', 'envoye', 'echec', 'annule'],
  'notifications.evenements': [
    'commande_creee', 'commande_nouvelle', 'proposition_recue', 'proposition_client', 'contrat_signe', 'etape_changee',
    'devis_envoye', 'demande_rendu_nouvelle', 'demande_rendu_repondue', 'contact_nouveau', 'contact_repondu',
    'message_nouveau', 'appel_manque', 'nouveaute',
  ],
};
const LANGUES = ['fr', 'en', 'zh', 'de', 'ja'];

describe.each(LANGUES)('libellés de la vague 3 en %s', (langue) => {
  it('chaque code a un libellé (pas la clé brute)', async () => {
    await changerLangue(langue);
    Object.entries(CODES).forEach(([prefixe, codes]) => {
      codes.forEach((code) => {
        const cle = `${prefixe}.${code}`;
        expect(t(cle), cle).toBeTruthy();
        expect(t(cle), cle).not.toBe(cle);
      });
    });
  });

  it('les pluriels et variables sont résolus', async () => {
    await changerLangue(langue);
    [
      ['coque.nonLus', { n: 3 }], ['coque.nonLues', { n: 1 }], ['messagerie.liste.nonLus', { n: 2 }],
      ['appels.nombre', { n: 5 }], ['notifications.nombre', { n: 4 }], ['notifications.centre.ouvrirNonLues', { n: 7 }],
      ['appels.usage.texte', { n: 18, limite: 25 }], ['messagerie.saisie.restant', { n: 12 }],
      ['appels.entrant.titre', { nom: 'Awa' }], ['notifications.modeles.variables', { liste: 'x' }],
    ].forEach(([cle, variables]) => {
      const texte = t(cle, variables);
      expect(texte, cle).not.toMatch(/\{\w+\}/);
      expect(texte, cle).not.toBe(cle);
    });
    expect(t('appels.usage.texte', { n: 18, limite: 25 })).toMatch(/18/);
    expect(t('appels.usage.texte', { n: 18, limite: 25 })).toMatch(/25/);
  });
});

describe('aucun texte en dur dans les composants de la vague 3', () => {
  const sources = import.meta.glob([
    '../modules/{messagerie,appels,notifications}/**/*.jsx', '../layout/{FondDirect,Coque,Entete,MenuLateral}.jsx',
  ], { query: '?raw', import: 'default', eager: true });

  it.each(Object.entries(sources).filter(([chemin]) => !chemin.endsWith('.test.jsx')))('%s', (chemin, code) => {
    const textes = [...code.matchAll(/>\s*([^<>{}\n]*[A-Za-zÀ-ÿ]{3,}[^<>{}\n]*)\s*</g)].map((m) => m[1].trim())
      .filter((x) => x && !x.startsWith('//') && !/^[\s\W]*$/.test(x))
      .filter((x) => x !== 'CIR') // nom de la marque
      .filter((x) => !/^[):?]\s*[\w ]*\?\s*$|^\)\s*:|^\)\s*\?|=>|\|\||&&|===|^[:?]\s*!?\w+\s*\??$/.test(x)); // fragments de ternaires
    expect(textes, chemin).toEqual([]);
    const attributs = [...code.matchAll(/\s(aria-label|title|alt|placeholder)="([^"]*[A-Za-zÀ-ÿ]{3,}[^"]*)"/g)].map((m) => m[2]);
    expect(attributs.filter((a) => !/^(\+237|YD-|\/|https?:)/.test(a)), chemin).toEqual([]);
  });
});
