// Accueil : contenus éditables, produits à la une, aperçu des réalisations (rechargés si la langue change).
import { resultats } from '@partage/api/client.js';

import useDonnees from '@/app/useDonnees.js';
import { useContenusAccueil } from '@/layout/contenus.js';

import * as api from './api.js';

export default function useAccueil() {
  const contenus = useContenusAccueil();
  const aLaUne = useDonnees(({ signal }) => api.produitsALaUne({ signal }), []);
  const realisations = useDonnees(({ signal }) => api.dernieresRealisations({ signal }), []);
  return {
    contenu: contenus.donnees || {},
    chargementContenu: contenus.chargement,
    aLaUne: resultats(aLaUne.donnees),
    realisations: resultats(realisations.donnees),
  };
}
