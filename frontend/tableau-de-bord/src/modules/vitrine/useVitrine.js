// État de la vitrine : listes des réalisations et des démos, témoignages filtrés, compteur « en attente ».
import { useState } from 'react';

import { resultats } from '@/app/api.js';
import useChargement from '@/composants/useChargement.js';

import * as vitrineApi from './api.js';

/** Liste courte modifiable sur place : { elements, total, remplacer, retirer, … }. */
function useListeCourte(charger) {
  const etat = useChargement((signal) => charger({ signal }), [], { initial: { elements: [], total: 0 } });
  const { elements = [], total = 0 } = etat.donnees || {};
  const remplacer = (element) => etat.setDonnees((d) => {
    const liste = d?.elements || [];
    const existe = liste.some((e) => e.id === element.id);
    return {
      elements: existe ? liste.map((e) => (e.id === element.id ? element : e)) : [element, ...liste],
      total: existe ? d.total : (d?.total || 0) + 1,
    };
  });
  const retirer = (id) => etat.setDonnees((d) => ({
    elements: (d?.elements || []).filter((e) => e.id !== id), total: Math.max(0, (d?.total || 0) - 1),
  }));
  return { ...etat, elements, total, remplacer, retirer };
}

export const useRealisations = () => useListeCourte(vitrineApi.listerRealisations);
export const useDemos = () => useListeCourte(vitrineApi.listerDemos);

/** Compteur des témoignages en attente (menu de la vitrine). */
export function useEnAttente() {
  const etat = useChargement((signal) => vitrineApi.compterEnAttente({ signal }), [], { initial: 0 });
  return { nombre: etat.donnees ?? 0, actualiser: etat.recharger };
}

/** Témoignages filtrés par statut (en attente par défaut), paginés, avec les actions de modération. */
export default function useVitrine({ surModeration } = {}) {
  const [statut, setStatut] = useState('en_attente');
  const [page, setPage] = useState(1);
  const etat = useChargement((signal) => vitrineApi.listerTemoignages({ statut, page }, { signal }), [statut, page]);
  const temoignages = resultats(etat.donnees);
  const total = typeof etat.donnees?.count === 'number' ? etat.donnees.count : temoignages.length;

  /** Après une action : met à jour la ligne, ou la retire si elle ne correspond plus au filtre. */
  const appliquer = (maj) => {
    etat.setDonnees((d) => {
      const liste = resultats(d);
      const garder = !statut || maj.statut === statut;
      const nouvelle = garder ? liste.map((x) => (x.id === maj.id ? maj : x)) : liste.filter((x) => x.id !== maj.id);
      return { ...(d || {}), count: garder ? total : Math.max(0, total - 1), results: nouvelle };
    });
    surModeration?.();
  };

  return {
    temoignages,
    total,
    statut,
    filtrer: (valeur) => { setStatut(valeur); setPage(1); },
    page,
    allerALaPage: setPage,
    suivante: Boolean(etat.donnees?.next),
    precedente: Boolean(etat.donnees?.previous),
    chargement: etat.chargement,
    erreur: etat.erreur,
    recharger: etat.recharger,
    publier: async (id) => appliquer(await vitrineApi.publierTemoignage(id)),
    refuser: async (id, motif) => appliquer(await vitrineApi.refuserTemoignage(id, motif)),
    supprimer: async (id) => {
      await vitrineApi.supprimerTemoignage(id);
      etat.setDonnees((d) => ({ ...(d || {}), count: Math.max(0, total - 1), results: resultats(d).filter((x) => x.id !== id) }));
      surModeration?.();
    },
  };
}
