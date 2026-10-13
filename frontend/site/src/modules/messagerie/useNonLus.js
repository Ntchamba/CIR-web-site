// Nombre de messages non lus, mis à jour en direct (pastille de l'en-tête).
import { useEffect, useState } from 'react';

import { api } from '@/lib/api.js';
import { ouvrirSocket } from '@shared/api/socket.js';

import { useAuth } from '../compte/AuthContext.jsx';
import * as messagerie from './api.js';

export default function useNonLus() {
  const { utilisateur } = useAuth();
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!utilisateur) { setTotal(0); return undefined; }
    const compter = () => messagerie.nonLus().then((r) => setTotal(r.non_lus)).catch(() => {});
    compter();
    const socket = ouvrirSocket(() => api.ws('/ws/notifications/'), {
      avantReconnexion: () => api.rafraichir(),
      onMessage: (evt) => evt.type === 'conversation' && compter(),
    });
    return () => socket.fermer();
  }, [utilisateur]);

  return total;
}
