// Préparation des tests Vitest : assertions DOM, nettoyage après chaque test.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

import { reinitialiserI18n } from '@partage/i18n/i18n.js';

import { oublierContenusAccueil } from '@/layout/contenus.js';

afterEach(() => {
  cleanup();
  localStorage.clear();
  reinitialiserI18n(); // chaque test commence en français
  oublierContenusAccueil(); // pas de contenus gardés d'un test à l'autre
  vi.unstubAllGlobals(); // fetch, matchMedia simulés : propres à chaque test
});

// jsdom ne sait pas faire défiler la page : on neutralise window.scrollTo.
window.scrollTo = () => {};
