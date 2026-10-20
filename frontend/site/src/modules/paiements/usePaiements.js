// Paiements du client : disponibilité du service, liste d'une commande, suivi en direct d'un paiement.
import { useCallback, useEffect, useRef, useState } from 'react';

import { resultats } from '@partage/api/client.js';

import useDonnees from '@/app/useDonnees.js';
import { useDirect, useEvenementsDirect } from '@/modules/notifications/FondDirect.jsx';

import * as paiements from './api.js';
import { DELAI_VERIFICATION_MS, fusionner } from './regles.js';

/** `configure` est vrai seulement si le serveur le dit ; en cas d'erreur, on masque le bouton (jamais d'erreur bloquante). */
export function useDisponibilite() {
  const etat = useDonnees(({ signal }) => paiements.disponibilite({ signal }), []);
  return { ...etat, configure: etat.donnees?.configure === true };
}

/** Paiements d'une commande, tenus à jour par la trame `paiement_mis_a_jour` et le rattrapage après une coupure. */
export function usePaiementsCommande(commandeId, { surReussi } = {}) {
  const chargement = useDonnees(({ signal }) => paiements.lister({ commande: commandeId }, { signal }), [commandeId]);
  const [remplaces, setRemplaces] = useState({});
  const { rattrapage } = useDirect();
  const { recharger } = chargement;
  const dernierReussi = useRef(surReussi);
  useEffect(() => {
    dernierReussi.current = surReussi;
  });
  useEffect(() => setRemplaces({}), [chargement.donnees]);

  const premier = useRef(rattrapage);
  useEffect(() => {
    if (premier.current !== rattrapage) recharger();
  }, [rattrapage, recharger]);

  useEvenementsDirect((trame) => {
    if (trame?.type !== 'paiement_mis_a_jour' || !trame.paiement) return;
    const p = trame.paiement;
    if (String(p.commande?.id) !== String(commandeId)) return;
    setRemplaces((r) => ({ ...r, [p.id]: p }));
    if (p.etat === 'reussi') dernierReussi.current?.(p);
  });

  const liste = resultats(chargement.donnees).map((p) => fusionner(p, remplaces[p.id]));
  // Un paiement annoncé par la trame mais absent de la liste (créé depuis un autre appareil) est ajouté en tête.
  Object.values(remplaces).forEach((p) => {
    if (!liste.some((x) => x.id === p.id)) liste.unshift(p);
  });
  return { ...chargement, paiements: liste, enAttente: liste.find((p) => p.etat === 'en_attente') || null };
}

/**
 * Suivi d'un paiement : trame `paiement_mis_a_jour` du WebSocket, avec repli sur GET <id>/ toutes les 4 secondes
 * tant que le paiement est en attente (et à chaque retour du direct). Chaque lecture fait revérifier le serveur.
 */
export function useSuiviPaiement(initial) {
  const [paiement, setPaiement] = useState(initial);
  const id = initial?.id;
  const enCours = useRef(false);
  const { rattrapage } = useDirect();

  useEffect(() => setPaiement(initial), [initial]);

  const verifier = useCallback(async () => {
    if (enCours.current || !id) return;
    enCours.current = true;
    try {
      const recu = await paiements.detail(id);
      setPaiement((courant) => fusionner(courant, recu));
    } catch {
      /* échec passager : la prochaine lecture réessaiera */
    } finally {
      enCours.current = false;
    }
  }, [id]);

  useEvenementsDirect((trame) => {
    if (trame?.type === 'paiement_mis_a_jour' && trame.paiement?.id === id) {
      setPaiement((courant) => fusionner(courant, trame.paiement));
    }
  });

  const attend = paiement?.etat === 'en_attente';
  useEffect(() => {
    if (!attend) return undefined;
    verifier();
    const minuteur = setInterval(verifier, DELAI_VERIFICATION_MS);
    return () => clearInterval(minuteur);
  }, [attend, verifier, rattrapage]);

  return { paiement, setPaiement, verifier };
}

/** Reçu d'un paiement réussi. */
export function useRecu(id) {
  return useDonnees(({ signal }) => paiements.recu(id, { signal }), [id]);
}
