// Préparation des tests Vitest : assertions DOM, nettoyage après chaque test.
import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

import { reinitialiserI18n } from '@partage/i18n/i18n.js';

import { oublierContenusAccueil } from '@/layout/contenus.js';

// Machine chargée (suite complète en parallèle) : on laisse plus de temps aux attentes asynchrones.
configure({ asyncUtilTimeout: 4000 });

afterEach(() => {
  cleanup();
  localStorage.clear();
  reinitialiserI18n(); // chaque test commence en français
  oublierContenusAccueil(); // pas de contenus gardés d'un test à l'autre
  vi.unstubAllGlobals(); // fetch, matchMedia simulés : propres à chaque test
});

// jsdom ne sait pas faire défiler la page : on neutralise window.scrollTo.
window.scrollTo = () => {};

// Aucun test n'ouvre de vraie connexion en direct : un WebSocket inerte (qui ne s'ouvre jamais) est installé par
// défaut. Les tests de la messagerie, des appels et des notifications le remplacent par `simulerDirect()`.
class WebSocketInerte {
  constructor(adresse) {
    this.url = adresse;
    this.readyState = 0;
  }
  send() {}
  close() {}
}
beforeEach(() => {
  vi.stubGlobal('WebSocket', WebSocketInerte);
});
