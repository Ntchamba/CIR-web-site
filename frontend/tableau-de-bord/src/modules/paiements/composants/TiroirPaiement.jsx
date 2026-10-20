// Détail d'un paiement dans un tiroir : références, opérateur, état, raison (traduite par le serveur), dernière
// vérification, bouton « Revérifier » (en attente, expiré, anomalie) et lien vers la commande.
// Le numéro de téléphone n'apparaît que masqué (`telephone_masque`).
import { useState } from 'react';
import { Link } from 'react-router';

import Bouton from '@partage/ui/Bouton.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { dateHeure, fcfa } from '@partage/utils/format.js';

import Tiroir from '@/composants/Tiroir.jsx';
import { useTraduction } from '@/i18n/index.js';

import { ETATS_REVERIFIABLES, reverifierPaiement } from '../api.js';
import styles from '../Paiements.module.css';
import { PastilleEtatPaiement } from './PastillesPaiement.jsx';

function Info({ libelle, children }) {
  return <div className={styles.info}><dt>{libelle}</dt><dd>{children || '—'}</dd></div>;
}

/** `saisi_par` : nom ou objet { nom_complet }. */
const nomPersonne = (v) => (v && typeof v === 'object' ? v.nom_complet || '' : v || '');

export default function TiroirPaiement({ paiement, surFermeture, surMiseAJour }) {
  const { t } = useTraduction();
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [annonce, setAnnonce] = useState('');
  const peutReverifier = ETATS_REVERIFIABLES.includes(paiement.etat);
  const manuel = paiement.mode === 'manuel';

  async function reverifier() {
    setEnvoi(true);
    setErreur(null);
    setAnnonce('');
    try {
      const maj = await reverifierPaiement(paiement.id);
      surMiseAJour({ ...paiement, ...maj, id: paiement.id });
      setAnnonce(t('paiements.tiroir.reverifie'));
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Tiroir ouvert large titre={t('paiements.tiroir.titre', { reference: paiement.reference })}
      sousTitre={t(`paiements.modes.${paiement.mode}`)} surFermeture={surFermeture}>
      <p role="status" aria-live="polite" className={annonce ? styles.annonce : 'visuellement-cache'}>{annonce}</p>

      {paiement.etat === 'anomalie' && <p className={styles.avertissement}>{t('paiements.tiroir.aideAnomalie')}</p>}

      <section className={styles.section} aria-labelledby="paiement-resume">
        <h3 id="paiement-resume" className={styles.titreSection}>{t('paiements.tiroir.paiement')}</h3>
        <dl className={styles.infos}>
          <Info libelle={t('paiements.tiroir.montant')}>{fcfa(paiement.montant)}</Info>
          <Info libelle={t('paiements.tiroir.etat')}><PastilleEtatPaiement paiement={paiement} /></Info>
          {paiement.raison && (
            <Info libelle={t('paiements.tiroir.raison')}>{paiement.raison_libelle || paiement.raison}</Info>
          )}
          <Info libelle={t('paiements.tiroir.commande')}>
            {paiement.commande?.id ? (
              <Link to={`/commandes/${paiement.commande.id}`}>{paiement.commande.reference}</Link>
            ) : null}
          </Info>
          <Info libelle={t('paiements.tiroir.client')}>
            {paiement.client?.id ? <Link to={`/clients/${paiement.client.id}`}>{paiement.client.nom_complet}</Link> : paiement.client?.nom_complet}
          </Info>
          <Info libelle={t('paiements.tiroir.creeLe')}>{dateHeure(paiement.cree_le)}</Info>
          {paiement.termine_le && <Info libelle={t('paiements.tiroir.termineLe')}>{dateHeure(paiement.termine_le)}</Info>}
        </dl>
      </section>

      <section className={styles.section} aria-labelledby="paiement-references">
        <h3 id="paiement-references" className={styles.titreSection}>{t('paiements.tiroir.references')}</h3>
        <dl className={styles.infos}>
          {manuel ? (
            <>
              <Info libelle={t('paiements.tiroir.modeManuel')}>
                {paiement.mode_manuel && t(`paiements.modesManuels.${paiement.mode_manuel}`)}
              </Info>
              <Info libelle={t('paiements.tiroir.saisiPar')}>{nomPersonne(paiement.saisi_par)}</Info>
              <Info libelle={t('paiements.tiroir.note')}>{paiement.note}</Info>
            </>
          ) : (
            <>
              <Info libelle={t('paiements.tiroir.operateur')}>{paiement.operateur}</Info>
              {paiement.telephone_masque && (
                <Info libelle={t('paiements.tiroir.telephone')}>{paiement.telephone_masque}</Info>
              )}
              <Info libelle={t('paiements.tiroir.referenceCampay')}>{paiement.reference_campay}</Info>
              <Info libelle={t('paiements.tiroir.referenceOperateur')}>{paiement.reference_operateur}</Info>
              <Info libelle={t('paiements.tiroir.derniereVerification')}>
                {paiement.derniere_verification_le ? dateHeure(paiement.derniere_verification_le) : t('paiements.tiroir.jamaisVerifie')}
              </Info>
            </>
          )}
        </dl>
      </section>

      <div className={styles.actions}>
        {peutReverifier && (
          <Bouton chargement={envoi} onClick={reverifier}>{t('paiements.tiroir.reverifier')}</Bouton>
        )}
        {paiement.commande?.id && (
          <Bouton as={Link} to={`/commandes/${paiement.commande.id}`} variante="contour">
            {t('paiements.tiroir.voirCommande')}
          </Bouton>
        )}
      </div>
      {erreur && <MessageErreur erreur={erreur} />}
    </Tiroir>
  );
}
