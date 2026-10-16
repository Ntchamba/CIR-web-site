// Point d'entrée du site public : polices auto-hébergées, styles communs, langue, application.
import '@fontsource-variable/lora/index.css';
import '@fontsource-variable/lora/wght-italic.css';
import '@fontsource-variable/figtree/index.css';
import '@partage/styles/jetons.css';
import '@partage/styles/base.css';
import '../styles/global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';

import { demarrerI18n } from '@/i18n/index.js';

import App from './App.jsx';

// La langue (et ses textes) est prête avant le premier rendu : pas de français affiché un instant.
demarrerI18n({ cleStockage: 'cir-site' }).finally(() => {
  createRoot(document.getElementById('racine')).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
});
