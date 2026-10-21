// Gabarit commun : lien d'évitement, en-tête, contenu de la page, pied de page, barre d'onglets mobile.
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router';

import Chargement from '@partage/ui/Chargement.jsx';

import { useCamera } from '@/app/camera.js';
import { useChangementDePage } from '@/app/changementDePage.js';
import { useProfondeur } from '@/app/profondeur.js';
import { nomDeVue } from '@/app/cameras.js';
import { useTraduction } from '@/i18n/index.js';
import SalleAppel from '@/modules/appels/composants/SalleAppel.jsx';
import BandeauDirect from '@/modules/notifications/composants/BandeauDirect.jsx';

import BarreOnglets from './BarreOnglets.jsx';
import Entete from './Entete.jsx';
import PiedDePage from './PiedDePage.jsx';
import styles from './Gabarit.module.css';

// L'assistant est dans un chunk séparé, demandé seulement quand le navigateur est au repos : il ne retarde pas la page.
const BulleAssistant = lazy(() => import('@/modules/assistant/BulleAssistant.jsx'));

// Vues qui reproduisent une page des maquettes (accueil, catalogue, fiche produit, réalisations, compte, commandes).
const VUES_DE_MAQUETTE = ['accueil', 'catalogue', 'produit', 'realisations', 'connexion', 'inscription', 'commandes', 'commande'];

export default function Gabarit() {
  const { t } = useTraduction();
  const { pathname } = useLocation();
  // Les pages des maquettes posent elles-mêmes leur mise en page pleine largeur ; les autres vues (messagerie, paiement,
  // notifications…) reposent sur une page claire : voile blanc flouté sur la scène du salon, comme les maquettes.
  const vue = nomDeVue(pathname);
  const pageDeMaquette = VUES_DE_MAQUETTE.includes(vue);

  // Entrée en profondeur : `data-plat` sur <html> quand la page doit rester à plat (voir app/profondeur.js).
  useProfondeur();
  // Caméra : se déplace vers le cadrage de la page (app/cameras.js, app/camera.js). Après le retour en haut de page.

  // Haut de page (ou position retrouvée au retour arrière), focus sur le contenu et annonce du titre de la page.
  const refPrincipal = useRef(null);
  const annonce = useChangementDePage(refPrincipal);

  const refScene = useCamera(pathname);

  const [assistantPret, setAssistantPret] = useState(false);
  useEffect(() => {
    const demander = window.requestIdleCallback
      ? (rappel) => window.requestIdleCallback(rappel, { timeout: 2000 })
      : (rappel) => window.setTimeout(rappel, 200);
    const annuler = window.cancelIdleCallback || window.clearTimeout;
    const id = demander(() => setAssistantPret(true));
    return () => annuler(id);
  }, []);

  return (
    <div className={styles.page} data-vue={vue}>
      {/* Scène : le salon (dernière image de la vidéo), un seul élément pour toute l'application, derrière toutes les
          pages (décoratif). Sa « caméra » change selon la page (variables --cam-*, styles/profondeur.css). */}
      <div className="scene" ref={refScene} aria-hidden="true">
        <div className="scene-image" />
        <div className="scene-voile" />
        <div className="scene-lumiere" />
      </div>
      <a href="#contenu" className={styles.evitement}>{t('nav.allerAuContenu')}</a>
      <Entete />
      <main id="contenu" className={styles.contenu} tabIndex={-1} ref={refPrincipal}>
        <BandeauDirect />
        {/* Page chargée à la demande : l'en-tête et le pied de page restent affichés pendant le chargement. */}
        <Suspense fallback={<Chargement plein />}>
          <div key={pathname} className="page-entree">
            {pageDeMaquette ? <Outlet /> : <div className="m-fond-flou m-page-claire"><Outlet /></div>}
          </div>
        </Suspense>
      </main>
      <div role="status" aria-live="polite" aria-atomic="true" className="visuellement-cache" data-testid="annonce-page">{annonce}</div>
      <PiedDePage />
      <BarreOnglets />
      <SalleAppel />
      {assistantPret && (
        <Suspense fallback={null}>
          <BulleAssistant />
        </Suspense>
      )}
    </div>
  );
}
