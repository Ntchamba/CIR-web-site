// Fond en direct : une seule connexion /ws/ pour tout le tableau de bord (messagerie, notifications, appels).
// - Les compteurs (messages non lus, notifications non lues, appels manqués) et les appels qui sonnent sont
//   tenus à jour par les trames du serveur, et relus en HTTP à l'ouverture, à chaque changement de page et
//   à la reconnexion. Si la connexion est coupée, une lecture HTTP toutes les 15 secondes prend le relais.
// - Les pages (messagerie…) s'abonnent aux trames par `abonner(rappel)`.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router';

import { creerConnexionDirect } from '@partage/api/socket.js';

import { api, resultats } from '@/app/api.js';

import { DirectContext } from './direct.js';

const DELAI_REPRISE_HTTP = 15_000;

const lire = (chemin) => api.get(chemin).catch(() => null);

export default function FondDirect({ children }) {
  const { pathname } = useLocation();
  const [etat, setEtat] = useState('connexion');
  const [compteurs, setCompteurs] = useState({ messagerie: 0, notifications: 0, appelsManques: 0 });
  const [appels, setAppels] = useState({}); // appels qui sonnent, par identifiant
  const abonnes = useRef(new Set());
  const connexion = useRef(null);
  const dejaConnecte = useRef(false);

  const fixer = useCallback((champs) => setCompteurs((c) => ({ ...c, ...champs })), []);

  const lireMessagerie = useCallback(async () => {
    const r = await lire('/api/admin/messagerie/resume/');
    if (r) fixer({ messagerie: Number(r.non_lus_total) || 0 });
  }, [fixer]);
  const lireNotifications = useCallback(async () => {
    const r = await lire('/api/admin/notifications/non-lues/');
    if (r) fixer({ notifications: Number(r.count) || 0 });
  }, [fixer]);
  const lireAppelsManques = useCallback(async () => {
    const r = await lire('/api/admin/appels/resume/');
    if (r) fixer({ appelsManques: Number(r.manques_non_vus) || 0 });
  }, [fixer]);
  const lireAppelsEnAttente = useCallback(async () => {
    const r = await lire('/api/admin/appels/en-attente/');
    if (!r) return;
    const liste = resultats(r).filter((a) => a && a.etat === 'sonne');
    setAppels(Object.fromEntries(liste.map((a) => [a.id, a])));
  }, []);

  const rafraichir = useCallback(() => {
    lireMessagerie();
    lireNotifications();
    lireAppelsManques();
    lireAppelsEnAttente();
  }, [lireMessagerie, lireNotifications, lireAppelsManques, lireAppelsEnAttente]);

  const retirerAppel = useCallback((id) => setAppels((a) => {
    if (!(id in a)) return a;
    const { [id]: _, ...reste } = a;
    return reste;
  }), []);

  // Lecture HTTP à l'ouverture de la coque et à chaque changement de page.
  useEffect(() => { rafraichir(); }, [pathname, rafraichir]);

  // Connexion unique.
  useEffect(() => {
    function surEvenement(trame) {
      switch (trame.type) {
        case 'pret':
          fixer({
            messagerie: Number(trame.non_lus) || 0,
            notifications: Number(trame.notifications_non_lues) || 0,
          });
          if (dejaConnecte.current) { lireAppelsEnAttente(); lireAppelsManques(); }
          dejaConnecte.current = true;
          break;
        case 'non_lus':
          fixer({ messagerie: Number(trame.messagerie) || 0, notifications: Number(trame.notifications) || 0 });
          break;
        case 'appel_entrant':
          if (trame.appel?.id != null) setAppels((a) => ({ ...a, [trame.appel.id]: trame.appel }));
          break;
        case 'appel_mis_a_jour':
          if (trame.appel?.id == null) break;
          if (trame.appel.etat === 'sonne') setAppels((a) => ({ ...a, [trame.appel.id]: trame.appel }));
          else retirerAppel(trame.appel.id);
          if (trame.appel.etat === 'manque') lireAppelsManques();
          break;
        default:
      }
      abonnes.current.forEach((rappel) => rappel(trame));
    }
    const direct = creerConnexionDirect({ api, surEvenement, surEtat: setEtat });
    connexion.current = direct;
    const reprendre = () => direct.reconnecter?.();
    const auRetour = () => document.visibilityState === 'visible' && reprendre();
    window.addEventListener('online', reprendre);
    document.addEventListener('visibilitychange', auRetour);
    return () => {
      window.removeEventListener('online', reprendre);
      document.removeEventListener('visibilitychange', auRetour);
      direct.fermer();
      connexion.current = null;
    };
  }, [fixer, lireAppelsEnAttente, lireAppelsManques, retirerAppel]);

  // Connexion interrompue : lecture HTTP toutes les 15 secondes.
  useEffect(() => {
    if (etat !== 'coupe') return undefined;
    const minuteur = setInterval(rafraichir, DELAI_REPRISE_HTTP);
    return () => clearInterval(minuteur);
  }, [etat, rafraichir]);

  const envoyer = useCallback((trame) => connexion.current?.envoyer(trame) ?? false, []);
  const abonner = useCallback((rappel) => {
    abonnes.current.add(rappel);
    return () => abonnes.current.delete(rappel);
  }, []);

  const appelsQuiSonnent = useMemo(() => Object.values(appels), [appels]);
  const valeur = useMemo(() => ({
    etat, interrompu: etat === 'coupe', compteurs, appelsQuiSonnent, envoyer, abonner, rafraichir, retirerAppel,
  }), [etat, compteurs, appelsQuiSonnent, envoyer, abonner, rafraichir, retirerAppel]);

  return <DirectContext.Provider value={valeur}>{children}</DirectContext.Provider>;
}
