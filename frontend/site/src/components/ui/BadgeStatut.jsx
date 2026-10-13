// Étiquette colorée du statut d'une commande (Nouvelle, En négociation…).
import { STATUTS } from '@shared/format.js';

import styles from './ui.module.css';

export default function BadgeStatut({ statut, libelle }) {
  const info = STATUTS[statut] || { libelle: libelle || statut, classe: 'annulee' };
  return <span className={`${styles.badge} ${styles[info.classe]}`}>{libelle || info.libelle}</span>;
}
