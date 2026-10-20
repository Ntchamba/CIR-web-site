// Pastilles d'un paiement : état (libellé du serveur, déjà traduit) et statut de paiement d'une commande.
import PastilleEtat, { PastilleUrgente } from '@/composants/PastilleEtat.jsx';
import { useTraduction } from '@/i18n/index.js';

const TONS_ETAT = { reussi: 'ok', en_attente: 'attention', echoue: 'alerte', anomalie: 'alerte', expire: 'neutre', annule: 'neutre' };
const TONS_STATUT = { non_applicable: 'neutre', non_paye: 'alerte', partiel: 'attention', paye: 'ok' };

/** État d'un paiement ; une anomalie ajoute un badge « À vérifier ». */
export function PastilleEtatPaiement({ paiement }) {
  const { t } = useTraduction();
  const libelle = paiement.etat_libelle || t(`paiements.etats.${paiement.etat}`);
  return (
    <>
      <PastilleEtat ton={TONS_ETAT[paiement.etat] || 'neutre'}>{libelle}</PastilleEtat>
      {paiement.etat === 'anomalie' && <PastilleUrgente>{t('paiements.anomalieCourt')}</PastilleUrgente>}
    </>
  );
}

/** Statut de paiement d'une commande (non_applicable, non_paye, partiel, paye). */
export function PastilleStatutPaiement({ statut }) {
  const { t } = useTraduction();
  if (!statut) return <span>—</span>;
  return <PastilleEtat ton={TONS_STATUT[statut] || 'neutre'}>{t(`paiements.statuts.${statut}`)}</PastilleEtat>;
}
