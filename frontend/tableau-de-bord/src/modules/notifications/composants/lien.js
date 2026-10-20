/** Chemin interne du tableau de bord sûr, ou null (jamais d'adresse externe ni de `javascript:`). */
export function lienInterne(lien) {
  if (typeof lien !== 'string') return null;
  if (!lien.startsWith('/') || lien.startsWith('//') || lien.includes('\\')) return null;
  return lien;
}
