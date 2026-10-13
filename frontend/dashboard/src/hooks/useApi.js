// Charge des données de l'API et suit l'état (chargement, erreur). Annule la requête si la page change.
import { useCallback, useEffect, useRef, useState } from 'react';

export default function useApi(charger, dependances = []) {
  const [etat, setEtat] = useState({ donnees: null, chargement: true, erreur: null });
  const compteur = useRef(0);

  const recharger = useCallback(() => {
    const numero = ++compteur.current;
    const controleur = new AbortController();
    setEtat((e) => ({ ...e, chargement: true, erreur: null }));
    charger(controleur.signal)
      .then((donnees) => numero === compteur.current && setEtat({ donnees, chargement: false, erreur: null }))
      .catch((erreur) => {
        if (erreur.name !== 'AbortError' && numero === compteur.current) {
          setEtat({ donnees: null, chargement: false, erreur });
        }
      });
    return () => controleur.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependances);

  useEffect(() => recharger(), [recharger]);

  return { ...etat, recharger, modifier: (f) => setEtat((e) => ({ ...e, donnees: f(e.donnees) })) };
}
