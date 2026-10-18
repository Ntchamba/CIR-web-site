// État des pages Commandes : liste filtrée (critères dans l'adresse de la page), décomptes par étape, détail.
import { useCallback } from 'react';

import { useCriteres, useRecherche } from '@/composants/useCriteres.js';
import useChargement from '@/composants/useChargement.js';
import useListe from '@/composants/useListe.js';

import { listerCommandes, obtenirCommande, resumeCommandes } from './api.js';

/** Étapes dans l'ordre de la frise (les clés sont celles de STATUTS). `annulee` est à part. */
export const ETAPES = ['nouvelle', 'negociation', 'contrat_signe', 'travaux', 'terminee'];
export const ONGLETS = [...ETAPES, 'annulee'];

export default function useCommandes() {
  const { valeurs, page, modifier } = useCriteres(['etat', 'q', 'action']);
  const criteres = { etat: valeurs.etat, recherche: valeurs.q, actionRequise: valeurs.action, page };
  const liste = useListe(listerCommandes, criteres);
  const resume = useChargement((signal) => resumeCommandes({ signal }), []);
  const [saisie, changerSaisie, effacerSaisie] = useRecherche(valeurs.q, (q) => modifier({ q }));
  return {
    ...liste,
    page,
    etat: valeurs.etat,
    action: valeurs.action === '1',
    recherche: valeurs.q,
    resume: resume.donnees || {},
    saisie,
    changerSaisie,
    choisirEtat: (etat) => modifier({ etat }),
    basculerAction: (actif) => modifier({ action: actif ? '1' : '' }),
    allerALaPage: (n) => modifier({ page: n }),
    effacer: () => { effacerSaisie(); modifier({ q: '', action: '', etat: '' }); },
    filtre: Boolean(valeurs.q || valeurs.action || valeurs.etat),
  };
}

/** Détail d'une commande. `actualiser()` recharge sans vider la page ; `remplacer(detail)` pose un détail reçu du serveur. */
export function useCommande(id) {
  const etat = useChargement((signal) => obtenirCommande(id, { signal }), [id]);
  const { setDonnees } = etat;
  const actualiser = useCallback(() => obtenirCommande(id).then((d) => { setDonnees(d); return d; }), [id, setDonnees]);
  return { ...etat, commande: etat.donnees, remplacer: setDonnees, actualiser };
}
