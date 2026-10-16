// État de la page Équipe : chargement de la liste, ajout, désactivation et réactivation d'un membre.
import { useCallback, useEffect, useState } from 'react';

import * as equipeApi from './api.js';

const trierParNom = (liste) =>
  [...liste].sort((a, b) => String(a.nom_complet).localeCompare(String(b.nom_complet), 'fr'));

export default function useEquipe() {
  const [membres, setMembres] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);

  const charger = useCallback(async (signal) => {
    setChargement(true);
    setErreur(null);
    try {
      const liste = await equipeApi.listerMembres({ signal });
      setMembres(trierParNom(liste));
    } catch (e) {
      if (e?.name !== 'AbortError') setErreur(e);
    } finally {
      if (!signal?.aborted) setChargement(false);
    }
  }, []);

  useEffect(() => {
    const controleur = new AbortController();
    charger(controleur.signal);
    return () => controleur.abort();
  }, [charger]);

  const remplacer = (membre) => setMembres((liste) => liste.map((m) => (m.id === membre.id ? membre : m)));

  /** Ajoute un membre ; l'erreur du serveur (ErreurApi) est relancée pour le formulaire. */
  const ajouter = useCallback(async (donnees) => {
    const membre = await equipeApi.ajouterMembre(donnees);
    setMembres((liste) => trierParNom([...liste, membre]));
    return membre;
  }, []);

  const desactiver = useCallback(async (id) => {
    const membre = await equipeApi.desactiverMembre(id);
    remplacer(membre);
    return membre;
  }, []);

  const reactiver = useCallback(async (id) => {
    const membre = await equipeApi.reactiverMembre(id);
    remplacer(membre);
    return membre;
  }, []);

  return { membres, chargement, erreur, recharger: () => charger(), ajouter, desactiver, reactiver };
}
