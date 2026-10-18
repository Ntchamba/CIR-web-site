// Données de la demande de rendu : produits du catalogue (produit de référence) et commandes du client.
import { resultats } from '@partage/api/client.js';

import useDonnees from '@/app/useDonnees.js';
import * as catalogue from '@/modules/catalogue/api.js';
import * as commandes from '@/modules/commandes/api.js';

import * as devis from './api.js';

/** Jusqu'à 100 produits du catalogue pour la liste « produit de référence » (échec : liste vide, champ facultatif). */
export function useProduitsCatalogue() {
  const { donnees } = useDonnees(({ signal }) => catalogue.produits({ taille: 100 }, { signal }).catch((e) => {
    if (e?.name === 'AbortError') throw e;
    return null;
  }), []);
  return resultats(donnees);
}

/** Commandes du client (pour rattacher la demande à l'une d'elles). */
export function useMesCommandes() {
  const { donnees } = useDonnees(({ signal }) => commandes.lister({ taille: 100 }, { signal }).catch((e) => {
    if (e?.name === 'AbortError') throw e;
    return null;
  }), []);
  return resultats(donnees);
}

/** Détail d'un devis, chargé seulement quand `ouvert` est vrai. */
export function useDevisDetail(id, ouvert) {
  return useDonnees(({ signal }) => (ouvert ? devis.devis(id, { signal }) : null), [id, ouvert]);
}
