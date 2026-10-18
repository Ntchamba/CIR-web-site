// Liste paginée d'une route de l'API : `lister(criteres, { signal })` renvoie { count, next, previous, results }.
// `remplacer(element)` met à jour une ligne sur place (après une modification dans un tiroir).
import { resultats } from '@/app/api.js';

import useChargement from './useChargement.js';

export const TAILLE_PAGE = 24;

export default function useListe(lister, criteres) {
  const etat = useChargement(
    (signal) => lister(criteres, { signal }).then((reponse) => ({
      elements: resultats(reponse),
      total: typeof reponse?.count === 'number' ? reponse.count : resultats(reponse).length,
      suivante: Boolean(reponse?.next),
      precedente: Boolean(reponse?.previous),
    })),
    [JSON.stringify(criteres)],
    { initial: { elements: [], total: 0, suivante: false, precedente: false } },
  );
  const donnees = etat.donnees || { elements: [], total: 0, suivante: false, precedente: false };
  const remplacer = (element) => etat.setDonnees((d) => ({
    ...d, elements: d.elements.map((e) => (e.id === element.id ? { ...e, ...element } : e)),
  }));
  return { ...donnees, chargement: etat.chargement, erreur: etat.erreur, recharger: etat.recharger, remplacer };
}
