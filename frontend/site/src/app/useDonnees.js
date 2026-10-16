// Chargement d'une donnée de l'API pour une page : état de chargement, erreur, « Réessayer ».
// Le contenu de l'API arrive déjà traduit (en-tête Accept-Language) : il est rechargé quand la langue change.
//   const { donnees, chargement, erreur, recharger } = useDonnees(({ signal }) => api.get('/api/…', { signal }), [slug]);
import { useCallback, useEffect, useRef, useState } from 'react';

import { useTraduction } from '@/i18n/index.js';

export default function useDonnees(charger, deps = []) {
  const { langue } = useTraduction();
  const [etat, setEtat] = useState({ donnees: null, chargement: true, erreur: null });
  const [essai, setEssai] = useState(0);
  const chargerActuel = useRef(charger);
  const languePrecedente = useRef(langue);

  useEffect(() => {
    chargerActuel.current = charger;
  });

  useEffect(() => {
    const controleur = new AbortController();
    let actif = true;
    // Changement de langue seul : les données affichées restent visibles pendant le rechargement.
    // Autre dépendance changée (autre produit, autre actualité) : l'ancienne fiche disparaît aussitôt.
    const seuleLaLangue = languePrecedente.current !== langue;
    languePrecedente.current = langue;
    setEtat((e) => ({ donnees: seuleLaLangue ? e.donnees : null, chargement: true, erreur: null }));
    Promise.resolve()
      .then(() => chargerActuel.current({ signal: controleur.signal }))
      .then((donnees) => actif && setEtat({ donnees: donnees ?? null, chargement: false, erreur: null }))
      .catch((erreur) => {
        if (!actif || erreur?.name === 'AbortError') return;
        setEtat({ donnees: null, chargement: false, erreur });
      });
    return () => {
      actif = false;
      controleur.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [langue, essai, ...deps]);

  const recharger = useCallback(() => setEssai((n) => n + 1), []);
  return { ...etat, recharger };
}
