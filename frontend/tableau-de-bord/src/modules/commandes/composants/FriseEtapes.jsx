// Frise des étapes d'une commande (Nouvelle → En négociation → Contrat signé → Travaux en cours → Terminée)
// avec l'historique des changements. L'étape courante est annoncée (aria-current) ; « Annulée » est à part.
// La frise n'ouvre aucune transition : les boutons viennent de `actions_possibles` (voir DetailCommande).
import { date, dateHeure, STATUTS } from '@partage/utils/format.js';

import { useTraduction } from '@/i18n/index.js';

import { ETAPES } from '../useCommandes.js';
import styles from '../Commandes.module.css';

export default function FriseEtapes({ etat, historique = [], creeLe }) {
  const { t } = useTraduction();
  const courante = ETAPES.indexOf(etat);
  const dateEtape = (cle) => {
    if (cle === 'nouvelle') return creeLe;
    return [...historique].reverse().find((h) => h.vers === cle)?.cree_le;
  };
  const annulee = etat === 'annulee';

  return (
    <div>
      <ol className={styles.frise} aria-label={t('commandes.frise.nom')}>
        {ETAPES.map((cle, i) => {
          const estCourante = cle === etat;
          const faite = !annulee && courante > i;
          const jour = dateEtape(cle);
          return (
            <li key={cle} aria-current={estCourante ? 'step' : undefined}
              className={`${styles.etape} ${faite ? styles.etapeFaite : ''} ${estCourante ? styles.etapeCourante : ''}`}>
              <strong>{STATUTS[cle].libelle}</strong>
              {jour && (estCourante || faite) && <small>{date(jour)}</small>}
              {estCourante && <small>{t('commandes.frise.courante')}</small>}
            </li>
          );
        })}
        {annulee && (
          <li aria-current="step" className={`${styles.etape} ${styles.etapeCourante}`}>
            <strong>{STATUTS.annulee.libelle}</strong>
            {dateEtape('annulee') && <small>{date(dateEtape('annulee'))}</small>}
            <small>{t('commandes.frise.courante')}</small>
          </li>
        )}
      </ol>
      {historique.length > 0 && (
        <details>
          <summary>{t('commandes.frise.historique', { n: historique.length })}</summary>
          <ul className={styles.historique}>
            {historique.map((h, i) => (
              <li key={`${h.cree_le}-${i}`}>
                {t('commandes.frise.ligne', {
                  date: dateHeure(h.cree_le),
                  de: STATUTS[h.de]?.libelle || h.de || '—',
                  vers: STATUTS[h.vers]?.libelle || h.vers,
                  par: t(`commandes.auteurs.${h.par}`),
                })}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
