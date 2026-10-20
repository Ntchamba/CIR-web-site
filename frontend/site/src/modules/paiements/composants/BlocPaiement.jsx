// Bloc « Paiement » du détail d'une commande : montant convenu, déjà payé, reste à payer, statut, paiements,
// et bouton « Payer » seulement si le contrat est signé, s'il reste un montant et si le service est configuré.
import { Link } from 'react-router';

import Bouton from '@partage/ui/Bouton.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { dateHeure, fcfa } from '@partage/utils/format.js';

import { useTraduction } from '@/i18n/index.js';

import { montantPaye, peutPayer, resteAPayer } from '../regles.js';
import { useDisponibilite, usePaiementsCommande } from '../usePaiements.js';
import styles from '../Paiements.module.css';

const STATUTS = ['non_applicable', 'non_paye', 'partiel', 'paye'];

export default function BlocPaiement({ commande, onActualiser }) {
  const { t } = useTraduction();
  const dispo = useDisponibilite();
  const liste = usePaiementsCommande(commande.id, { surReussi: () => onActualiser?.()?.catch?.(() => {}) });
  const statut = STATUTS.includes(commande.statut_paiement) ? commande.statut_paiement : 'non_applicable';
  const reste = resteAPayer(commande);
  const convenu = statut !== 'non_applicable';
  const payable = peutPayer(commande);

  let explication = null;
  if (statut === 'non_applicable') explication = t('paiements.bloc.apresContrat');
  else if (statut === 'paye') explication = t('paiements.bloc.solde');
  else if (payable && !dispo.chargement && !dispo.configure) explication = t('paiements.bloc.bientot');

  return (
    <section aria-labelledby="titre-paiement" className={styles.bloc}>
      <div className={styles.enteteBloc}>
        <h2 id="titre-paiement">{t('paiements.bloc.titre')}</h2>
        <span className={`${styles.pastille} ${styles[`statut_${statut}`]}`}>{t(`paiements.statut.${statut}`)}</span>
      </div>

      {convenu && (
        <dl className={styles.chiffres}>
          <div><dt>{t('paiements.bloc.convenu')}</dt><dd>{fcfa(commande.montant_convenu)}</dd></div>
          <div><dt>{t('paiements.bloc.paye')}</dt><dd>{fcfa(montantPaye(commande))}</dd></div>
          <div><dt>{t('paiements.bloc.reste')}</dt><dd>{fcfa(reste)}</dd></div>
        </dl>
      )}

      {explication && <p className={styles.meta}>{explication}</p>}
      {payable && dispo.configure && (
        <div className={styles.rangee}>
          <Bouton as={Link} to={`/commandes/${commande.id}/payer`}>{t('paiements.bloc.payer')}</Bouton>
        </div>
      )}

      {liste.erreur && <MessageErreur erreur={liste.erreur} reessayer={liste.recharger} />}
      {liste.paiements.length > 0 && (
        <>
          <h3>{t('paiements.bloc.liste')}</h3>
          <ul className={styles.liste}>
            {liste.paiements.map((p) => (
              <li key={p.id} className={styles.ligne}>
                <div>
                  <strong>{fcfa(p.montant)}</strong>
                  <span className={styles.meta}> · {p.reference} · {dateHeure(p.termine_le || p.cree_le)}</span>
                  {p.telephone_masque && <span className={styles.meta}> · {p.telephone_masque}</span>}
                </div>
                <span className={`${styles.pastille} ${styles[`etat_${p.etat}`] || ''}`}>{p.etat_libelle || t(`paiements.etats.${p.etat}.titre`)}</span>
                {p.etat === 'reussi' && (
                  <Link to={`/paiements/${p.id}/recu`} className={styles.lien}>{t('paiements.bloc.recu')}</Link>
                )}
                {p.etat === 'en_attente' && (
                  <Link to={`/commandes/${commande.id}/payer?paiement=${p.id}`} className={styles.lien}>{t('paiements.bloc.suivre')}</Link>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
