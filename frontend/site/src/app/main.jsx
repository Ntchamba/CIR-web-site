// Point d'entrée du site public : polices auto-hébergées, styles communs, langue, application.
import '@fontsource-variable/lora/index.css';
import '@fontsource-variable/lora/wght-italic.css';
import '@fontsource-variable/figtree/index.css';
import '@partage/styles/jetons.css';
import '@partage/styles/base.css';
import '@fontsource/dm-mono/400.css';
import '@fontsource/dm-mono/500.css';
import '../styles/global.css';
import '../styles/maquette.css';
import '../styles/profondeur.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';

import { demarrerI18n } from '@/i18n/index.js';

import App from './App.jsx';
import { activerZoomEntrePages, appliquerProfondeur } from './profondeur.js';
import { prechargerPages } from './routes.jsx';

// `data-plat` est posé avant tout rendu : une page qui doit rester à plat (économie de données, appareil faible)
// n'affiche jamais, même un instant, les effets de profondeur.
appliquerProfondeur();

// Routeur de données : il permet le zoom avant entre les pages (View Transitions). Les routes sont décrites
// dans app/routes.jsx (<Routes>) : une seule route « * » rend toute l'application.
const routeur = activerZoomEntrePages(createBrowserRouter([{ path: '*', element: <App /> }]));

// La langue (et ses textes) est prête avant le premier rendu : pas de français affiché un instant.
demarrerI18n({ cleStockage: 'cir-site' }).finally(() => {
  createRoot(document.getElementById('racine')).render(
    <StrictMode>
      <RouterProvider router={routeur} />
    </StrictMode>,
  );
  if (document.readyState === 'complete') prechargerPages();
  else window.addEventListener('load', prechargerPages, { once: true });
});
