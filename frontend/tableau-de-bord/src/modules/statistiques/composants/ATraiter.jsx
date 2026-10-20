// « À traiter » : ce qui attend l'équipe maintenant (ne dépend pas de la période), avec un lien vers chaque écran.
import { Link } from 'react-router';

import { useTraduction } from '@/i18n/index.js';

import styles from '../Statistiques.module.css';

/** Champ du serveur → écran concerné. */
export const LIENS_A_TRAITER = [
  ['commandes_nouvelles', '/commandes?etat=nouvelle'],
  ['propositions_en_attente_equipe', '/commandes?action=1'],
  ['devis_a_envoyer', '/devis'],
  ['demandes_rendu', '/devis?onglet=demandes'],
  ['demandes_contact', '/contact?etat=nouvelle'],
  ['messages_non_lus', '/messagerie?non_lus=1'],
  ['appels_manques', '/appels'],
  ['paiements_anomalies', '/paiements?etat=anomalie'],
];

export default function ATraiter({ donnees, masquerZeros = false, idTitre, titre }) {
  const { t } = useTraduction();
  const lignes = LIENS_A_TRAITER
    .map(([cle, lien]) => ({ cle, lien, n: Number(donnees?.[cle]) || 0 }))
    .filter((l) => !masquerZeros || l.n > 0);
  return (
    <section className={`carte ${styles.bloc}`} aria-labelledby={idTitre}>
      <h2 id={idTitre} className={styles.titreBloc}>{titre}</h2>
      {lignes.length === 0 ? (
        <p className={styles.vide}>{t('statistiques.aTraiter.rien')}</p>
      ) : (
        <ul className={styles.aTraiter}>
          {lignes.map((l) => (
            <li key={l.cle}>
              <Link to={l.lien} className={`${styles.lienATraiter} ${l.n === 0 ? styles.zero : ''}`}>
                <span>{t(`statistiques.aTraiter.${l.cle}`)}</span>
                <strong>{l.n}</strong>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
