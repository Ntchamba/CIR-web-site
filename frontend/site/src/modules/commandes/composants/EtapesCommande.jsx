// Frise des étapes d'une commande : liste ordonnée, étape courante annoncée (aria-current + texte caché),
// dates tirées de l'historique ; « Annulée » à part. Les étapes viennent du serveur (`etat`, `historique`).
import { date, dateHeure } from '@partage/utils/format.js';

import { useTraduction } from '@/i18n/index.js';

import styles from '../Commandes.module.css';

export const ORDRE_ETAPES = ['nouvelle', 'negociation', 'contrat_signe', 'travaux', 'terminee'];

export default function EtapesCommande({ commande }) {
  const { t } = useTraduction();
  const historique = [...(commande.historique || [])].sort((a, b) => new Date(a.cree_le) - new Date(b.cree_le));
  const annulee = commande.etat === 'annulee';

  const dateDe = (cle) => (cle === 'nouvelle' ? commande.cree_le : historique.find((h) => h.vers === cle)?.cree_le);

  // Annulée : on garde les étapes atteintes avant l'annulation, puis « Annulée » comme dernière étape.
  const atteintes = new Set(['nouvelle', ...historique.flatMap((h) => [h.de, h.vers])]);
  const etapes = annulee ? [...ORDRE_ETAPES.filter((e) => atteintes.has(e)), 'annulee'] : ORDRE_ETAPES;
  const motifAnnulation = [...historique].reverse().find((h) => h.vers === 'annulee' && h.motif)?.motif || '';
  const indexCourant = etapes.indexOf(commande.etat);

  return (
    <section aria-labelledby="titre-etapes">
      <h2 id="titre-etapes" className="visuellement-cache">{t('commandes.etapes.titre')}</h2>
      <ol className="m-etapes">
        {etapes.map((cle, i) => {
          const courante = i === indexCourant;
          const faite = i < indexCourant;
          const quand = dateDe(cle);
          return (
            <li key={cle} aria-current={courante ? 'step' : undefined}
              className={`${courante ? 'encours' : ''} ${faite ? 'fait' : ''} ${cle === 'annulee' ? styles.etapeAnnulee : ''}`}>
              <b>{t(`commandes.etapes.libelles.${cle}`)}</b>
              <span className="visuellement-cache">
                {courante ? t('commandes.etapes.courante') : faite ? t('commandes.etapes.faite') : t('commandes.etapes.aVenir')}
              </span>
              <small>
                {quand && (faite || cle === 'nouvelle' || cle === 'annulee')
                  ? <time dateTime={quand}>{date(quand)}</time>
                  : courante ? t('commandes.etapes.visibleCourante') : faite ? t('commandes.etapes.visibleFaite') : t('commandes.etapes.visibleAVenir')}
              </small>
              {cle === 'annulee' && motifAnnulation && (
                <small className={styles.meta}>{t('commandes.etapes.motif', { motif: motifAnnulation })}</small>
              )}
            </li>
          );
        })}
      </ol>

      {historique.length > 0 && (
        <details className={styles.historique}>
          <summary>{t('commandes.etapes.historique')}</summary>
          <ul>
            {historique.map((h, i) => (
              <li key={`${h.cree_le}-${i}`}>
                {t('commandes.etapes.ligne', {
                  de: h.de ? t(`commandes.etats.${h.de}`) : t('commandes.etapes.creation'),
                  vers: t(`commandes.etats.${h.vers}`),
                  par: t(`commandes.etapes.par.${h.par === 'equipe' ? 'equipe' : 'client'}`),
                  date: dateHeure(h.cree_le),
                })}
                {h.motif && h.vers !== 'annulee' && <span className={styles.meta}> {t('commandes.etapes.motif', { motif: h.motif })}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
