// Flèche de retour « < » de l'en-tête, sur téléphone seulement (CSS : même seuil que la barre d'onglets) et jamais
// sur les cinq pages racines. Retour dans l'historique du site s'il y a une page précédente du site, sinon vers la
// page parente logique (app/parents.js) : on ne sort jamais du site. La caméra rejoue alors le trajet inverse.
import { useLocation, useNavigate } from 'react-router';

import Icone from '@partage/ui/Icone.jsx';

import { estRacine, parentDe } from '@/app/parents.js';
import { useTraduction } from '@/i18n/index.js';

import styles from './Entete.module.css';

/** Vrai s'il existe une page précédente DU SITE (le routeur numérote ses entrées d'historique à partir de 0). */
export const pagePrecedenteDuSite = () => Number(window.history.state?.idx) > 0;

export default function BoutonRetour() {
  const { t } = useTraduction();
  const { pathname } = useLocation();
  const naviguer = useNavigate();
  if (estRacine(pathname)) return null;
  const revenir = () => (pagePrecedenteDuSite() ? naviguer(-1) : naviguer(parentDe(pathname), { replace: true }));
  return (
    <button type="button" className={styles.retour} onClick={revenir} aria-label={t('entete.retour')}>
      <Icone nom="precedent" taille={24} />
    </button>
  );
}
