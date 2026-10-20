// Modèles d'e-mails : variables autorisées et lecture tolérante de la réponse de `GET modeles/`.
export const VARIABLES = ['nom', 'reference', 'montant', 'etape'];
export const LANGUES_MODELES = ['fr', 'en', 'zh', 'de', 'ja'];
export const LIMITES = { sujet: 150, introduction: 1000 };

/** Variables `{x}` d'un texte qui ne sont pas autorisées. */
export function variablesInconnues(texte = '') {
  const trouvees = [...String(texte).matchAll(/\{([^{}]*)\}/g)].map((m) => m[1]);
  return [...new Set(trouvees.filter((v) => !VARIABLES.includes(v)))];
}

const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);

/**
 * Normalise la réponse en liste d'événements :
 *   [{ evenement, langues: { fr: { defaut: { sujet, introduction }, modele: { sujet, introduction } | null }, … } }]
 * Accepte une liste simple ou paginée, et `langues` / `par_langue` (objet ou liste avec `langue`).
 */
export function normaliserModeles(donnees) {
  const liste = Array.isArray(donnees) ? donnees : donnees?.results || [];
  return liste.filter((e) => e && e.evenement).map((e) => {
    const brut = e.langues ?? e.par_langue ?? {};
    const entrees = Array.isArray(brut) ? brut.map((l) => [l.langue, l]) : Object.entries(brut);
    const langues = {};
    entrees.forEach(([code, v]) => {
      const valeur = objet(v) || {};
      langues[code] = {
        defaut: objet(valeur.defaut) || objet(valeur.par_defaut) || { sujet: '', introduction: '' },
        modele: objet(valeur.modele) || objet(valeur.enregistre) || null,
      };
    });
    return { evenement: e.evenement, libelle: e.libelle || '', langues };
  });
}
