// Préparation des tests Vitest : assertions DOM, nettoyage après chaque test.
import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

import { reinitialiserI18n } from '@partage/i18n/i18n.js';

// Les pages sont chargées à la demande (import dynamique) : la première transformation d'une page peut dépasser
// la seconde par défaut quand les fichiers de test tournent en parallèle sur une machine chargée.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  cleanup();
  localStorage.clear();
  reinitialiserI18n(); // chaque test commence en français
});

// jsdom ne sait pas faire défiler la page : on neutralise window.scrollTo.
window.scrollTo = () => {};
