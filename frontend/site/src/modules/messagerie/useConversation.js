// Une conversation en direct : historique au chargement, puis messages reçus et envoyés par WebSocket.
import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '@/lib/api.js';
import { ouvrirSocket } from '@shared/api/socket.js';

import * as messagerie from './api.js';

export default function useConversation(id) {
  const [messages, setMessages] = useState([]);
  const [etat, setEtat] = useState('connexion');
  const [erreur, setErreur] = useState(null);
  const [equipeEcrit, setEquipeEcrit] = useState(false);
  const socket = useRef(null);

  useEffect(() => {
    if (!id) return undefined;
    const controleur = new AbortController();
    let minuteurSaisie;
    setMessages([]);
    setErreur(null);
    messagerie.messages(id, controleur.signal).then(setMessages).catch((e) => e.name !== 'AbortError' && setErreur(e));

    socket.current = ouvrirSocket(() => api.ws(`/ws/messagerie/${id}/`), {
      onEtat: setEtat,
      avantReconnexion: () => api.rafraichir(), // le jeton a pu expirer pendant la coupure
      onMessage: (evt) => {
        if (evt.type === 'message') {
          setMessages((liste) => (liste.some((m) => m.id === evt.message.id) ? liste : [...liste, evt.message]));
          if (evt.message.de_l_equipe) socket.current?.envoyer({ type: 'lu' });
        } else if (evt.type === 'saisie' && evt.de_l_equipe) {
          setEquipeEcrit(true);
          clearTimeout(minuteurSaisie);
          minuteurSaisie = setTimeout(() => setEquipeEcrit(false), 3000);
        }
      },
    });
    return () => { controleur.abort(); clearTimeout(minuteurSaisie); socket.current?.fermer(); };
  }, [id]);

  const envoyer = useCallback(async (texte) => {
    const propre = texte.trim();
    if (!propre) return;
    if (etat === 'ouvert') {
      socket.current.envoyer({ type: 'message', texte: propre });
    } else {
      // Sans WebSocket (réseau instable), on passe par l'API classique.
      const message = await messagerie.envoyer(id, propre);
      setMessages((liste) => [...liste, message]);
    }
  }, [etat, id]);

  const signalerSaisie = useCallback(() => socket.current?.envoyer({ type: 'saisie' }), []);

  return { messages, etat, erreur, envoyer, equipeEcrit, signalerSaisie };
}
