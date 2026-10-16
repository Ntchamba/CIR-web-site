// Une ligne du tableau de l'équipe. Le retrait d'accès demande une confirmation dans la ligne.
import { useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import { date, dateHeure } from '@partage/utils/format.js';

import { useTraduction } from '@/i18n/index.js';
import { libelleRole } from '@/modules/connexion/roles.js';

import styles from '../Equipe.module.css';

export default function LigneMembre({ membre, peutGerer, estMoi, desactiver, reactiver, surErreur }) {
  const { t } = useTraduction();
  const [confirmation, setConfirmation] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  async function agir(action) {
    setEnvoi(true);
    surErreur(null);
    try {
      await action(membre.id);
      setConfirmation(false);
    } catch (e) {
      surErreur(e);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <tr className={membre.actif ? '' : styles.inactif}>
      <td>
        <strong>{membre.nom_complet}</strong>
        {estMoi && <span className={styles.moi}>{t('equipe.vous')}</span>}
        <span className={styles.secondaire}>{membre.email}</span>
      </td>
      <td>{membre.telephone || '—'}</td>
      <td>{libelleRole(membre.role)}</td>
      <td>
        <span className={`${styles.statut} ${membre.actif ? styles.statutActif : styles.statutInactif}`}>
          {membre.actif ? t('equipe.actif') : t('equipe.desactive')}
        </span>
      </td>
      <td>
        {membre.derniere_connexion ? dateHeure(membre.derniere_connexion) : t('equipe.jamais')}
        <span className={styles.secondaire}>{t('equipe.ajouteLe', { date: date(membre.date_inscription) })}</span>
      </td>
      {peutGerer && (
        <td className={styles.actions}>
          {estMoi ? null : membre.actif ? (
            confirmation ? (
              <span className={styles.confirmation} role="group" aria-label={t('equipe.confirmerRetrait', { nom: membre.nom_complet })}>
                <Bouton taille="petit" variante="sombre" chargement={envoi} onClick={() => agir(desactiver)}>
                  {t('equipe.confirmer')}
                </Bouton>
                <Bouton taille="petit" variante="texte" onClick={() => setConfirmation(false)}>{t('equipe.annuler')}</Bouton>
              </span>
            ) : (
              <Bouton taille="petit" variante="contour" onClick={() => setConfirmation(true)}
                aria-label={t('equipe.desactiverNom', { nom: membre.nom_complet })}>
                {t('equipe.desactiver')}
              </Bouton>
            )
          ) : (
            <Bouton taille="petit" variante="contour" chargement={envoi} onClick={() => agir(reactiver)}
              aria-label={t('equipe.reactiverNom', { nom: membre.nom_complet })}>
              {t('equipe.reactiver')}
            </Bouton>
          )}
        </td>
      )}
    </tr>
  );
}
