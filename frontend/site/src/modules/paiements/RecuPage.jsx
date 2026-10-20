// BF-10 : reçu d'un paiement réussi (/paiements/:id/recu). Feuille imprimable ; « Imprimer / enregistrer en PDF »
// ouvre la fenêtre d'impression du navigateur. Seul le numéro masqué fourni par le serveur peut apparaître.
import { useRef } from 'react';
import { Link, useParams } from 'react-router';

import Bouton from '@partage/ui/Bouton.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import Icone from '@partage/ui/Icone.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { dateHeure, fcfa } from '@partage/utils/format.js';
import usePageMeta from '@partage/utils/usePageMeta.js';

import { imprimerElement } from '@/composants/imprimer.js';
import { useTraduction } from '@/i18n/index.js';
import commandeStyles from '@/modules/commandes/Commandes.module.css';

import { useRecu } from './usePaiements.js';
import styles from './Paiements.module.css';

export default function RecuPage() {
  const { id } = useParams();
  const { t } = useTraduction();
  const { donnees: recu, chargement, erreur, recharger } = useRecu(id);
  const feuille = useRef(null);
  usePageMeta(recu ? t('paiements.recu.meta', { reference: recu.paiement.reference }) : t('paiements.recu.titre'));

  if (!recu) {
    if (erreur?.statut === 404) {
      return (
        <div className="conteneur section">
          <EtatVide titre={t('paiements.recu.introuvable.titre')} niveau={1}
            action={<Bouton as={Link} to="/commandes">{t('commandes.detail.retour')}</Bouton>}>
            {t('paiements.recu.introuvable.texte')}
          </EtatVide>
        </div>
      );
    }
    return (
      <div className="conteneur section">
        {chargement ? <Chargement plein /> : <MessageErreur erreur={erreur} reessayer={recharger} />}
      </div>
    );
  }

  const { paiement, commande, client, emetteur } = recu;
  return (
    <div className={`conteneur section ${styles.page}`}>
      <div className="masquer-impression">
        <Link to={`/commandes/${commande.id}`} className={commandeStyles.retour}>
          <Icone nom="retour" taille={18} />{t('paiements.page.retour')}
        </Link>
      </div>
      <div className={`${styles.enteteBloc} masquer-impression`}>
        <h1 className="titre-page">{t('paiements.recu.titre')}</h1>
        <Bouton onClick={() => imprimerElement(feuille.current)}>
          <Icone nom="commandes" taille={16} />&nbsp;{t('paiements.recu.imprimer')}
        </Bouton>
      </div>
      <article ref={feuille} className={styles.recu} aria-label={t('paiements.recu.feuille', { reference: paiement.reference })}>
        <header className={styles.recuEntete}>
          <p className={styles.recuEmetteur}>{emetteur?.nom}</p>
          {emetteur?.ville && <p className={styles.meta}>{emetteur.ville}</p>}
          <h2>{t('paiements.recu.reference', { reference: paiement.reference })}</h2>
        </header>
        <dl className={styles.chiffres}>
          <div><dt>{t('paiements.recu.date')}</dt><dd>{dateHeure(paiement.termine_le || paiement.cree_le)}</dd></div>
          <div><dt>{t('paiements.recu.client')}</dt><dd>{client?.nom_complet}</dd></div>
          <div><dt>{t('paiements.recu.commande')}</dt><dd>{commande.reference}</dd></div>
          <div><dt>{t('paiements.recu.mode')}</dt><dd>{t(`paiements.modes.${['mobile', 'lien', 'manuel'].includes(paiement.mode) ? paiement.mode : 'manuel'}`)}</dd></div>
          {paiement.operateur && <div><dt>{t('paiements.recu.operateur')}</dt><dd>{paiement.operateur}</dd></div>}
          {paiement.telephone_masque && <div><dt>{t('paiements.recu.telephone')}</dt><dd>{paiement.telephone_masque}</dd></div>}
          <div><dt>{t('paiements.recu.montant')}</dt><dd className={styles.recuMontant}>{fcfa(paiement.montant)}</dd></div>
          <div><dt>{t('paiements.recu.totalPaye')}</dt><dd>{fcfa(recu.montant_paye_total)}</dd></div>
          <div><dt>{t('paiements.bloc.reste')}</dt><dd>{fcfa(recu.reste_a_payer)}</dd></div>
        </dl>
        <p className={styles.meta}>{t('paiements.recu.mention')}</p>
      </article>
    </div>
  );
}
