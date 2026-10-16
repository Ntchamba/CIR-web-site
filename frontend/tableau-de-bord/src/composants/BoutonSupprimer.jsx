// Suppression avec confirmation dans la ligne : « Supprimer » → « Confirmer la suppression » / « Annuler ».
// L'erreur du serveur (ex. famille qui a encore des produits) s'affiche à côté des boutons.
import { useEffect, useRef, useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';

import { useTraduction } from '@/i18n/index.js';

import styles from './Composants.module.css';

export default function BoutonSupprimer({ nom, surConfirmation, libelle }) {
  const { t } = useTraduction();
  const [confirmation, setConfirmation] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const bouton = useRef(null);
  const retour = useRef(false);

  useEffect(() => {
    if (!confirmation && retour.current) bouton.current?.focus();
    retour.current = false;
  }, [confirmation]);

  async function confirmer() {
    setEnvoi(true);
    setErreur(null);
    try {
      await surConfirmation();
    } catch (e) {
      setErreur(e);
      setEnvoi(false);
    }
  }

  if (!confirmation) {
    return (
      <Bouton ref={bouton} taille="petit" variante="contour" onClick={() => setConfirmation(true)}
        aria-label={t('actions.supprimerNom', { nom })}>
        {libelle || t('actions.supprimer')}
      </Bouton>
    );
  }
  return (
    <span className={styles.confirmation} role="group" aria-label={t('actions.confirmerSuppression', { nom })}>
      {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
      <Bouton taille="petit" variante="sombre" chargement={envoi} onClick={confirmer} autoFocus>
        {t('actions.confirmerSupprimer')}
      </Bouton>
      <Bouton taille="petit" variante="texte" onClick={() => { retour.current = true; setConfirmation(false); setErreur(null); }}>
        {t('actions.annuler')}
      </Bouton>
      {erreur && <span className={styles.erreurChamp} role="alert">{erreur.message || t('actions.echec')}</span>}
    </span>
  );
}
