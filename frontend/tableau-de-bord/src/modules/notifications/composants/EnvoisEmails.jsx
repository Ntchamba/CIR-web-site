// BF-07 : état de la file d'envoi des e-mails (super-administrateur) : décomptes, liste filtrable, erreurs, « Réessayer ».
import { useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { dateHeure } from '@partage/utils/format.js';

import PastilleEtat from '@/composants/PastilleEtat.jsx';
import useChargement from '@/composants/useChargement.js';
import { useCriteres } from '@/composants/useCriteres.js';
import useListe from '@/composants/useListe.js';
import gestion from '@/composants/Gestion.module.css';
import { existe, useTraduction } from '@/i18n/index.js';

import { listerEnvois, reessayerEnvoi, resumeEnvois } from '../api.js';
import styles from '../Notifications.module.css';

export const ETATS_ENVOI = ['en_attente', 'envoye', 'echec', 'annule'];
const TONS = { en_attente: 'attention', envoye: 'ok', echec: 'alerte', annule: 'neutre' };

export default function EnvoisEmails() {
  const { t } = useTraduction();
  const { valeurs, page, modifier } = useCriteres(['etat']);
  const liste = useListe(listerEnvois, { etat: valeurs.etat, page });
  const resume = useChargement((signal) => resumeEnvois({ signal }), []);
  const [erreurAction, setErreurAction] = useState(null);
  const [enCours, setEnCours] = useState(null);
  const decomptes = resume.donnees || {};
  const pages = Math.max(1, Math.ceil(liste.total / 24));

  async function reessayer(envoi) {
    setErreurAction(null);
    setEnCours(envoi.id);
    try {
      await reessayerEnvoi(envoi.id);
      liste.recharger();
      resume.recharger();
    } catch (e) {
      setErreurAction(e);
    } finally {
      setEnCours(null);
    }
  }

  const libelleEvenement = (code) => (existe(`notifications.evenements.${code}`) ? t(`notifications.evenements.${code}`) : code);

  return (
    <div className={styles.envois}>
      {resume.donnees && decomptes.gmail_configure === false && (
        <p className={styles.alerte} role="alert">{t('notifications.envois.gmailNonConfigure')}</p>
      )}
      {resume.donnees && (
        <ul className={styles.decomptes} aria-label={t('notifications.envois.resume')}>
          {ETATS_ENVOI.map((etat) => (
            <li key={etat} className="carte">
              <strong>{Number(decomptes[etat]) || 0}</strong>
              <span>{t(`notifications.envois.etats.${etat}`)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className={`carte ${gestion.filtres}`}>
        <Champ libelle={t('notifications.envois.filtreEtat')} name="etat" value={valeurs.etat}
          options={[['', t('notifications.envois.tous')], ...ETATS_ENVOI.map((e) => [e, t(`notifications.envois.etats.${e}`)])]}
          onChange={(e) => modifier({ etat: e.target.value })} />
      </div>
      {erreurAction && <MessageErreur erreur={erreurAction} />}

      {liste.chargement && liste.elements.length === 0 ? (
        <Chargement texte={t('notifications.envois.chargement')} />
      ) : liste.erreur ? (
        <MessageErreur erreur={liste.erreur} reessayer={liste.recharger} />
      ) : liste.elements.length === 0 ? (
        <EtatVide titre={t('notifications.envois.aucun')}>{t('notifications.envois.aucunTexte')}</EtatVide>
      ) : (
        <>
          <div className={`carte ${gestion.tableau}`}>
            <table>
              <caption className="visuellement-cache">{t('notifications.envois.legende')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('notifications.envois.colonnes.destinataire')}</th>
                  <th scope="col">{t('notifications.envois.colonnes.evenement')}</th>
                  <th scope="col">{t('notifications.envois.colonnes.etat')}</th>
                  <th scope="col">{t('notifications.envois.colonnes.tentatives')}</th>
                  <th scope="col">{t('notifications.envois.colonnes.date')}</th>
                  <th scope="col"><span className="visuellement-cache">{t('notifications.envois.colonnes.actions')}</span></th>
                </tr>
              </thead>
              <tbody>
                {liste.elements.map((envoi) => (
                  <tr key={envoi.id}>
                    <td>{envoi.destinataire_email}</td>
                    <td>{libelleEvenement(envoi.evenement)}</td>
                    <td>
                      <PastilleEtat ton={TONS[envoi.etat] || 'neutre'}>{t(`notifications.envois.etats.${envoi.etat}`)}</PastilleEtat>
                      {envoi.derniere_erreur && <span className={styles.erreurEnvoi}>{envoi.derniere_erreur}</span>}
                    </td>
                    <td>{envoi.tentatives}</td>
                    <td>{dateHeure(envoi.envoye_le || envoi.cree_le)}</td>
                    <td className={gestion.actions}>
                      {envoi.etat === 'echec' && (
                        <Bouton variante="contour" taille="petit" chargement={enCours === envoi.id} onClick={() => reessayer(envoi)}
                          aria-label={t('notifications.envois.reessayerPour', { email: envoi.destinataire_email })}>
                          {t('notifications.envois.reessayer')}
                        </Bouton>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(liste.precedente || liste.suivante) && (
            <nav className={gestion.pagination} aria-label={t('notifications.envois.pagination')}>
              <Bouton variante="contour" taille="petit" disabled={!liste.precedente} onClick={() => modifier({ page: page - 1 })}>
                {t('pagination.precedente')}
              </Bouton>
              <span>{t('pagination.pageSur', { page, pages })}</span>
              <Bouton variante="contour" taille="petit" disabled={!liste.suivante} onClick={() => modifier({ page: page + 1 })}>
                {t('pagination.suivante')}
              </Bouton>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
