// Actions sur les notifications (marquer lue, tout marquer comme lu) en gardant les compteurs du fond en direct à jour.
import { useCallback } from 'react';

import { useDirect } from './FondDirect.jsx';
import * as notifications from './api.js';

export function useActionsNotifications() {
  const { definirNonLuesNotifications } = useDirect();

  /** Marque une notification comme lue ; `etaitNonLue` évite de décompter deux fois. */
  const marquerLue = useCallback(async (notification) => {
    if (notification.lue) return;
    definirNonLuesNotifications((n) => Math.max(0, n - 1));
    try {
      await notifications.marquerLue(notification.id);
    } catch {
      definirNonLuesNotifications((n) => n + 1);
      throw new Error('echec');
    }
  }, [definirNonLuesNotifications]);

  const toutMarquerLu = useCallback(async () => {
    await notifications.toutMarquerLu();
    definirNonLuesNotifications(0);
  }, [definirNonLuesNotifications]);

  return { marquerLue, toutMarquerLu };
}
