// Commandes du client : liste filtrée par étape, et détail d'une commande (mis à jour après chaque action).
import { useCallback, useEffect, useState } from 'react';

import useDonnees from '@/app/useDonnees.js';
import useListePaginee from '@/app/useListePaginee.js';

import * as catalogue from '@/modules/produit/api.js';
import * as selection from '@/modules/selection/api.js';

import * as commandes from './api.js';

export function useCommandes(etat = '') {
  return useListePaginee(
    ({ page, signal }) => commandes.lister({ etat, page: page > 1 ? page : '' }, { signal }),
    [etat],
  );
}

/** Détail d'une commande : `appliquer(detail)` remplace les données par la réponse du serveur, `actualiser()` les redemande. */
export function useCommande(id) {
  const chargement = useDonnees(({ signal }) => commandes.detail(id, { signal }), [id]);
  const [remplace, setRemplace] = useState(null);
  const { donnees } = chargement;

  // Données rechargées (autre langue, nouvel essai) : elles prennent le pas sur la réponse d'une action.
  useEffect(() => setRemplace(null), [donnees]);

  const appliquer = useCallback((detail) => setRemplace(detail), []);
  const actualiser = useCallback(async () => {
    const detail = await commandes.detail(id);
    setRemplace(detail);
    return detail;
  }, [id]);
  /** Réponse d'une action : un détail de commande est gardé tel quel, sinon on redemande la commande. */
  const apresAction = useCallback((reponse) => (reponse?.actions_possibles ? setRemplace(reponse) : actualiser()), [actualiser]);

  const commande = remplace && String(remplace.id) === String(id) ? remplace : donnees;
  return { ...chargement, commande, appliquer, actualiser, apresAction };
}

/**
 * Produits d'une nouvelle commande : ceux de la sélection du client (par défaut) ou un seul produit choisi sur sa
 * fiche (`?produit=<slug>&design=<id>`). Renvoie `{ lignes: [{ cle, produit, design, nom, reference, designNom, disponible }], … }`.
 */
export function useLignesNouvelleCommande(slug, designId) {
  const depuisSelection = !slug;
  const donnees = useDonnees(({ signal }) => (
    depuisSelection ? selection.lister({ signal }) : catalogue.produit(slug, { signal })
  ), [slug]);
  let lignes = [];
  if (donnees.donnees && depuisSelection) {
    lignes = (donnees.donnees.elements || []).map((e) => ({
      cle: String(e.id),
      produit: e.produit?.id,
      design: e.design?.id ?? null,
      nom: e.produit?.nom,
      reference: e.produit?.reference,
      designNom: e.design?.nom || '',
      disponible: e.disponible !== false,
    }));
  } else if (donnees.donnees) {
    const p = donnees.donnees;
    const design = (p.designs || []).find((d) => String(d.id) === String(designId)) || null;
    lignes = [{
      cle: String(p.id), produit: p.id, design: design?.id ?? null, nom: p.nom, reference: p.reference,
      designNom: design?.nom || '', disponible: true,
    }];
  }
  return { ...donnees, depuisSelection, lignes };
}
