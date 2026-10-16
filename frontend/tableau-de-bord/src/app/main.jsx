// Point d'entrée du tableau de bord : polices auto-hébergées, styles communs, application.
import '@fontsource-variable/lora/index.css';
import '@fontsource-variable/lora/wght-italic.css';
import '@fontsource-variable/figtree/index.css';
import '@partage/styles/jetons.css';
import '@partage/styles/base.css';
import '../styles/global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';

import App from './App.jsx';

createRoot(document.getElementById('racine')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
