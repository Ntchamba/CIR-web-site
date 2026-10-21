// État d'une commande en étiquette à point de couleur (maquettes : « En négociation », « Travaux en cours », « Sol livré »).
import { useTraduction } from '@/i18n/index.js';

import styles from '../Commandes.module.css';

const COULEURS = {
  nouvelle: ['var(--st-nouvelle-f)', 'var(--st-nouvelle-t)'],
  negociation: ['#fff1d6', '#8a5a00'],
  contrat_signe: ['var(--st-contrat-f)', 'var(--st-contrat-t)'],
  travaux: ['#dcefFa', 'var(--bleu-fonce)'],
  terminee: ['#ddf3e6', '#1c6b3e'],
  annulee: ['var(--st-annulee-f)', 'var(--st-annulee-t)'],
};

/** Libellé de l'état d'une commande (celui des maquettes ; « Sol livré » pour une commande terminée). */
export function libelleEtat(t, etat) {
  return Object.hasOwn(COULEURS, etat) ? t(`commandes.etats.${etat}`) : etat;
}

export default function BadgeEtape({ etat, className = '' }) {
  const { t } = useTraduction();
  const [fond, texte] = COULEURS[etat] || COULEURS.nouvelle;
  return (
    <span className={`m-etiquette-etat ${styles.badge} ${className}`} style={{ background: fond, color: texte }}>
      {libelleEtat(t, etat)}
    </span>
  );
}
