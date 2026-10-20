// Bloc « Paiements » de la fiche commande : montant convenu, déjà payé, reste, statut, liste des paiements,
// et règlement hors ligne tant qu'il reste quelque chose à payer.
import { Link } from 'react-router';

import { dateHeure, fcfa } from '@partage/utils/format.js';
import MessageErreur from '@partage/ui/MessageErreur.jsx';

import { useTraduction } from '@/i18n/index.js';

import styles from '../Paiements.module.css';
import { usePaiementsCommande } from '../usePaiements.js';
import { PastilleEtatPaiement, PastilleStatutPaiement } from './PastillesPaiement.jsx';
import RapprochementManuel from './RapprochementManuel.jsx';

export default function BlocPaiements({ commande, surChangement, annoncer }) {
  const { t } = useTraduction();
  const { paiements, chargement, erreur, recharger } = usePaiementsCommande(commande.id, surChangement);
  const statut = commande.statut_paiement;
  const reste = commande.reste_a_payer;
  const peutRegler = ['non_paye', 'partiel'].includes(statut) && Number(reste) > 0;

  return (
    <section className={`carte ${styles.bloc}`} aria-labelledby="titre-paiements">
      <h2 id="titre-paiements" className={styles.titreCarte}>
        {t('paiements.bloc.titre')}
      </h2>

      {statut === 'non_applicable' ? (
        <p className={styles.vide}>{t('paiements.bloc.nonApplicable')}</p>
      ) : (
        <dl className={styles.chiffres}>
          <div><dt>{t('paiements.bloc.montantConvenu')}</dt><dd>{fcfa(commande.montant_convenu)}</dd></div>
          <div><dt>{t('paiements.bloc.paye')}</dt><dd>{fcfa(commande.montant_paye ?? 0)}</dd></div>
          <div><dt>{t('paiements.bloc.reste')}</dt><dd>{reste == null ? '—' : fcfa(reste)}</dd></div>
          <div><dt>{t('paiements.bloc.statut')}</dt><dd><PastilleStatutPaiement statut={statut} /></dd></div>
        </dl>
      )}

      {erreur ? (
        <MessageErreur erreur={erreur} reessayer={recharger} />
      ) : chargement ? (
        <p className={styles.vide} role="status">{t('paiements.bloc.chargement')}</p>
      ) : paiements.length === 0 ? (
        <p className={styles.vide}>{t('paiements.bloc.aucun')}</p>
      ) : (
        <div className={styles.defilement}>
          <table className={styles.tableauSimple}>
            <caption className="visuellement-cache">{t('paiements.bloc.legende')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('paiements.colonnes.reference')}</th>
                <th scope="col">{t('paiements.colonnes.date')}</th>
                <th scope="col">{t('paiements.colonnes.montant')}</th>
                <th scope="col">{t('paiements.colonnes.mode')}</th>
                <th scope="col">{t('paiements.colonnes.etat')}</th>
              </tr>
            </thead>
            <tbody>
              {paiements.map((p) => (
                <tr key={p.id}>
                  <td><Link to={`/paiements?q=${encodeURIComponent(p.reference)}`}>{p.reference}</Link></td>
                  <td>{dateHeure(p.cree_le)}</td>
                  <td>{fcfa(p.montant)}</td>
                  <td>{t(`paiements.modes.${p.mode}`)}{p.mode === 'manuel' && p.mode_manuel ? ` (${t(`paiements.modesManuels.${p.mode_manuel}`)})` : ''}</td>
                  <td><PastilleEtatPaiement paiement={p} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {peutRegler && (
        <RapprochementManuel commande={commande} annoncer={annoncer}
          surEnregistre={() => { recharger(); surChangement?.(); }} />
      )}
    </section>
  );
}
