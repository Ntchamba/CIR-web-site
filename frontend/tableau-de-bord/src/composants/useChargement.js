// Chargement d'une ressource de l'API : état de chargement, erreur, rechargement, annulation au démontage.
//   const { donnees, setDonnees, chargement, erreur, recharger } = useChargement((signal) => lister({ signal }), [filtre]);
import { useCallback, useEffect, useRef, useState } from 'react';

export default function useChargement(charger, dependances = [], { initial = null } = {}) {
  const [donnees, setDonnees] = useState(initial);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [essai, setEssai] = useState(0);
  const chargeur = useRef(charger);
  chargeur.current = charger;

  useEffect(() => {
    const controleur = new AbortController();
    setChargement(true);
    setErreur(null);
    Promise.resolve()
      .then(() => chargeur.current(controleur.signal))
      .then((reponse) => {
        if (controleur.signal.aborted) return;
        setDonnees(reponse);
        setChargement(false);
      })
      .catch((e) => {
        if (e?.name === 'AbortError' || controleur.signal.aborted) return;
        setErreur(e);
        setChargement(false);
      });
    return () => controleur.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependances, essai]);

  const recharger = useCallback(() => setEssai((n) => n + 1), []);
  return { donnees, setDonnees, chargement, erreur, recharger };
}
