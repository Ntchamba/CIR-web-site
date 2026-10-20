// Écran d'attente et états finaux d'un paiement. Mise à jour en direct (trame `paiement_mis_a_jour`) avec repli
// sur le serveur toutes les 4 s ; l'état affiché est toujours celui que le serveur a revérifié.
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import Bouton from '@partage/ui/Bouton.jsx';
import Icone from '@partage/ui/Icone.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { fcfa } from '@partage/utils/format.js';

import { useTraduction } from '@/i18n/index.js';

import * as paiements from '../api.js';
import { adresseSure } from '../navigation.js';
import { ATTENTE_INDICATIVE_MS, texteRaison } from '../regles.js';
import { useSuiviPaiement } from '../usePaiements.js';
import styles from '../Paiements.module.css';

/** Compte à rebours indicatif (la décision vient du serveur, jamais de cette horloge). */
function useReste(paiement) {
  const attend = paiement?.etat === 'en_attente';
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    if (!attend) return undefined;
    setMaintenant(Date.now());
    const minuteur = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(minuteur);
  }, [attend]);
  const debut = new Date(paiement?.cree_le).getTime();
  if (!attend || Number.isNaN(debut)) return null;
  return Math.max(0, Math.ceil((debut + ATTENTE_INDICATIVE_MS - maintenant) / 1000));
}

const horloge = (secondes) => `${Math.floor(secondes / 60)}:${String(secondes % 60).padStart(2, '0')}`;

export default function SuiviPaiement({ paiement: initial, commandeId, onRecommencer }) {
  const { t } = useTraduction();
  const { paiement, setPaiement } = useSuiviPaiement(initial);
  const reste = useReste(paiement);
  const [annulation, setAnnulation] = useState({ envoi: false, erreur: null });

  async function annuler() {
    setAnnulation({ envoi: true, erreur: null });
    try {
      setPaiement(await paiements.annuler(paiement.id));
      setAnnulation({ envoi: false, erreur: null });
    } catch (erreur) {
      setAnnulation({ envoi: false, erreur });
    }
  }

  const commande = `/commandes/${commandeId ?? paiement.commande?.id}`;
  const retour = <Bouton as={Link} to={commande} variante="contour">{t('paiements.suivi.retourCommande')}</Bouton>;
  const montant = fcfa(paiement.montant);

  if (paiement.etat === 'en_attente') {
    const lien = paiement.mode === 'lien';
    return (
      <section aria-labelledby="titre-suivi" className={styles.bloc}>
        <h2 id="titre-suivi">{t('paiements.suivi.titre', { montant })}</h2>
        <div role="status" className={styles.attente}>
          <span className={styles.roue} aria-hidden="true" />
          <div>
            <p className={styles.gras}>{lien ? t('paiements.suivi.attenteLien') : t('paiements.suivi.attenteMobile')}</p>
            {!lien && paiement.telephone_masque && (
              <p>{t('paiements.suivi.demandeEnvoyee', { telephone: paiement.telephone_masque })}</p>
            )}
            {paiement.code_ussd && (
              <p>{t('paiements.suivi.ussd')} <strong className={styles.ussd}>{paiement.code_ussd}</strong></p>
            )}
          </div>
        </div>
        <p className={styles.meta} aria-hidden="true">
          {reste ? t('paiements.suivi.reste', { temps: horloge(reste) }) : t('paiements.suivi.delaiEcoule')}
        </p>
        <p className={styles.meta}>{t('paiements.suivi.automatique')}</p>
        <div className={styles.rangee}>
          {lien && paiement.lien && adresseSure(paiement.lien) && (
            <Bouton as="a" href={paiement.lien}>{t('paiements.suivi.reprendreLien')}</Bouton>
          )}
          {paiement.peut_annuler && (
            <Bouton variante="contour" chargement={annulation.envoi} onClick={annuler}>{t('paiements.suivi.annuler')}</Bouton>
          )}
          {retour}
        </div>
        <MessageErreur erreur={annulation.erreur} />
      </section>
    );
  }

  const finaux = {
    reussi: { titre: t('paiements.etats.reussi.titre'), texte: t('paiements.etats.reussi.texte', { montant }), classe: styles.ok },
    echoue: { titre: t('paiements.etats.echoue.titre'), texte: texteRaison(paiement), classe: styles.echec },
    expire: { titre: t('paiements.etats.expire.titre'), texte: t('paiements.etats.expire.texte'), classe: styles.echec },
    annule: { titre: t('paiements.etats.annule.titre'), texte: t('paiements.etats.annule.texte'), classe: styles.echec },
    anomalie: { titre: t('paiements.etats.anomalie.titre'), texte: t('paiements.etats.anomalie.texte'), classe: styles.verif },
  };
  const final = finaux[paiement.etat] || finaux.anomalie;
  return (
    <section aria-labelledby="titre-suivi" className={`${styles.bloc} ${final.classe}`}>
      <div role="status">
        <h2 id="titre-suivi">{final.titre}</h2>
        <p>{final.texte}</p>
        {paiement.reference && <p className={styles.meta}>{t('paiements.reference', { reference: paiement.reference })}</p>}
      </div>
      <div className={styles.rangee}>
        {paiement.etat === 'reussi' && (
          <Bouton as={Link} to={`/paiements/${paiement.id}/recu`}>
            <Icone nom="commandes" taille={16} />&nbsp;{t('paiements.suivi.voirRecu')}
          </Bouton>
        )}
        {paiement.etat === 'echoue' && onRecommencer && <Bouton onClick={onRecommencer}>{t('paiements.suivi.reessayer')}</Bouton>}
        {['expire', 'annule'].includes(paiement.etat) && onRecommencer && (
          <Bouton onClick={onRecommencer}>{t('paiements.suivi.recommencer')}</Bouton>
        )}
        {retour}
      </div>
    </section>
  );
}
