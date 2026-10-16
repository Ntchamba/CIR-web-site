// État du catalogue : familles, liste filtrée des produits (recherche différée), fiche d'un produit.
import { useEffect, useState } from 'react';

import { resultats } from '@/app/api.js';
import useChargement from '@/composants/useChargement.js';

import * as catalogueApi from './api.js';

const DELAI_RECHERCHE = 300; // ms

/** Familles du catalogue (petite liste), triées par ordre puis par nom. */
export function useFamilles() {
  const etat = useChargement((signal) => catalogueApi.listerFamilles({ signal }), [], { initial: [] });
  const familles = [...(etat.donnees || [])].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0)
    || String(a.nom).localeCompare(String(b.nom)));
  const remplacer = (famille) => etat.setDonnees((liste) => {
    const existe = (liste || []).some((f) => f.id === famille.id);
    return existe ? liste.map((f) => (f.id === famille.id ? famille : f)) : [...(liste || []), famille];
  });
  const retirer = (id) => etat.setDonnees((liste) => (liste || []).filter((f) => f.id !== id));
  return { ...etat, familles, remplacer, retirer };
}

/** Liste des produits avec filtres (famille, en ligne / hors ligne, recherche) et pagination. */
export default function useCatalogue() {
  const [criteres, setCriteres] = useState({ famille: '', enLigne: '', recherche: '', page: 1 });
  const [saisie, setSaisie] = useState('');

  useEffect(() => {
    if (saisie.trim() === criteres.recherche) return undefined;
    const minuteur = setTimeout(() => setCriteres((c) => ({ ...c, recherche: saisie.trim(), page: 1 })), DELAI_RECHERCHE);
    return () => clearTimeout(minuteur);
  }, [saisie, criteres.recherche]);

  const etat = useChargement((signal) => catalogueApi.listerProduits(criteres, { signal }),
    [criteres.famille, criteres.enLigne, criteres.recherche, criteres.page]);
  const produits = resultats(etat.donnees);
  const total = typeof etat.donnees?.count === 'number' ? etat.donnees.count : produits.length;

  /** Met à jour un produit de la liste (ou l'ajoute en tête après une création). */
  const remplacer = (produit) => etat.setDonnees((d) => {
    const liste = resultats(d);
    const existe = liste.some((p) => p.id === produit.id);
    const nouvelle = existe ? liste.map((p) => (p.id === produit.id ? produit : p)) : [produit, ...liste];
    return Array.isArray(d) ? nouvelle : { ...(d || {}), count: existe ? total : total + 1, results: nouvelle };
  });
  const retirer = (id) => etat.setDonnees((d) => {
    const nouvelle = resultats(d).filter((p) => p.id !== id);
    return Array.isArray(d) ? nouvelle : { ...(d || {}), count: Math.max(0, total - 1), results: nouvelle };
  });

  return {
    produits,
    total,
    suivante: Boolean(etat.donnees?.next),
    precedente: Boolean(etat.donnees?.previous),
    criteres,
    saisie,
    changerSaisie: setSaisie,
    filtrer: (champ, valeur) => setCriteres((c) => ({ ...c, [champ]: valeur, page: 1 })),
    allerALaPage: (page) => setCriteres((c) => ({ ...c, page })),
    effacer: () => { setSaisie(''); setCriteres({ famille: '', enLigne: '', recherche: '', page: 1 }); },
    filtre: Boolean(criteres.famille || criteres.enLigne || criteres.recherche),
    chargement: etat.chargement,
    erreur: etat.erreur,
    recharger: etat.recharger,
    remplacer,
    retirer,
  };
}

/** Fiche complète d'un produit (null tant qu'il n'est pas créé). */
export function useProduit(id) {
  return useChargement((signal) => (id ? catalogueApi.obtenirProduit(id, { signal }) : null), [id]);
}

/** Produits proposés dans les listes de choix des autres modules (réalisations, actualités, sphère). */
export function useProduitsChoix() {
  const etat = useChargement((signal) => catalogueApi.listerProduitsChoix({ signal }), [], { initial: [] });
  const produits = [...(etat.donnees || [])].sort((a, b) => String(a.nom).localeCompare(String(b.nom)));
  return { produits, chargement: etat.chargement, erreur: etat.erreur, recharger: etat.recharger };
}
