// Pastilles d'état. `PastilleEtape` suit les couleurs des étapes d'une commande (STATUTS) ;
// `PastilleEtat` prend une famille de couleurs de Gestion.module.css (ok, attention, info, neutre, alerte).
import { STATUTS } from '@partage/utils/format.js';

import { useTraduction } from '@/i18n/index.js';

import gestion from './Gestion.module.css';
import styles from './Pilotage.module.css';

export function PastilleEtape({ etat }) {
  const statut = STATUTS[etat];
  if (!statut) return <span className={styles.pastille}>{etat}</span>;
  return (
    <span className={styles.pastille}
      style={{ background: `var(--st-${statut.classe}-f)`, color: `var(--st-${statut.classe}-t)` }}>
      {statut.libelle}
    </span>
  );
}

export default function PastilleEtat({ ton = 'neutre', children }) {
  return <span className={`${gestion.pastille} ${gestion[ton]}`}>{children}</span>;
}

/** Badge « action requise » : à traiter par l'équipe. */
export function PastilleUrgente({ children }) {
  return <span className={`${styles.pastille} ${styles.urgente}`}>{children}</span>;
}

const TONS_DEVIS = { brouillon: 'neutre', envoye: 'info', accepte: 'ok', refuse: 'alerte', remplace: 'neutre' };

/** État d'un devis (brouillon, envoyé, accepté, refusé, remplacé) ; un devis envoyé et expiré est signalé. */
export function PastilleDevis({ etat, expire = false }) {
  const { t } = useTraduction();
  return (
    <>
      <PastilleEtat ton={TONS_DEVIS[etat] || 'neutre'}>{t(`devis.etats.${etat}`)}</PastilleEtat>
      {expire && <PastilleEtat ton="attention">{t('devis.expire')}</PastilleEtat>}
    </>
  );
}
