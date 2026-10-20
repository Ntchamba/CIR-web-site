// État de la page Notifications : liste des notifications de la personne, préférence e-mail, onglet courant.
import { useCallback, useEffect } from 'react';

import useChargement from '@/composants/useChargement.js';
import { useCriteres } from '@/composants/useCriteres.js';
import useListe from '@/composants/useListe.js';
import { useDirect } from '@/layout/direct.js';

import { listerNotifications, lirePreferences, marquerLue, modifierPreferences, toutMarquerLu } from './api.js';

export default function useNotifications() {
  const { page, modifier } = useCriteres([]);
  const direct = useDirect();
  const liste = useListe(listerNotifications, { page });
  const preferences = useChargement((signal) => lirePreferences({ signal }), []);
  const { recharger } = liste;

  // Nouvelle notification en direct : la liste se recharge.
  useEffect(() => direct.abonner((trame) => { if (trame.type === 'notification') recharger(); }), [direct, recharger]);

  const lire = useCallback(async (notification) => {
    if (notification.lue) return;
    liste.remplacer({ id: notification.id, lue: true });
    try { await marquerLue(notification.id); } catch { liste.remplacer({ id: notification.id, lue: false }); }
    direct.rafraichir();
  }, [liste, direct]);

  const toutLu = useCallback(async () => {
    await toutMarquerLu();
    recharger();
    direct.rafraichir();
  }, [recharger, direct]);

  const changerPreference = useCallback(async (emailEquipe) => {
    const maj = await modifierPreferences({ email_equipe: emailEquipe });
    preferences.setDonnees(maj);
  }, [preferences]);

  return {
    ...liste,
    page,
    allerALaPage: (n) => modifier({ page: n }),
    preferences: preferences.donnees,
    erreurPreferences: preferences.erreur,
    lire,
    toutLu,
    changerPreference,
  };
}
