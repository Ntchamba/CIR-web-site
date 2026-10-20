// État de la page Paiements (critères dans l'adresse, décomptes) et des paiements d'une commande.
// La trame `paiement_mis_a_jour` du direct met les lignes à jour sans recharger la page.
import { useCallback, useEffect, useRef } from 'react';

import useChargement from '@/composants/useChargement.js';
import { useCriteres, useRecherche } from '@/composants/useCriteres.js';
import useListe from '@/composants/useListe.js';
import { useDirect } from '@/layout/direct.js';

import { listerPaiements, resumePaiements } from './api.js';

const DELAI_RECHARGEMENT = 500; // ms : regroupe plusieurs trames d'affilée

/** Rappel à appeler à chaque trame `paiement_mis_a_jour` (avec le paiement reçu). */
function useTramePaiement(rappel) {
  const direct = useDirect();
  const courant = useRef(rappel);
  courant.current = rappel;
  useEffect(() => direct.abonner((trame) => {
    if (trame?.type === 'paiement_mis_a_jour' && trame.paiement) courant.current(trame.paiement);
  }), [direct]);
}

export default function usePaiements() {
  const { valeurs, page, modifier } = useCriteres(['etat', 'mode', 'q', 'commande']);
  const liste = useListe(listerPaiements, {
    etat: valeurs.etat, mode: valeurs.mode, commande: valeurs.commande, recherche: valeurs.q, page,
  });
  const resume = useChargement((signal) => resumePaiements({ signal }), []);
  const [saisie, changerSaisie, effacerSaisie] = useRecherche(valeurs.q, (q) => modifier({ q }));
  const { recharger, remplacer, elements } = liste;
  const rechargerResume = resume.recharger;
  const minuteur = useRef(null);
  const elementsRef = useRef(elements);
  elementsRef.current = elements;
  useEffect(() => () => clearTimeout(minuteur.current), []);

  useTramePaiement((paiement) => {
    if (elementsRef.current.some((p) => p.id === paiement.id)) remplacer(paiement);
    clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => { recharger(); rechargerResume(); }, DELAI_RECHARGEMENT);
  });

  return {
    ...liste,
    page,
    etat: valeurs.etat,
    mode: valeurs.mode,
    commande: valeurs.commande,
    resume: resume.donnees || {},
    rechargerResume,
    saisie,
    changerSaisie,
    choisirEtat: (etat) => modifier({ etat }),
    choisirMode: (mode) => modifier({ mode }),
    allerALaPage: (n) => modifier({ page: n }),
    effacer: () => { effacerSaisie(); modifier({ q: '', etat: '', mode: '', commande: '' }); },
    filtre: Boolean(valeurs.q || valeurs.etat || valeurs.mode || valeurs.commande),
  };
}

/** Paiements d'une commande (fiche commande). `surTrame()` est appelé quand l'un d'eux change en direct. */
export function usePaiementsCommande(commandeId, surTrame) {
  const etat = useChargement(
    (signal) => listerPaiements({ commande: commandeId }, { signal }),
    [commandeId],
  );
  const { recharger } = etat;
  const rappel = useCallback((paiement) => {
    if (String(paiement.commande?.id) !== String(commandeId)) return;
    recharger();
    surTrame?.();
  }, [commandeId, recharger, surTrame]);
  useTramePaiement(rappel);
  const reponse = etat.donnees;
  return {
    paiements: Array.isArray(reponse) ? reponse : reponse?.results || [],
    chargement: etat.chargement && !reponse,
    erreur: etat.erreur,
    recharger,
  };
}
