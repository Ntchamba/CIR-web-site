// Sélection du client : produits gardés de côté avant de commander. Chargée seulement pour un client connecté
// (un visiteur est invité à se connecter ; un compte de l'équipe n'a pas de sélection).
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/modules/compte/AuthContext.jsx';

import * as selection from './api.js';

const SANS_SELECTION = {
  disponible: false, nombre: 0, produits: [], estSelectionne: () => false,
  ajouter: async () => null, retirer: async () => {}, vider: async () => {}, rafraichir: async () => {},
};
const SelectionContext = createContext(SANS_SELECTION);

const versEtat = (r) => ({
  produits: Array.isArray(r?.produits) ? r.produits : [],
  count: r?.count ?? r?.produits?.length ?? 0,
});

export function SelectionProvider({ children }) {
  const { utilisateur } = useAuth();
  const idClient = utilisateur && !utilisateur.est_equipe ? utilisateur.id : null;
  const [etat, setEtat] = useState({ count: 0, produits: [] });
  const { produits } = etat;

  const rafraichir = useCallback(async () => {
    try {
      setEtat(versEtat(await selection.resume()));
    } catch {
      /* le compteur reste tel quel ; la page « Ma sélection » affichera l'erreur */
    }
  }, []);

  useEffect(() => {
    let actif = true;
    setEtat({ count: 0, produits: [] });
    if (idClient) {
      selection.resume()
        .then((r) => actif && setEtat(versEtat(r)))
        .catch(() => {});
    }
    return () => {
      actif = false;
    };
  }, [idClient]);

  const ajouter = useCallback(async (produit, design) => {
    const element = await selection.ajouter(produit, design);
    setEtat((e) => (e.produits.includes(produit) ? e : { produits: [...e.produits, produit], count: e.count + 1 }));
    rafraichir();
    return element;
  }, [rafraichir]);

  const retirer = useCallback(async (id) => {
    await selection.retirer(id);
    await rafraichir();
  }, [rafraichir]);

  const vider = useCallback(async () => {
    await selection.vider();
    setEtat({ count: 0, produits: [] });
  }, []);

  const valeur = useMemo(() => ({
    disponible: Boolean(idClient),
    nombre: etat.count,
    produits,
    estSelectionne: (id) => produits.includes(id),
    ajouter, retirer, vider, rafraichir,
  }), [idClient, etat, produits, ajouter, retirer, vider, rafraichir]);

  return <SelectionContext.Provider value={valeur}>{children}</SelectionContext.Provider>;
}

/** { disponible, nombre, produits, estSelectionne(id), ajouter(produit, design), retirer(idElement), vider(), rafraichir() }. */
export function useSelection() {
  return useContext(SelectionContext);
}
