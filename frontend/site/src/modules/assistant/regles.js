// Règles pures de l'assistant : longueur, stockage de la clé de conversation, adresses des liens, codes d'erreur.
export const LONGUEUR_MAX = 1000;
export const CLE_STOCKAGE = 'cir-site.assistant';

/** Texte prêt à envoyer (espaces de bord retirés) ou '' s'il est vide ou trop long. */
export function texteEnvoyable(texte) {
  const propre = typeof texte === 'string' ? texte.trim() : '';
  return propre.length > 0 && propre.length <= LONGUEUR_MAX ? propre : '';
}

/** Lien interne sûr : chemin du site uniquement (jamais « //hôte », « http: » ni « javascript: »). */
export function cheminInterne(chemin) {
  return typeof chemin === 'string' && /^\/(?![/\\])[^\s\\]*$/.test(chemin) ? chemin : null;
}

/** Liens du serveur filtrés : libellé non vide et chemin interne. */
export function liensSurs(liens) {
  if (!Array.isArray(liens)) return [];
  return liens
    .map((l) => ({ libelle: typeof l?.libelle === 'string' ? l.libelle.trim() : '', chemin: cheminInterne(l?.chemin) }))
    .filter((l) => l.libelle && l.chemin);
}

/** Clé de conversation gardée dans localStorage (l'application marche sans) : {cle, connecte} ou null. */
export function lireCle() {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE_STOCKAGE) || 'null');
    return brut && typeof brut.cle === 'string' && brut.cle ? { cle: brut.cle, connecte: Boolean(brut.connecte) } : null;
  } catch {
    return null;
  }
}

export function ecrireCle(cle, connecte) {
  try {
    localStorage.setItem(CLE_STOCKAGE, JSON.stringify({ cle, connecte: Boolean(connecte) }));
  } catch {
    /* stockage indisponible ou plein : la conversation reste valable tant que la page est ouverte */
  }
}

export function oublierCle() {
  try {
    localStorage.removeItem(CLE_STOCKAGE);
  } catch {
    /* rien à faire */
  }
}

/** Clé de texte traduit pour une erreur de l'API (code du serveur, sinon statut). */
export function cleErreur(erreur) {
  const code = erreur?.donnees?.code;
  if (code === 'assistant_trop_de_messages' || erreur?.statut === 429) return 'assistant.erreurs.tropDeMessages';
  if (code === 'assistant_limite_atteinte') return 'assistant.erreurs.limiteAtteinte';
  if (code === 'assistant_non_configure') return 'assistant.erreurs.nonConfigure';
  if (code === 'assistant_indisponible' || (erreur?.statut >= 500)) return 'assistant.erreurs.indisponible';
  if (erreur?.statut === 0) return 'assistant.erreurs.reseau';
  return 'assistant.erreurs.generique';
}
