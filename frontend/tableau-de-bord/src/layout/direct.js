// Contexte du direct (WebSocket) partagé par toute la coque : état, compteurs, appels qui sonnent, abonnements.
// Hors de la coque (tests de pages isolées), `useDirect` renvoie des valeurs neutres.
import { createContext, useContext } from 'react';

export const DirectContext = createContext(null);

const AUCUN = Object.freeze({
  etat: 'connexion',
  interrompu: false,
  compteurs: Object.freeze({ messagerie: 0, notifications: 0, appelsManques: 0 }),
  appelsQuiSonnent: Object.freeze([]),
  envoyer: () => false,
  abonner: () => () => {},
  rafraichir: () => {},
  retirerAppel: () => {},
});

export function useDirect() {
  return useContext(DirectContext) || AUCUN;
}
