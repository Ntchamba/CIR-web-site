/**
 * Connexion en direct (WebSocket) à l'API CIR : messagerie, notifications, appels.
 *
 * - s'authentifie par la première trame `{ type: 'authentifier', jeton }` (jamais dans l'adresse) ;
 * - envoie `ping` toutes les 25 secondes pour garder la présence en ligne ;
 * - après une coupure, se reconnecte (1 s, 2 s, 4 s… jusqu'à 30 s) en renouvelant d'abord le jeton d'accès ;
 * - garde au plus 20 trames à envoyer pendant une coupure, puis les envoie à la reconnexion ;
 * - s'arrête de lui-même si la session est terminée (plus de jetons).
 *
 * Usage :
 *   const direct = creerConnexionDirect({ api, surEvenement: (trame) => …, surEtat: (etat) => … });
 *   direct.envoyer({ type: 'envoyer', texte: 'Bonjour' });
 *   direct.fermer();
 *
 * États : 'connexion' (en cours), 'connecte' (authentifié, trame « pret » reçue), 'coupe' (en attente de reconnexion).
 */

const DELAI_PING = 25_000;
const DELAI_MAX = 30_000;
const FILE_MAX = 20;

/** Adresse WebSocket à partir de l'adresse du back-end (http → ws, https → wss). */
export function adresseDirect(baseUrl, origineLocale) {
  const base = String(baseUrl || '').replace(/\/+$/, '');
  if (!base) {
    const origine = origineLocale ?? (typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    return `${origine.replace(/^http/, 'ws')}/ws/`;
  }
  return `${base.replace(/^http/, 'ws')}/ws/`;
}

/**
 * @param {object} options
 * @param {object} options.api client créé par `creerClientApi`
 * @param {string} [options.url] adresse complète du WebSocket (par défaut : dérivée de `api.baseUrl`)
 * @param {(trame: object) => void} options.surEvenement appelé pour chaque trame du serveur (sauf `pong`)
 * @param {(etat: string) => void} [options.surEtat]
 * @param {Function} [options.WebSocketImpl] pour les tests
 */
export function creerConnexionDirect({ api, url, surEvenement, surEtat, WebSocketImpl }) {
  const Impl = WebSocketImpl ?? globalThis.WebSocket;
  const adresse = url || adresseDirect(api.baseUrl);
  let socket = null;
  let etat = 'coupe';
  let ferme = false;
  let tentative = 0;
  let minuteurPing = null;
  let minuteurReconnexion = null;
  let file = [];

  function changerEtat(nouvelEtat) {
    if (etat === nouvelEtat) return;
    etat = nouvelEtat;
    surEtat?.(etat);
  }

  function arreterPing() {
    clearInterval(minuteurPing);
    minuteurPing = null;
  }

  function brut(trame) {
    try {
      socket.send(JSON.stringify(trame));
      return true;
    } catch {
      return false;
    }
  }

  function planifierReconnexion() {
    if (ferme || minuteurReconnexion) return;
    const delai = Math.min(1000 * 2 ** tentative, DELAI_MAX);
    tentative += 1;
    minuteurReconnexion = setTimeout(async () => {
      minuteurReconnexion = null;
      if (ferme) return;
      // Jeton d'accès renouvelé avant chaque reconnexion (il a pu expirer pendant la coupure).
      await api.rafraichir();
      if (ferme) return;
      if (!api.jetons.lire()?.acces) {
        // Session terminée : plus rien à faire tant que l'utilisateur ne se reconnecte pas.
        changerEtat('coupe');
        return;
      }
      ouvrir();
    }, delai);
  }

  function ouvrir() {
    const jeton = api.jetons.lire()?.acces;
    if (!jeton) {
      changerEtat('coupe');
      return;
    }
    changerEtat('connexion');
    let courant;
    try {
      courant = new Impl(adresse);
    } catch {
      changerEtat('coupe');
      planifierReconnexion();
      return;
    }
    socket = courant;
    courant.onopen = () => {
      if (socket !== courant) return;
      brut({ type: 'authentifier', jeton });
    };
    courant.onmessage = (evenement) => {
      if (socket !== courant) return;
      let trame;
      try {
        trame = JSON.parse(evenement.data);
      } catch {
        return;
      }
      if (!trame || typeof trame !== 'object') return;
      if (trame.type === 'pong') return;
      if (trame.type === 'pret') {
        tentative = 0;
        changerEtat('connecte');
        arreterPing();
        minuteurPing = setInterval(() => brut({ type: 'ping' }), DELAI_PING);
        const attente = file;
        file = [];
        attente.forEach((enAttente) => brut(enAttente));
      }
      surEvenement?.(trame);
    };
    courant.onclose = () => {
      if (socket !== courant) return;
      socket = null;
      arreterPing();
      changerEtat('coupe');
      if (ferme) return;
      // Jeton refusé : le renouvellement avant la reconnexion règle le cas du jeton expiré ;
      // si la session est finie, la reconnexion s'arrête d'elle-même.
      planifierReconnexion();
    };
    courant.onerror = () => {
      /* la fermeture qui suit déclenche la reconnexion */
    };
  }

  ouvrir();

  return {
    /** Envoie une trame ; pendant une coupure, elle est gardée (20 au plus) puis envoyée à la reconnexion. */
    envoyer(trame) {
      if (etat === 'connecte' && socket && brut(trame)) return true;
      if (file.length >= FILE_MAX) file.shift();
      file.push(trame);
      return false;
    },
    /** Reprend tout de suite (ex. retour de l'onglet au premier plan, réseau revenu). */
    reconnecter() {
      if (ferme || etat !== 'coupe') return;
      clearTimeout(minuteurReconnexion);
      minuteurReconnexion = null;
      tentative = 0;
      planifierReconnexion();
    },
    fermer() {
      ferme = true;
      clearTimeout(minuteurReconnexion);
      minuteurReconnexion = null;
      arreterPing();
      file = [];
      const courant = socket;
      socket = null;
      try {
        courant?.close(1000);
      } catch {
        /* déjà fermé */
      }
      changerEtat('coupe');
    },
    etat: () => etat,
  };
}
