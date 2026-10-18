// Confirmation avant une action importante (accepter une proposition, annuler une commande, vider la sélection).
// Bloc dans la page (pas de fenêtre modale) : le focus y est placé à l'ouverture, « Retour » ferme sans rien faire.
import { useEffect, useId, useRef } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';

import { useTraduction } from '@/i18n/index.js';

import styles from './Composants.module.css';

export default function Confirmation({
  titre, children, libelleConfirmer, libelleRetour, onConfirmer, onRetour, chargement = false, danger = false,
}) {
  const { t } = useTraduction();
  const id = useId();
  const racine = useRef(null);
  useEffect(() => {
    racine.current?.focus();
  }, []);
  return (
    <div ref={racine} tabIndex={-1} role="group" aria-labelledby={id}
      className={`${styles.confirmation} ${danger ? styles.confirmationDanger : ''}`}>
      <strong id={id}>{titre}</strong>
      {children}
      <div className={styles.confirmationActions}>
        <Bouton taille="petit" variante={danger ? 'sombre' : 'plein'} onClick={onConfirmer} chargement={chargement}>
          {libelleConfirmer || t('confirmation.confirmer')}
        </Bouton>
        <Bouton taille="petit" variante="contour" onClick={onRetour} disabled={chargement}>
          {libelleRetour || t('confirmation.retour')}
        </Bouton>
      </div>
    </div>
  );
}
