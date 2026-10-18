// Contrat d'une commande signée (lecture seule, pas de PDF) : référence, parties, montant, délai.
import { date, fcfa } from '@partage/utils/format.js';

import { useTraduction } from '@/i18n/index.js';

import styles from '../Commandes.module.css';

/** Une ligne du contrat : texte, ou objet { libelle | nom | produit(_nom) / design(_nom) }. */
export function libelleLigne(ligne) {
  if (typeof ligne === 'string') return ligne;
  if (!ligne) return '';
  if (ligne.libelle) return ligne.libelle;
  if (ligne.nom) return ligne.nom;
  const produit = ligne.produit_nom || ligne.produit?.nom || (typeof ligne.produit === 'string' ? ligne.produit : '');
  const design = ligne.design_nom || ligne.design?.nom || (typeof ligne.design === 'string' ? ligne.design : '');
  return [produit, design].filter(Boolean).join(' · ');
}

function Info({ libelle, children }) {
  return <div className={styles.info}><dt>{libelle}</dt><dd>{children || '—'}</dd></div>;
}

export default function ContratCommande({ contrat }) {
  const { t } = useTraduction();
  if (!contrat) return null;
  const adresse = typeof contrat.adresse === 'string' ? contrat.adresse
    : [contrat.adresse?.rue_ou_repere, contrat.adresse?.quartier, contrat.adresse?.ville].filter(Boolean).join(', ');
  return (
    <section className={`carte ${styles.carte}`} aria-labelledby="titre-contrat">
      <h2 id="titre-contrat" className={styles.titreCarte}>{t('commandes.contrat.titre')}</h2>
      <div className={styles.contrat}>
        <dl className={styles.infos}>
          <Info libelle={t('commandes.contrat.reference')}>{contrat.reference}</Info>
          <Info libelle={t('commandes.contrat.signeLe')}>{date(contrat.signe_le)}</Info>
          <Info libelle={t('commandes.contrat.accentePar')}>{contrat.accepte_par && t(`commandes.auteurs.${contrat.accepte_par}`)}</Info>
          <Info libelle={t('commandes.contrat.client')}>{contrat.client?.nom_complet}</Info>
          <Info libelle={t('commandes.contrat.adresse')}>{adresse}</Info>
          <Info libelle={t('commandes.contrat.montant')}>{fcfa(contrat.montant)}</Info>
          <Info libelle={t('commandes.contrat.prixM2')}>{contrat.prix_m2 != null ? fcfa(contrat.prix_m2) : ''}</Info>
          <Info libelle={t('commandes.contrat.delai')}>
            {contrat.delai_jours != null ? t('commandes.jours', { n: contrat.delai_jours }) : ''}
          </Info>
        </dl>
        {contrat.lignes?.length > 0 && (
          <ul className={styles.liste}>
            {contrat.lignes.map((l, i) => <li key={i}>{libelleLigne(l)}</li>)}
          </ul>
        )}
      </div>
    </section>
  );
}
