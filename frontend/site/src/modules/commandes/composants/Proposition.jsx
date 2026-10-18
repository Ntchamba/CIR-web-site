// Une proposition de la négociation : auteur, date, état, prix au m², total, délai et message (texte libre, non traduit).
import { dateHeure, fcfa } from '@partage/utils/format.js';

import { useTraduction } from '@/i18n/index.js';

import styles from '../Commandes.module.css';

export default function Proposition({ proposition: p, mise = false }) {
  const { t } = useTraduction();
  const auteur = t(`commandes.negociation.auteur.${p.auteur_role === 'equipe' ? 'equipe' : 'client'}`);
  const prixM2 = p.prix_m2 ?? null;
  return (
    <article className={`${styles.proposition} ${mise ? styles.propositionEnCours : ''}`} id={`proposition-${p.id}`}>
      <header>
        <strong>{auteur}</strong>
        <span className={styles.badgeNeutre}>{t(`commandes.negociation.etats.${p.etat}`)}</span>
        <time dateTime={p.cree_le}>{dateHeure(p.cree_le)}</time>
      </header>
      <dl className={styles.chiffres}>
        {p.total !== null && p.total !== undefined && (
          <div><dt>{t('commandes.proposition.total')}</dt><dd>{fcfa(p.total)}</dd></div>
        )}
        {prixM2 !== null && (
          <div><dt>{t('commandes.proposition.prixM2')}</dt><dd>{t('commandes.negociation.parM2', { montant: fcfa(prixM2) })}</dd></div>
        )}
        {p.delai_jours ? (
          <div><dt>{t('commandes.proposition.delai')}</dt><dd>{t('commandes.negociation.jours', { n: p.delai_jours })}</dd></div>
        ) : null}
      </dl>
      {p.message && <p className={styles.messageLibre}>{p.message}</p>}
      {p.devis ? <p className={styles.meta}><a href="#devis">{t('commandes.negociation.issueDuDevis')}</a></p> : null}
    </article>
  );
}
