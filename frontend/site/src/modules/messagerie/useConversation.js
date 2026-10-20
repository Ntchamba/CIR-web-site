// Conversation du client avec l'équipe : historique, envoi optimiste, événements en direct, rattrapage, « lu ».
//   const c = useConversation({ lectureActive });
// `lectureActive` : vrai quand la page est visible et que le bas du fil est atteint (alors les messages de
// l'équipe sont marqués lus).
import { useCallback, useEffect, useRef, useState } from 'react';

import { resultats } from '@partage/api/client.js';

import { useDirect, useEvenementsDirect } from '@/modules/notifications/FondDirect.jsx';

import * as messagerie from './api.js';
import { fusionner, nouvelleCle, trier } from './regles.js';

export const TAILLE_PAGE = 30;
export const DELAI_CONFIRMATION = 10_000; // sans confirmation du direct, l'envoi repasse par HTTP
export const DELAI_ECRIT = 5_000; // « l'équipe écrit… » s'efface seul
const PAUSE_ECRIT = 3_000;

export default function useConversation({ lectureActive = false } = {}) {
  const direct = useDirect();
  const directRef = useRef(direct);
  directRef.current = direct;

  const [messages, setMessages] = useState([]);
  const messagesRef = useRef([]);
  const [aPlus, setAPlus] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [chargementAvant, setChargementAvant] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [equipeEcrit, setEquipeEcrit] = useState(false);
  const minuteurs = useRef(new Map()); // clé client → délai de confirmation
  const minuteurEcrit = useRef(null);
  const dernierEcrit = useRef(0);
  const dernierLuEnvoye = useRef(0);
  const vivant = useRef(true);

  const poser = useCallback((fonction) => {
    setMessages((anciens) => {
      const suivants = typeof fonction === 'function' ? fonction(anciens) : fonction;
      messagesRef.current = suivants;
      return suivants;
    });
  }, []);

  useEffect(() => {
    vivant.current = true;
    const lesMinuteurs = minuteurs.current;
    return () => {
      vivant.current = false;
      lesMinuteurs.forEach((m) => clearTimeout(m));
      lesMinuteurs.clear();
      clearTimeout(minuteurEcrit.current);
    };
  }, []);

  const ajouterListe = useCallback((liste) => {
    poser((anciens) => liste.reduce((acc, m) => fusionner(acc, m), anciens));
  }, [poser]);

  // Premier chargement : les 30 derniers messages.
  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const reponse = await messagerie.messages({ taille: TAILLE_PAGE });
      if (!vivant.current) return;
      ajouterListe(resultats(reponse));
      setAPlus(Boolean(reponse?.a_plus));
    } catch (e) {
      if (vivant.current) setErreur(e);
    } finally {
      if (vivant.current) setChargement(false);
    }
  }, [ajouterListe]);

  useEffect(() => {
    charger();
  }, [charger]);

  // Historique : les messages avant le plus ancien connu.
  const chargerAvant = useCallback(async () => {
    const premier = messagesRef.current.find((m) => m.id !== null && m.id !== undefined);
    if (!premier || chargementAvant) return;
    setChargementAvant(true);
    setErreur(null);
    try {
      const reponse = await messagerie.messages({ avant: premier.id, taille: TAILLE_PAGE });
      if (!vivant.current) return;
      ajouterListe(resultats(reponse));
      setAPlus(Boolean(reponse?.a_plus));
    } catch (e) {
      if (vivant.current) setErreur(e);
    } finally {
      if (vivant.current) setChargementAvant(false);
    }
  }, [ajouterListe, chargementAvant]);

  // Rattrapage : les messages manqués pendant une coupure (`apres` le dernier connu).
  const rattraper = useCallback(async () => {
    let dernier = Math.max(0, ...messagesRef.current.map((m) => m.id ?? 0));
    if (!dernier) {
      await charger();
      return;
    }
    try {
      for (let tour = 0; tour < 5; tour += 1) {
        const reponse = await messagerie.messages({ apres: dernier, taille: 100 });
        if (!vivant.current) return;
        const liste = resultats(reponse);
        if (liste.length) ajouterListe(liste);
        dernier = Math.max(dernier, ...liste.map((m) => m.id ?? 0));
        if (!reponse?.a_plus || !liste.length) break;
      }
    } catch {
      /* le prochain rattrapage reprendra */
    }
  }, [ajouterListe, charger]);

  const rattrapageVu = useRef(direct.rattrapage);
  useEffect(() => {
    if (direct.rattrapage !== rattrapageVu.current) {
      rattrapageVu.current = direct.rattrapage;
      rattraper();
    }
  }, [direct.rattrapage, rattraper]);

  const oublierMinuteur = useCallback((cle) => {
    clearTimeout(minuteurs.current.get(cle));
    minuteurs.current.delete(cle);
  }, []);

  const echec = useCallback((cle, e) => {
    oublierMinuteur(cle);
    poser((anciens) => anciens.map((m) => (m.cle_client === cle && m.id === null
      ? { ...m, statut: 'echec', erreur: e?.message || '', code: e?.donnees?.code || e?.code || '' }
      : m)));
  }, [oublierMinuteur, poser]);

  const envoyerHttp = useCallback(async (local) => {
    oublierMinuteur(local.cle_client);
    poser((anciens) => anciens.map((m) => (m.cle_client === local.cle_client && m.id === null
      ? { ...m, statut: 'envoi', erreur: '' } : m)));
    try {
      let message;
      if (local.fichiers?.length) {
        const formulaire = new FormData();
        if (local.texte) formulaire.append('texte', local.texte);
        if (local.commande) formulaire.append('commande', String(local.commande.id));
        formulaire.append('cle_client', local.cle_client);
        local.fichiers.forEach((f) => formulaire.append('fichiers', f));
        message = await messagerie.envoyerAvecFichiers(formulaire);
      } else {
        message = await messagerie.envoyer({
          texte: local.texte,
          ...(local.commande ? { commande: local.commande.id } : {}),
          cle_client: local.cle_client,
        });
      }
      if (vivant.current && message) poser((anciens) => fusionner(anciens, message));
    } catch (e) {
      if (vivant.current) echec(local.cle_client, e);
    }
  }, [echec, oublierMinuteur, poser]);

  /** Envoi optimiste : le message s'affiche tout de suite, puis passe à « envoyé » à la confirmation. */
  const envoyer = useCallback(({ texte, commande = null, fichiers = [] }) => {
    const cle = nouvelleCle();
    const local = {
      id: null,
      cle_client: cle,
      auteur_role: 'client',
      texte,
      commande: commande ? { id: commande.id, reference: commande.reference } : null,
      pieces_jointes: fichiers.map((f) => ({ id: `${cle}-${f.name}`, nom_original: f.name, type: f.type.startsWith('image/') ? 'image' : 'document', taille: f.size, local: f })),
      cree_le: new Date().toISOString(),
      lu_le: null,
      statut: 'envoi',
      fichiers,
    };
    poser((anciens) => trier([...anciens, local]));
    const { etat, envoyer: envoyerTrame } = directRef.current;
    if (!fichiers.length && etat === 'connecte') {
      envoyerTrame({
        type: 'envoyer', texte, cle_client: cle, ...(commande ? { commande: commande.id } : {}),
      });
      // Pas de confirmation à temps : on rejoue par HTTP (la même `cle_client` évite tout doublon).
      minuteurs.current.set(cle, setTimeout(() => {
        const encore = messagesRef.current.find((m) => m.cle_client === cle && m.id === null && m.statut === 'envoi');
        if (encore && vivant.current) envoyerHttp(encore);
      }, DELAI_CONFIRMATION));
    } else {
      envoyerHttp(local);
    }
    return cle;
  }, [envoyerHttp, poser]);

  const reessayer = useCallback((cle) => {
    const local = messagesRef.current.find((m) => m.cle_client === cle && m.id === null);
    if (local) envoyerHttp(local);
  }, [envoyerHttp]);

  const retirer = useCallback((cle) => {
    oublierMinuteur(cle);
    poser((anciens) => anciens.filter((m) => !(m.cle_client === cle && m.id === null)));
  }, [oublierMinuteur, poser]);

  const signalerEcriture = useCallback(() => {
    const maintenant = Date.now();
    if (maintenant - dernierEcrit.current < PAUSE_ECRIT) return;
    dernierEcrit.current = maintenant;
    if (directRef.current.etat === 'connecte') directRef.current.envoyer({ type: 'ecrit' });
  }, []);

  // Événements en direct.
  useEvenementsDirect((trame) => {
    if (trame.type === 'message' && trame.message) {
      const message = trame.message;
      oublierMinuteur(message.cle_client);
      poser((anciens) => fusionner(anciens, message));
      if (message.auteur_role === 'equipe') setEquipeEcrit(false);
    } else if (trame.type === 'lu' && trame.par === 'equipe') {
      const quand = new Date().toISOString();
      poser((anciens) => anciens.map((m) => (m.auteur_role === 'client' && m.id !== null && m.id <= trame.jusqu_a && !m.lu_le
        ? { ...m, lu_le: quand } : m)));
    } else if (trame.type === 'ecrit' && trame.par === 'equipe') {
      setEquipeEcrit(true);
      clearTimeout(minuteurEcrit.current);
      minuteurEcrit.current = setTimeout(() => vivant.current && setEquipeEcrit(false), DELAI_ECRIT);
    } else if (trame.type === 'erreur') {
      // L'erreur ne dit pas quel message : c'est le plus ancien envoi encore en attente de confirmation.
      const attente = messagesRef.current.find((m) => m.id === null && m.statut === 'envoi' && minuteurs.current.has(m.cle_client));
      if (attente) echec(attente.cle_client, { message: trame.detail, code: trame.code });
    }
  });

  // Marquage « lu » : messages de l'équipe, page visible et bas du fil atteint.
  const { definirNonLusMessages } = direct;
  useEffect(() => {
    if (!lectureActive) return;
    const ids = messages.filter((m) => m.auteur_role === 'equipe' && !m.lu_le && m.id !== null).map((m) => m.id);
    if (!ids.length) return;
    const jusquA = Math.max(...ids);
    if (jusquA <= dernierLuEnvoye.current) return;
    const avant = dernierLuEnvoye.current;
    dernierLuEnvoye.current = jusquA;
    messagerie.marquerLu(jusquA)
      .then((reponse) => {
        if (!vivant.current) return;
        const quand = new Date().toISOString();
        poser((anciens) => anciens.map((m) => (m.auteur_role === 'equipe' && m.id !== null && m.id <= jusquA && !m.lu_le
          ? { ...m, lu_le: quand } : m)));
        if (reponse && Number.isFinite(Number(reponse.non_lus))) definirNonLusMessages(Number(reponse.non_lus));
      })
      .catch(() => {
        dernierLuEnvoye.current = avant; // sera retenté au prochain changement
      });
  }, [messages, lectureActive, definirNonLusMessages, poser]);

  return {
    messages, aPlus, chargement, chargementAvant, erreur, equipeEcrit,
    recharger: charger, chargerAvant, envoyer, reessayer, retirer, signalerEcriture,
  };
}
