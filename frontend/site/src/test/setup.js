// Préparation des tests Vitest : assertions DOM, nettoyage après chaque test.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

// jsdom ne sait pas faire défiler la page : on neutralise window.scrollTo.
window.scrollTo = () => {};
