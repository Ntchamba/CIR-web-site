// Cartes d'indicateurs d'une période. Les cartes d'argent n'existent que si le serveur envoie `montants`
// (super-administrateur) : pour un membre simple elles sont absentes, pas à zéro.
import { fcfa } from '@partage/utils/format.js';

import { localeIntl, useTraduction } from '@/i18n/index.js';

import styles from '../Statistiques.module.css';

const nombre = (v, chiffres = 0) => new Intl.NumberFormat(localeIntl(), { maximumFractionDigits: chiffres }).format(Number(v));
const estNombre = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));

function Carte({ libelle, valeur, aide }) {
  return (
    <div className={`carte ${styles.indicateur}`}>
      <dt>{libelle}</dt>
      <dd>{valeur}</dd>
      {aide && <small>{aide}</small>}
    </div>
  );
}

export default function CartesIndicateurs({ resume, titre }) {
  const { t } = useTraduction();
  const c = resume.commandes || {};
  const m = resume.montants;
  const taux = estNombre(c.taux_signature)
    ? new Intl.NumberFormat(localeIntl(), { style: 'percent', maximumFractionDigits: 1 }).format(Number(c.taux_signature))
    : '—';
  const delai = estNombre(c.delai_moyen_signature_jours)
    ? t('statistiques.joursValeur', { valeur: nombre(c.delai_moyen_signature_jours, 1) })
    : '—';
  return (
    <dl className={styles.indicateurs} aria-label={titre}>
      <Carte libelle={t('statistiques.cartes.commandes')} valeur={nombre(c.total ?? 0)}
        aide={t('statistiques.cartes.nouvelles', { n: nombre(c.nouvelles ?? 0) })} />
      <Carte libelle={t('statistiques.cartes.signees')} valeur={nombre(c.signees ?? 0)} />
      <Carte libelle={t('statistiques.cartes.taux')} valeur={taux} />
      <Carte libelle={t('statistiques.cartes.delai')} valeur={delai} />
      {m && (
        <>
          <Carte libelle={t('statistiques.cartes.chiffreConvenu')} valeur={fcfa(m.chiffre_convenu)} />
          <Carte libelle={t('statistiques.cartes.encaisse')} valeur={fcfa(m.encaisse)}
            aide={t('statistiques.cartes.nombrePaiements', { n: Number(m.nombre_paiements) || 0 })} />
          <Carte libelle={t('statistiques.cartes.reste')} valeur={fcfa(m.reste_a_encaisser)} />
          <Carte libelle={t('statistiques.cartes.panier')} valeur={estNombre(m.panier_moyen) ? fcfa(m.panier_moyen) : '—'} />
        </>
      )}
    </dl>
  );
}
