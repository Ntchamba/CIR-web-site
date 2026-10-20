// BF-11, BF-13 : fond « en direct » de l'application. Une seule connexion /ws/ pour tout le site quand le client
// est connecté : états, compteurs (messages et notifications non lus), événements pour les pages.
// Si la connexion est coupée, les compteurs sont relus en HTTP toutes les 15 secondes et un bandeau le dit.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { creerConnexionDirect } from '@partage/api/socket.js';

import { api } from '@/app/api.js';
import { useAuth } from '@/modules/compte/AuthContext.jsx';
import * as messagerie from '@/modules/messagerie/api.js';

import * as notifications from './api.js';

export const DELAI_LECTURE_HTTP = 15_000;

const VALEUR_VIDE = {
  etat: 'coupe',
  actif: false,
  interrompu: false,
  nonLusMessages: 0,
  nonLuesNotifications: 0,
  rattrapage: 0,
  definirNonLusMessages: () => {},
  definirNonLuesNotifications: () => {},
  abonner: () => () => {},
  envoyer: () => false,
};

const DirectContext = createContext(VALEUR_VIDE);

const entier = (valeur) => (Number.isFinite(Number(valeur)) && Number(valeur) > 0 ? Math.floor(Number(valeur)) : 0);

export default function FondDirect({ children }) {
  const { utilisateur } = useAuth();
  const actif = Boolean(utilisateur) && !utilisateur.est_equipe;
  const identifiant = actif ? utilisateur.id : null;

  const [etat, setEtat] = useState('coupe');
  const [nonLusMessages, definirNonLusMessages] = useState(0);
  const [nonLuesNotifications, definirNonLuesNotifications] = useState(0);
  const [rattrapage, setRattrapage] = useState(0);
  const abonnes = useRef(new Set());
  const connexion = useRef(null);
  const dejaConnecte = useRef(false);

  const abonner = useCallback((rappel) => {
    abonnes.current.add(rappel);
    return () => abonnes.current.delete(rappel);
  }, []);

  const envoyer = useCallback((trame) => connexion.current?.envoyer(trame) ?? false, []);

  // Lecture HTTP des compteurs (premier affichage et repli quand le direct est coupé).
  const lireCompteurs = useCallback(async () => {
    const [m, n] = await Promise.allSettled([messagerie.nonLus(), notifications.nonLues()]);
    if (m.status === 'fulfilled' && m.value) definirNonLusMessages(entier(m.value.non_lus));
    if (n.status === 'fulfilled' && n.value) definirNonLuesNotifications(entier(n.value.count));
  }, []);

  useEffect(() => {
    if (!identifiant) {
      setEtat('coupe');
      definirNonLusMessages(0);
      definirNonLuesNotifications(0);
      dejaConnecte.current = false;
      return undefined;
    }
    let vivant = true;
    lireCompteurs();

    const surEvenement = (trame) => {
      if (!vivant) return;
      if (trame.type === 'pret') {
        definirNonLusMessages(entier(trame.non_lus));
        definirNonLuesNotifications(entier(trame.notifications_non_lues));
      } else if (trame.type === 'non_lus') {
        definirNonLusMessages(entier(trame.messagerie));
        definirNonLuesNotifications(entier(trame.notifications));
      }
      abonnes.current.forEach((rappel) => {
        try {
          rappel(trame);
        } catch {
          /* un abonné défaillant ne doit pas bloquer les autres */
        }
      });
    };
    const surEtat = (nouvelEtat) => {
      if (!vivant) return;
      setEtat(nouvelEtat);
      if (nouvelEtat === 'connecte') {
        // Retour du direct après une coupure : les pages rattrapent ce qu'elles ont manqué (`apres`).
        if (dejaConnecte.current) setRattrapage((n) => n + 1);
        dejaConnecte.current = true;
      }
    };
    const direct = creerConnexionDirect({ api, surEvenement, surEtat });
    connexion.current = direct;

    const reprendre = () => {
      if (document.visibilityState === 'hidden') return;
      direct.reconnecter?.();
    };
    window.addEventListener('online', reprendre);
    document.addEventListener('visibilitychange', reprendre);
    return () => {
      vivant = false;
      window.removeEventListener('online', reprendre);
      document.removeEventListener('visibilitychange', reprendre);
      direct.fermer();
      if (connexion.current === direct) connexion.current = null;
    };
  }, [identifiant, lireCompteurs]);

  const interrompu = Boolean(identifiant) && etat === 'coupe';

  // Repli HTTP : compteurs relus toutes les 15 s, et les pages ouvertes rattrapent leurs données.
  useEffect(() => {
    if (!interrompu) return undefined;
    const minuteur = setInterval(() => {
      lireCompteurs();
      setRattrapage((n) => n + 1);
    }, DELAI_LECTURE_HTTP);
    return () => clearInterval(minuteur);
  }, [interrompu, lireCompteurs]);

  const valeur = useMemo(
    () => ({
      etat, actif: Boolean(identifiant), interrompu, nonLusMessages, nonLuesNotifications, rattrapage,
      definirNonLusMessages, definirNonLuesNotifications, abonner, envoyer,
    }),
    [etat, identifiant, interrompu, nonLusMessages, nonLuesNotifications, rattrapage, abonner, envoyer],
  );
  return <DirectContext.Provider value={valeur}>{children}</DirectContext.Provider>;
}

/** Fond en direct : { etat, interrompu, nonLusMessages, nonLuesNotifications, rattrapage, abonner(rappel), envoyer(trame), … }. */
export function useDirect() {
  return useContext(DirectContext);
}

/** Appelle `rappel(trame)` pour chaque trame reçue du serveur tant que le composant est affiché. */
export function useEvenementsDirect(rappel) {
  const { abonner } = useDirect();
  const dernier = useRef(rappel);
  useEffect(() => {
    dernier.current = rappel;
  });
  useEffect(() => abonner((trame) => dernier.current(trame)), [abonner]);
}
