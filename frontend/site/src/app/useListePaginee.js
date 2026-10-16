// Liste paginée de l'API ({count, next, previous, results}) avec un bouton « Voir plus ».
// `charger({ page, signal })` renvoie une page ; la liste repart de la page 1 quand `deps` ou la langue changent.
//   const { elements, total, suivant, chargement, chargementSuite, erreur, erreurSuite, voirPlus, recharger }
//     = useListePaginee(({ page, signal }) => api.produits({ ...filtres, page }, { signal }), [cleFiltres]);
import { useCallback, useEffect, useRef, useState } from 'react';

import { resultats } from '@partage/api/client.js';

import { useTraduction } from '@/i18n/index.js';

const ETAT_INITIAL = {
  elements: [], total: 0, page: 0, suivant: false, chargement: true, chargementSuite: false, erreur: null, erreurSuite: null,
};

/** Ajoute les éléments d'une page sans doublon (une fiche ajoutée entre deux pages décale la liste). */
function fusionner(anciens, nouveaux) {
  const vus = new Set(anciens.map((e) => e.id));
  return [...anciens, ...nouveaux.filter((e) => !vus.has(e.id))];
}

export default function useListePaginee(charger, deps = []) {
  const { langue } = useTraduction();
  const [etat, setEtat] = useState(ETAT_INITIAL);
  const [essai, setEssai] = useState(0);
  const chargerActuel = useRef(charger);
  const etatActuel = useRef(etat);
  const generation = useRef(0); // ignore les réponses d'une ancienne liste (filtres changés entre-temps)

  useEffect(() => {
    chargerActuel.current = charger;
    etatActuel.current = etat;
  });

  useEffect(() => {
    const controleur = new AbortController();
    const numero = ++generation.current;
    setEtat((e) => ({ ...e, chargement: true, erreur: null, erreurSuite: null }));
    Promise.resolve()
      .then(() => chargerActuel.current({ page: 1, signal: controleur.signal }))
      .then((donnees) => {
        if (numero !== generation.current) return;
        const liste = resultats(donnees);
        setEtat({
          ...ETAT_INITIAL,
          elements: liste,
          total: donnees?.count ?? liste.length,
          page: 1,
          suivant: Boolean(donnees?.next),
          chargement: false,
        });
      })
      .catch((erreur) => {
        if (numero !== generation.current || erreur?.name === 'AbortError') return;
        setEtat({ ...ETAT_INITIAL, chargement: false, erreur });
      });
    return () => controleur.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [langue, essai, ...deps]);

  const voirPlus = useCallback(async () => {
    const actuel = etatActuel.current;
    if (!actuel.suivant || actuel.chargementSuite || actuel.chargement) return;
    const numero = generation.current;
    setEtat((e) => ({ ...e, chargementSuite: true, erreurSuite: null }));
    try {
      const donnees = await chargerActuel.current({ page: actuel.page + 1 });
      if (numero !== generation.current) return;
      setEtat((e) => ({
        ...e,
        elements: fusionner(e.elements, resultats(donnees)),
        total: donnees?.count ?? e.total,
        page: e.page + 1,
        suivant: Boolean(donnees?.next),
        chargementSuite: false,
      }));
    } catch (erreur) {
      if (numero !== generation.current) return;
      setEtat((e) => ({ ...e, chargementSuite: false, erreurSuite: erreur }));
    }
  }, []);

  const recharger = useCallback(() => setEssai((n) => n + 1), []);
  return { ...etat, voirPlus, recharger };
}
