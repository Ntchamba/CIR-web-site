// Multilingue de la vague 2 (testeur) : tous les codes renvoyés par le back-end ont un libellé dans les cinq langues,
// et aucun texte visible n'est écrit en dur dans les composants des modules commandes, devis et contact.
import { t, changerLangue } from './index.js';

// Valeurs des énumérations du back-end (apps/commandes, devis, contact).
const CODES = {
  'commandes.types': ['maison', 'industrie', 'entreprise'],
  'commandes.auteurs': ['client', 'equipe'],
  'commandes.negociation.etats': ['en_attente', 'acceptee', 'refusee', 'remplacee'],
  'devis.etats': ['brouillon', 'envoye', 'accepte', 'refuse', 'remplace'],
  'devis.demandes.etats': ['nouvelle', 'en_etude', 'devis_envoye', 'close'],
  'devis.editeur.types': ['materiau', 'surface', 'forfait'],
  'contact.etats': ['nouvelle', 'en_cours', 'traitee'],
  'contact.types': ['question', 'rappel'],
  'contact.creneaux': ['matin', 'apres_midi', 'soir', 'peu_importe'],
  statuts: ['nouvelle', 'negociation', 'contrat_signe', 'travaux', 'terminee', 'annulee'],
};
const LANGUES = ['fr', 'en', 'zh', 'de', 'ja'];

describe.each(LANGUES)('libellés des codes du serveur en %s', (langue) => {
  it('chaque code a un libellé (pas la clé brute)', async () => {
    await changerLangue(langue);
    Object.entries(CODES).forEach(([prefixe, codes]) => {
      codes.forEach((code) => {
        const cle = `${prefixe}.${code}`;
        const texte = t(cle);
        expect(texte, cle).toBeTruthy();
        expect(texte, cle).not.toBe(cle);
      });
    });
  });

  it('les pluriels et variables des textes de la vague sont résolus', async () => {
    await changerLangue(langue);
    expect(t('commandes.nombre', { n: 2 })).not.toContain('{n}');
    expect(t('commandes.negociation.confirmerAccepter', { etape: 'X' })).not.toContain('{etape}');
    expect(t('devis.editeur.confirmerEnvoi', { total: '39 400 FCFA' })).toContain('39 400 FCFA');
    expect(t('coque.aTraiter', { n: 3 })).toContain('3');
  });
});

describe('aucun texte en dur dans les composants de la vague 2', () => {
  const sources = import.meta.glob(['../modules/{commandes,devis,contact}/**/*.jsx', '../composants/{ConfirmerAction,NotesInternes,Onglets,LiensContact,PastilleEtat}.jsx'],
    { query: '?raw', import: 'default', eager: true });

  it.each(Object.entries(sources).filter(([chemin]) => !chemin.endsWith('.test.jsx')))('%s', (chemin, code) => {
    // Texte entre balises (hors expressions) contenant des lettres.
    const textes = [...code.matchAll(/>\s*([^<>{}\n]*[A-Za-zÀ-ÿ]{3,}[^<>{}\n]*)\s*</g)].map((m) => m[1].trim())
      .filter((x) => x && !x.startsWith('//') && !/^[\s\W]*$/.test(x))
      .filter((x) => !/^[):?]\s*[\w ]*\?\s*$|^\)\s*:|^\)\s*\?|=>|\|\||&&|===/.test(x)); // fragments de JavaScript (ternaires)
    expect(textes, chemin).toEqual([]);
    // Attributs visibles écrits en dur.
    const attributs = [...code.matchAll(/\s(aria-label|title|alt|placeholder)="([^"]*[A-Za-zÀ-ÿ]{3,}[^"]*)"/g)].map((m) => m[2]);
    expect(attributs.filter((a) => !/^(\+237|YD-|\/|https?:)/.test(a)), chemin).toEqual([]);
  });
});
