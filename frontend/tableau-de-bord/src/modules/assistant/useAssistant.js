// États des écrans de l'assistant : statut du service (partagé par les boutons de brouillon), brouillons, journal.
import { useEffect, useState } from 'react';

import useChargement from '@/composants/useChargement.js';
import { useCriteres } from '@/composants/useCriteres.js';
import useListe from '@/composants/useListe.js';

import {
  listerBrouillons, listerConversations, listerJournal, resumeJournal, statutAssistant, statutAssistantEnCache,
} from './api.js';

/**
 * Le service d'assistant est-il configuré ? `true` seulement si `statut/` l'affirme : pendant le chargement, en cas
 * d'erreur (403, réseau) ou de réponse inattendue, les boutons de brouillon restent masqués.
 */
export function useAssistantDisponible() {
  const [disponible, setDisponible] = useState(false);
  useEffect(() => {
    let actif = true;
    statutAssistantEnCache()
      .then((statut) => { if (actif) setDisponible(statut?.configure === true); })
      .catch(() => { if (actif) setDisponible(false); });
    return () => { actif = false; };
  }, []);
  return disponible;
}

/** Statut complet pour l'onglet « Statut et usage » (toujours rechargé). */
export const useStatut = () => useChargement((signal) => statutAssistant({ signal }), []);

export function useBrouillons() {
  const { valeurs, page, modifier } = useCriteres(['type', 'etat']);
  const liste = useListe(listerBrouillons, { type: valeurs.type, etat: valeurs.etat, page });
  return {
    ...liste,
    page,
    type: valeurs.type,
    etat: valeurs.etat,
    choisirType: (type) => modifier({ type }),
    choisirEtat: (etat) => modifier({ etat }),
    allerALaPage: (n) => modifier({ page: n }),
    effacer: () => modifier({ type: '', etat: '' }),
    filtre: Boolean(valeurs.type || valeurs.etat),
  };
}

export function useJournal() {
  const { valeurs, page, modifier } = useCriteres(['agent', 'resultat']);
  const liste = useListe(listerJournal, { agent: valeurs.agent, resultat: valeurs.resultat, page });
  const resume = useChargement((signal) => resumeJournal({ signal }), []);
  return {
    ...liste,
    page,
    agent: valeurs.agent,
    resultat: valeurs.resultat,
    resume: resume.donnees || null,
    choisirAgent: (agent) => modifier({ agent }),
    choisirResultat: (resultat) => modifier({ resultat }),
    allerALaPage: (n) => modifier({ page: n }),
    effacer: () => modifier({ agent: '', resultat: '' }),
    filtre: Boolean(valeurs.agent || valeurs.resultat),
  };
}

/** Pages de conversations, lues seulement si `actif` (super-administrateur). */
export function useConversations(actif) {
  const [page, setPage] = useState(1);
  const liste = useListe(
    (criteres, options) => (actif ? listerConversations(criteres, options) : Promise.resolve({ results: [], count: 0 })),
    { page, actif },
  );
  return { ...liste, page, allerALaPage: setPage };
}
