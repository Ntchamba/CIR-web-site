// Disponibilité des appels : Jitsi configuré ? quelqu'un de l'équipe en ligne ? (relue à chaque ouverture et
// quand le direct se reconnecte).
import { useEffect, useState } from 'react';

import { useDirect } from '@/modules/notifications/FondDirect.jsx';

import * as appels from './api.js';

export function useDisponibilite(actif = true) {
  const { etat } = useDirect();
  const [dispo, setDispo] = useState({ chargee: false, configure: false, equipeEnLigne: false });

  useEffect(() => {
    if (!actif) return undefined;
    let vivant = true;
    appels.disponibilite()
      .then((d) => vivant && setDispo({ chargee: true, configure: Boolean(d?.configure), equipeEnLigne: Boolean(d?.equipe_en_ligne) }))
      .catch(() => vivant && setDispo({ chargee: true, configure: false, equipeEnLigne: false }));
    return () => {
      vivant = false;
    };
  }, [actif, etat === 'connecte']);

  return dispo;
}
