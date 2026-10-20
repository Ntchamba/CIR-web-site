// Pièce jointe d'un message : aperçu pour les images, bouton de téléchargement. Les fichiers sont privés :
// ils sont demandés avec le jeton de connexion (voir api.js), puis affichés ou enregistrés.
import { useEffect, useState } from 'react';

import Icone from '@partage/ui/Icone.jsx';

import { useTraduction } from '@/i18n/index.js';

import { recupererFichier } from '../api.js';
import styles from '../Messagerie.module.css';

import { tailleLisible } from './tailles.js';

const peutCreerAdresse = () => typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';

export default function PieceJointe({ piece }) {
  const { t } = useTraduction();
  const [apercu, setApercu] = useState(null);
  const [erreur, setErreur] = useState(false);
  const [telechargement, setTelechargement] = useState(false);
  const estImage = piece.type === 'image';

  // Aperçu des images : avant l'envoi, le fichier local ; ensuite, le fichier privé du serveur.
  useEffect(() => {
    if (!estImage || !peutCreerAdresse()) return undefined;
    let adresse = null;
    let actif = true;
    if (piece.local) {
      adresse = URL.createObjectURL(piece.local);
      setApercu(adresse);
    } else if (piece.url) {
      recupererFichier(piece.url)
        .then((blob) => {
          if (!actif) return;
          adresse = URL.createObjectURL(blob);
          setApercu(adresse);
        })
        .catch(() => actif && setErreur(true));
    }
    return () => {
      actif = false;
      if (adresse && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(adresse);
    };
  }, [estImage, piece.local, piece.url]);

  async function telecharger() {
    if (!piece.url || !peutCreerAdresse()) return;
    setErreur(false);
    setTelechargement(true);
    try {
      const blob = await recupererFichier(piece.url);
      const adresse = URL.createObjectURL(blob);
      const lien = document.createElement('a');
      lien.href = adresse;
      lien.download = piece.nom_original || '';
      lien.rel = 'noopener';
      document.body.appendChild(lien);
      lien.click();
      lien.remove();
      setTimeout(() => URL.revokeObjectURL(adresse), 10_000);
    } catch {
      setErreur(true);
    } finally {
      setTelechargement(false);
    }
  }

  const libelle = `${piece.nom_original} (${tailleLisible(piece.taille)})`;
  return (
    <div className={styles.piece}>
      {estImage && apercu && <img src={apercu} alt={t('messagerie.pieces.image', { nom: piece.nom_original })} className={styles.apercuPiece} />}
      {piece.url ? (
        <button type="button" className={styles.boutonPiece} onClick={telecharger} disabled={telechargement}
          aria-label={t('messagerie.pieces.telecharger', { nom: libelle })}>
          <Icone nom="trombone" taille={16} /><span className={styles.nomPiece}>{libelle}</span>
        </button>
      ) : (
        <span className={styles.boutonPiece}><Icone nom="trombone" taille={16} /><span className={styles.nomPiece}>{libelle}</span></span>
      )}
      {erreur && <span className={styles.erreurTexte} role="alert">{t('messagerie.pieces.echecTelechargement')}</span>}
    </div>
  );
}
