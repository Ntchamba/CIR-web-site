// Messages des clients pas encore lus par l'équipe (pastille du menu), mis à jour en direct.
import { useEffect, useState } from 'react';

import { api } from '@/lib/api.js';
import { useAuth } from '@/modules/auth/AuthContext.jsx';
import { ouvrirSocket } from '@shared/api/socket.js';

export default function useNonLus() {
  const { utilisateur } = useAuth();
  const [total, setTotal] = useState(0);
  useEffect(() => {
    if (!utilisateur) return undefined;
    const compter = () => api.get('/admin/messagerie/conversations/non_lus/').then((r) => setTotal(r.non_lus)).catch(() => {});
    compter();
    const socket = ouvrirSocket(() => api.ws('/ws/notifications/'), {
      avantReconnexion: () => api.rafraichir(),
      onMessage: (e) => e.type === 'conversation' && compter(),
    });
    return () => socket.fermer();
  }, [utilisateur]);
  return total;
}
