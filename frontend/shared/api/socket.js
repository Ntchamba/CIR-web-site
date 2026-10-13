/**
 * WebSocket de la messagerie instantanée, avec reconnexion automatique
 * (utile avec une connexion mobile instable).
 *
 *   const s = ouvrirSocket(() => api.ws('/ws/messagerie/3/'), { onMessage, onEtat });
 *   s.envoyer({ type: 'message', texte: 'Bonjour' });
 *   s.fermer();
 */
export function ouvrirSocket(fabriqueUrl, { onMessage, onEtat, avantReconnexion } = {}) {
  let socket = null;
  let ferme = false;
  let tentative = 0;
  let minuteur = null;
  const fileAttente = [];

  const etat = (e) => onEtat?.(e);

  async function connecter() {
    if (ferme) return;
    if (tentative > 0 && avantReconnexion) await avantReconnexion();
    etat(tentative ? 'reconnexion' : 'connexion');
    socket = new WebSocket(fabriqueUrl());
    socket.onopen = () => {
      tentative = 0;
      etat('ouvert');
      while (fileAttente.length) socket.send(JSON.stringify(fileAttente.shift()));
    };
    socket.onmessage = (e) => {
      try { onMessage?.(JSON.parse(e.data)); } catch { /* message illisible ignoré */ }
    };
    socket.onclose = (e) => {
      if (ferme) return;
      if (e.code === 4403 || e.code === 4401) { etat('refuse'); return; }
      etat('coupe');
      tentative += 1;
      const delai = Math.min(30000, 1000 * 2 ** Math.min(tentative, 5));
      minuteur = setTimeout(connecter, delai);
    };
  }

  connecter();

  return {
    envoyer(objet) {
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(objet));
      else fileAttente.push(objet);
    },
    fermer() {
      ferme = true;
      clearTimeout(minuteur);
      socket?.close();
    },
  };
}
