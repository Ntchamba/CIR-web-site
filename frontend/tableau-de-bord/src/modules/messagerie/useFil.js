// Fil de messages d'une conversation : chargement (30 derniers), historique en remontant (`avant`), rattrapage
// après une coupure (`apres`), réception en direct, envoi optimiste avec `cle_client`, « lu » et « écrit… ».
import { useCallback, useEffect, useRef, useState } from 'react';

import { resultats } from '@/app/api.js';
import { useDirect } from '@/layout/direct.js';

import { envoyerAvecFichiers, envoyerTexte, listerMessages } from './api.js';

export const TAILLE = 30;
const DELAI_CONFIRMATION = 8000; // ms sans confirmation du WebSocket avant de réessayer par HTTP
const DELAI_ECRIT = 4000;

export const estReel = (m) => typeof m.id === 'number';
const nouvelleCle = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`).slice(0, 64);

/** Messages réels triés par identifiant, puis les messages en cours d'envoi dans l'ordre d'envoi. */
export function ordonner(liste) {
  return [...liste.filter(estReel).sort((a, b) => a.id - b.id), ...liste.filter((m) => !estReel(m))];
}

/** Ajoute ou remplace des messages (par identifiant, ou par `cle_client` pour confirmer un envoi optimiste). */
export function fusionner(liste, nouveaux) {
  const resultat = [...liste];
  nouveaux.forEach((m) => {
    const i = resultat.findIndex((x) => (estReel(x) && x.id === m.id) || (!estReel(x) && m.cle_client && x.cle_client === m.cle_client));
    if (i < 0) resultat.push(m);
    else resultat[i] = estReel(resultat[i]) ? { ...resultat[i], ...m } : m;
  });
  return ordonner(resultat);
}

export default function useFil(conversationId) {
  const direct = useDirect();
  const [messages, setMessages] = useState([]);
  const [aPlus, setAPlus] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [chargementPlus, setChargementPlus] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [ecrit, setEcrit] = useState(false);
  const [essai, setEssai] = useState(0);
  const messagesRef = useRef([]);
  messagesRef.current = messages;
  const idRef = useRef(conversationId);
  idRef.current = conversationId;
  const directRef = useRef(direct);
  directRef.current = direct;
  const minuteurs = useRef({});
  const aCoupe = useRef(false);

  // Chargement initial à chaque conversation.
  useEffect(() => {
    setMessages([]);
    setAPlus(false);
    setErreur(null);
    setEcrit(false);
    if (!conversationId) { setChargement(false); return undefined; }
    const controleur = new AbortController();
    setChargement(true);
    listerMessages(conversationId, { taille: TAILLE }, { signal: controleur.signal })
      .then((r) => {
        setMessages((p) => fusionner(p, resultats(r)));
        setAPlus(Boolean(r?.a_plus));
        setChargement(false);
      })
      .catch((e) => {
        if (e?.name === 'AbortError') return;
        setErreur(e);
        setChargement(false);
      });
    return () => controleur.abort();
  }, [conversationId, essai]);

  // Nettoyage des minuteurs à chaque changement de conversation et au démontage.
  useEffect(() => () => {
    Object.values(minuteurs.current).forEach(clearTimeout);
    minuteurs.current = {};
  }, [conversationId]);

  const chargerPlus = useCallback(async () => {
    const id = idRef.current;
    const premier = messagesRef.current.find(estReel);
    if (!id || !premier) return false;
    setChargementPlus(true);
    try {
      const r = await listerMessages(id, { avant: premier.id, taille: TAILLE });
      if (idRef.current !== id) return false;
      setMessages((p) => fusionner(p, resultats(r)));
      setAPlus(Boolean(r?.a_plus));
      return true;
    } catch (e) {
      setErreur(e);
      return false;
    } finally {
      setChargementPlus(false);
    }
  }, []);

  // Rattrapage des messages manqués pendant une coupure.
  const rattraper = useCallback(async () => {
    const id = idRef.current;
    if (!id) return;
    let dernier = messagesRef.current.filter(estReel).at(-1)?.id;
    try {
      for (let tour = 0; tour < 20; tour += 1) {
        const r = await listerMessages(id, { apres: dernier, taille: 100 });
        if (idRef.current !== id) return;
        const liste = resultats(r);
        if (liste.length) setMessages((p) => fusionner(p, liste));
        if (!r?.a_plus || !liste.length) break;
        dernier = liste.at(-1).id;
      }
    } catch { /* la prochaine reconnexion réessaiera */ }
  }, []);

  useEffect(() => {
    if (direct.etat === 'connecte') {
      if (aCoupe.current) { aCoupe.current = false; rattraper(); }
    } else if (direct.etat === 'coupe') {
      aCoupe.current = true;
    }
  }, [direct.etat, rattraper]);

  const modifierLocal = useCallback((cle, champs) => {
    setMessages((p) => p.map((m) => (!estReel(m) && m.cle_client === cle ? { ...m, ...champs } : m)));
  }, []);

  // Envoi HTTP (pièces jointes, WebSocket indisponible ou sans confirmation). La même `cle_client` évite tout doublon.
  const transmettre = useCallback(async (local) => {
    const id = idRef.current;
    modifierLocal(local.cle_client, { etat: 'envoi', erreur: '' });
    const donnees = { texte: local.texte, commande: local.commande?.id, cle_client: local.cle_client };
    try {
      const m = local.fichiers?.length
        ? await envoyerAvecFichiers(id, { ...donnees, fichiers: local.fichiers })
        : await envoyerTexte(id, donnees);
      if (idRef.current === id) setMessages((p) => fusionner(p, [m]));
    } catch (e) {
      if (idRef.current === id) modifierLocal(local.cle_client, { etat: 'echec', erreur: e.message });
    }
  }, [modifierLocal]);

  const envoyer = useCallback(({ texte = '', fichiers = [], commande = null }) => {
    const id = idRef.current;
    const cle = nouvelleCle();
    const local = {
      id: `local-${cle}`,
      conversation: id,
      auteur_role: 'equipe',
      auteur_nom: '',
      texte,
      commande,
      pieces_jointes: fichiers.map((f, i) => ({
        id: `${cle}-${i}`, nom_original: f.name, type: f.type?.startsWith('image/') ? 'image' : 'document', taille: f.size, local: true,
      })),
      fichiers,
      cree_le: new Date().toISOString(),
      lu_le: null,
      cle_client: cle,
      etat: 'envoi',
    };
    setMessages((p) => [...p, local]);
    if (!fichiers.length && directRef.current.etat === 'connecte') {
      directRef.current.envoyer({
        type: 'envoyer', texte, conversation: id, cle_client: cle, ...(commande ? { commande: commande.id } : {}),
      });
      minuteurs.current[cle] = setTimeout(() => {
        const encore = messagesRef.current.find((m) => !estReel(m) && m.cle_client === cle && m.etat === 'envoi');
        if (encore) transmettre(encore);
      }, DELAI_CONFIRMATION);
    } else {
      transmettre(local);
    }
  }, [transmettre]);

  const reessayer = useCallback((cle) => {
    const local = messagesRef.current.find((m) => !estReel(m) && m.cle_client === cle);
    if (local) transmettre(local);
  }, [transmettre]);

  // Trames du serveur.
  useEffect(() => direct.abonner((trame) => {
    const id = idRef.current;
    if (!id) return;
    if (trame.type === 'message' && trame.message?.conversation === id) {
      setMessages((p) => fusionner(p, [trame.message]));
      if (trame.message.auteur_role === 'client') setEcrit(false);
    } else if (trame.type === 'lu' && trame.conversation === id && trame.par === 'client') {
      const maintenant = new Date().toISOString();
      setMessages((p) => p.map((m) => (estReel(m) && m.auteur_role === 'equipe' && m.id <= trame.jusqu_a && !m.lu_le
        ? { ...m, lu_le: maintenant } : m)));
    } else if (trame.type === 'ecrit' && trame.conversation === id && trame.par === 'client') {
      setEcrit(true);
      clearTimeout(minuteurs.current.ecrit);
      minuteurs.current.ecrit = setTimeout(() => setEcrit(false), DELAI_ECRIT);
    } else if (trame.type === 'erreur') {
      // Le plus ancien envoi en attente est celui que le serveur vient de refuser.
      const refuse = messagesRef.current.find((m) => !estReel(m) && m.etat === 'envoi');
      if (refuse) {
        clearTimeout(minuteurs.current[refuse.cle_client]);
        modifierLocal(refuse.cle_client, { etat: 'echec', erreur: trame.detail || '' });
      }
    }
  }), [direct, modifierLocal]);

  return {
    messages, aPlus, chargement, chargementPlus, erreur, ecrit, chargerPlus, envoyer, reessayer,
    recharger: () => setEssai((n) => n + 1),
  };
}
