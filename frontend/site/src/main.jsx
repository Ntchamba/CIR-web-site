// Point d'entrée du site public.
import '@fontsource-variable/lora/index.css';
import '@fontsource-variable/lora/wght-italic.css';
import '@fontsource-variable/figtree/index.css';
import '@fontsource/dm-mono/400.css';
import '@shared/styles/tokens.css';
import '@shared/styles/base.css';
import './styles/global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App.jsx';

createRoot(document.getElementById('racine')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
