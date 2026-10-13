// Conversation en direct, côté équipe : historique, puis WebSocket (envoi, réception, « le client écrit… »).
import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '@/lib/api.js';
import { ouvrirSocket } from '@shared/api/socket.js';

export default function useConversation(id) {
  const [messages, setMessages] = useState([]);
  const [etat, setEtat] = useState('connexion');
  const [clientEcrit, setClientEcrit] = useState(false);
  const socket = useRef(null);

  useEffect(() => {
    if (!id) return undefined;
    const controleur = new AbortController();
    let minuteur;
    setMessages([]);
    api.get(`/admin/messagerie/conversations/${id}/messages/`, { signal: controleur.signal }).then(setMessages).catch(() => {});
    socket.current = ouvrirSocket(() => api.ws(`/ws/messagerie/${id}/`), {
      onEtat: setEtat,
      avantReconnexion: () => api.rafraichir(),
      onMessage: (evt) => {
        if (evt.type === 'message') {
          setMessages((l) => (l.some((m) => m.id === evt.message.id) ? l : [...l, evt.message]));
          if (!evt.message.de_l_equipe) socket.current?.envoyer({ type: 'lu' });
        } else if (evt.type === 'saisie' && !evt.de_l_equipe) {
          setClientEcrit(true);
          clearTimeout(minuteur);
          minuteur = setTimeout(() => setClientEcrit(false), 3000);
        }
      },
    });
    return () => { controleur.abort(); clearTimeout(minuteur); socket.current?.fermer(); };
  }, [id]);

  const envoyer = useCallback(async (texte) => {
    if (!texte.trim()) return;
    if (etat === 'ouvert') socket.current.envoyer({ type: 'message', texte: texte.trim() });
    else {
      const m = await api.post(`/admin/messagerie/conversations/${id}/messages/`, { texte: texte.trim() });
      setMessages((l) => [...l, m]);
    }
  }, [etat, id]);

  return { messages, etat, clientEcrit, envoyer, signalerSaisie: () => socket.current?.envoyer({ type: 'saisie' }) };
}
