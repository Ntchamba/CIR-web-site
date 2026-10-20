// Faux WebSocket pour les tests du direct : le test ouvre la connexion, envoie des trames « serveur » et lit les trames
// envoyées par l'application. Installation : `const direct = installerDirect()` (remplace WebSocket global).
import { act } from '@testing-library/react';
import { vi } from 'vitest';

export function installerDirect() {
  const instances = [];
  class FauxWebSocket {
    constructor(url) {
      this.url = url;
      this.envoyes = [];
      instances.push(this);
    }
    send(donnees) { this.envoyes.push(JSON.parse(donnees)); }
    close() { this.onclose?.({ code: 1000 }); }
  }
  vi.stubGlobal('WebSocket', FauxWebSocket);

  const derniere = () => instances.at(-1);
  return {
    instances,
    derniere,
    /** Ouvre la connexion et répond « pret » après l'authentification. */
    connecter(pret = { utilisateur: { id: 2, role: 'membre' }, non_lus: 0, notifications_non_lues: 0 }) {
      act(() => {
        derniere().onopen?.();
        derniere().onmessage?.({ data: JSON.stringify({ type: 'pret', ...pret }) });
      });
    },
    /** Trame envoyée par le serveur. */
    recevoir(trame) {
      act(() => derniere().onmessage?.({ data: JSON.stringify(trame) }));
    },
    couper() {
      act(() => derniere().onclose?.({ code: 1006 }));
    },
    /** Trames envoyées par l'application, sauf `ping`. */
    envoyees: () => instances.flatMap((i) => i.envoyes).filter((t) => t.type !== 'ping'),
  };
}
