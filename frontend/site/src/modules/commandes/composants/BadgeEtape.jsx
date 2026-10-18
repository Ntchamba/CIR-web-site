// Étape d'une commande en pastille de couleur (jetons --st-*), libellé traduit de STATUTS.
import { STATUTS } from '@partage/utils/format.js';

import styles from '../Commandes.module.css';

export default function BadgeEtape({ etat }) {
  const statut = Object.hasOwn(STATUTS, etat) ? STATUTS[etat] : null;
  const classe = statut?.classe || 'nouvelle';
  return (
    <span className={styles.badge} style={{ background: `var(--st-${classe}-f)`, color: `var(--st-${classe}-t)` }}>
      {statut ? statut.libelle : etat}
    </span>
  );
}
