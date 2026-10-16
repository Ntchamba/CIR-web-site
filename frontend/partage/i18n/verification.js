// Contrôle des fichiers de traduction (utilisé par les tests de chaque application) : chaque langue doit
// avoir exactement les clés du français, avec les mêmes variables « {nom} ».

/** Liste « chemin.pointé » → texte (ou objet de pluriel) d'un fichier de messages. */
export function aplatir(messages, prefixe = '', sortie = {}) {
  Object.entries(messages).forEach(([cle, valeur]) => {
    const chemin = prefixe ? `${prefixe}.${cle}` : cle;
    if (valeur && typeof valeur === 'object' && typeof valeur.other !== 'string') aplatir(valeur, chemin, sortie);
    else sortie[chemin] = valeur;
  });
  return sortie;
}

const variables = (texte) => {
  const tous = typeof texte === 'object' ? Object.values(texte).join(' ') : String(texte);
  return [...new Set(tous.match(/\{\w+\}/g) || [])].sort();
};

/**
 * Compare une traduction au français. Renvoie la liste des problèmes (vide si tout va bien) :
 * clés manquantes, clés en trop, textes vides, variables différentes.
 */
export function ecartsAvecFrancais(fr, autre) {
  const reference = aplatir(fr);
  const traduction = aplatir(autre);
  const problemes = [];
  Object.keys(reference).forEach((cle) => {
    if (!(cle in traduction)) problemes.push(`clé manquante : ${cle}`);
    else if (!String(typeof traduction[cle] === 'object' ? traduction[cle].other : traduction[cle]).trim()) {
      problemes.push(`texte vide : ${cle}`);
    } else if (variables(reference[cle]).join() !== variables(traduction[cle]).join()) {
      problemes.push(`variables différentes : ${cle}`);
    }
  });
  Object.keys(traduction).forEach((cle) => {
    if (!(cle in reference)) problemes.push(`clé en trop : ${cle}`);
  });
  return problemes;
}
