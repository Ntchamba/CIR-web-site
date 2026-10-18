// Critères d'une liste gardés dans l'adresse de la page (?etat=…&q=…&page=2), et saisie de recherche
// envoyée après un court délai.
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

const DELAI_RECHERCHE = 300; // ms

/** Lit les clés demandées dans l'adresse. `modifier({ cle: valeur })` : valeur vide = retirée ; changer un critère revient à la page 1. */
export function useCriteres(cles) {
  const [parametres, setParametres] = useSearchParams();
  const valeurs = {};
  cles.forEach((cle) => { valeurs[cle] = parametres.get(cle) ?? ''; });
  const page = Math.max(1, Number.parseInt(parametres.get('page') ?? '1', 10) || 1);

  const modifier = useCallback((changements) => {
    setParametres((actuels) => {
      const nouveaux = new URLSearchParams(actuels);
      Object.entries(changements).forEach(([cle, valeur]) => {
        if (valeur === '' || valeur == null || (cle === 'page' && Number(valeur) <= 1)) nouveaux.delete(cle);
        else nouveaux.set(cle, String(valeur));
      });
      if (!('page' in changements)) nouveaux.delete('page');
      return nouveaux;
    }, { replace: true });
  }, [setParametres]);

  return { valeurs, page, modifier };
}

/** Champ de recherche : `saisie` suit la frappe, `surChangement(texte)` est appelé après `delai` ms sans frappe. */
export function useRecherche(valeurUrl, surChangement, delai = DELAI_RECHERCHE) {
  const [saisie, setSaisie] = useState(valeurUrl);
  useEffect(() => {
    const texte = saisie.trim();
    if (texte === valeurUrl) return undefined;
    const minuteur = setTimeout(() => surChangement(texte), delai);
    return () => clearTimeout(minuteur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saisie, valeurUrl, delai]);
  return [saisie, setSaisie, () => { setSaisie(''); surChangement(''); }];
}
