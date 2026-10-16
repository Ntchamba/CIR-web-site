// Panneau latéral accessible (fiche d'un produit, d'une réalisation…) :
// fenêtre modale nommée par son titre, focus piégé à l'intérieur, fermeture par Échap, par le bouton ou par
// le voile, et retour du focus sur l'élément qui l'a ouvert.
import { useEffect, useId, useRef } from 'react';

import Icone from '@partage/ui/Icone.jsx';

import { useTraduction } from '@/i18n/index.js';

import styles from './Composants.module.css';

const FOCALISABLES = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])', 'select:not([disabled])',
  'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

const elementsFocalisables = (racine) => [...racine.querySelectorAll(FOCALISABLES)]
  .filter((el) => !el.closest('[hidden]'));

export default function Tiroir({ ouvert, titre, sousTitre, surFermeture, pied, children, large = false }) {
  const { t } = useTraduction();
  const idTitre = useId();
  const panneau = useRef(null);
  const fermer = useRef(surFermeture);
  fermer.current = surFermeture;

  useEffect(() => {
    if (!ouvert) return undefined;
    const precedent = document.activeElement;
    const debordement = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Focus sur le premier champ du panneau (ou sur le panneau lui-même).
    const premier = elementsFocalisables(panneau.current).find((el) => !el.dataset.fermeture);
    (premier || panneau.current).focus();

    function surTouche(e) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        fermer.current?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const liste = elementsFocalisables(panneau.current);
      if (!liste.length) { e.preventDefault(); return; }
      const debut = liste[0];
      const fin = liste[liste.length - 1];
      if (e.shiftKey && (document.activeElement === debut || !panneau.current.contains(document.activeElement))) {
        e.preventDefault();
        fin.focus();
      } else if (!e.shiftKey && (document.activeElement === fin || !panneau.current.contains(document.activeElement))) {
        e.preventDefault();
        debut.focus();
      }
    }
    document.addEventListener('keydown', surTouche, true);
    return () => {
      document.removeEventListener('keydown', surTouche, true);
      document.body.style.overflow = debordement;
      if (precedent && typeof precedent.focus === 'function' && document.contains(precedent)) precedent.focus();
    };
  }, [ouvert]);

  if (!ouvert) return null;
  return (
    <div className={styles.tiroirRacine}>
      <div className={styles.voile} onClick={() => surFermeture?.()} aria-hidden="true" />
      <div ref={panneau} className={`${styles.tiroir} ${large ? styles.tiroirLarge : ''}`} role="dialog" aria-modal="true"
        aria-labelledby={idTitre} tabIndex={-1}>
        <div className={styles.tiroirEntete}>
          <div>
            <h2 id={idTitre} className={styles.tiroirTitre}>{titre}</h2>
            {sousTitre && <p className={styles.tiroirSousTitre}>{sousTitre}</p>}
          </div>
          <button type="button" className={styles.fermer} onClick={() => surFermeture?.()} aria-label={t('actions.fermer')}
            data-fermeture="1">
            <Icone nom="fermer" />
          </button>
        </div>
        <div className={styles.tiroirCorps}>{children}</div>
        {pied && <div className={styles.tiroirPied}>{pied}</div>}
      </div>
    </div>
  );
}
