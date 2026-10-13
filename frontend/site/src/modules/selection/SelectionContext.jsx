// BF-09 : sélection de produits et de designs.
// Visiteur : la sélection est gardée dans le navigateur. Client connecté : elle est enregistrée sur
// le serveur, et ce qui avait été choisi avant la connexion y est ajouté.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api } from '@/lib/api.js';

import { useAuth } from '../compte/AuthContext.jsx';

const CLE = 'cir-site.selection';
const SelectionContext = createContext(null);

const lireLocale = () => { try { return JSON.parse(localStorage.getItem(CLE)) || []; } catch { return []; } };
const ecrireLocale = (slugs) => { try { localStorage.setItem(CLE, JSON.stringify(slugs)); } catch { /* ignoré */ } };

export function SelectionProvider({ children }) {
  const { utilisateur } = useAuth();
  const [elements, setElements] = useState([]); // [{ produit: slug, produit_detail?, surface_m2? }]

  const recharger = useCallback(async () => {
    if (!utilisateur) {
      setElements(lireLocale().map((slug) => ({ produit: slug })));
      return;
    }
    const locaux = lireLocale();
    const liste = locaux.length
      ? await api.post('/selection/fusionner/', { produits: locaux })
      : await api.get('/selection/');
    ecrireLocale([]);
    setElements(liste);
  }, [utilisateur]);

  useEffect(() => { recharger().catch(() => {}); }, [recharger]);

  const contient = useCallback((slug) => elements.some((e) => e.produit === slug), [elements]);

  const ajouter = useCallback(async (slug) => {
    if (!utilisateur) {
      const slugs = [...new Set([...lireLocale(), slug])];
      ecrireLocale(slugs);
      setElements(slugs.map((s) => ({ produit: s })));
      return;
    }
    const element = await api.post('/selection/', { produit: slug });
    setElements((liste) => [element, ...liste.filter((e) => e.produit !== slug)]);
  }, [utilisateur]);

  const retirer = useCallback(async (slug) => {
    if (!utilisateur) {
      const slugs = lireLocale().filter((s) => s !== slug);
      ecrireLocale(slugs);
      setElements(slugs.map((s) => ({ produit: s })));
      return;
    }
    const element = elements.find((e) => e.produit === slug);
    if (element?.id) await api.supprimer(`/selection/${element.id}/`);
    setElements((liste) => liste.filter((e) => e.produit !== slug));
  }, [utilisateur, elements]);

  const modifierSurface = useCallback(async (slug, surface) => {
    const element = elements.find((e) => e.produit === slug);
    if (!element?.id) return;
    const maj = await api.patch(`/selection/${element.id}/`, { surface_m2: surface || null });
    setElements((liste) => liste.map((e) => (e.produit === slug ? maj : e)));
  }, [elements]);

  const valeur = useMemo(() => ({
    elements, nombre: elements.length, contient, ajouter, retirer, modifierSurface, recharger,
    basculer: (slug) => (contient(slug) ? retirer(slug) : ajouter(slug)),
  }), [elements, contient, ajouter, retirer, modifierSurface, recharger]);

  return <SelectionContext.Provider value={valeur}>{children}</SelectionContext.Provider>;
}

export function useSelection() {
  return useContext(SelectionContext);
}
