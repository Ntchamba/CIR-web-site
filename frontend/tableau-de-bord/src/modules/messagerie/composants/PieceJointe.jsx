// Pièce jointe d'un message. Les fichiers sont privés : ils sont lus avec le jeton de la session (jamais par un lien public).
// Les images s'affichent en aperçu ; tout fichier se télécharge. Le nom du fichier est affiché tel quel, jamais interprété.
import { useEffect, useState } from 'react';

import { useTraduction } from '@/i18n/index.js';

import { lirePieceJointe } from '../api.js';
import { tailleFichier } from './formats.js';
import styles from '../Messagerie.module.css';

const peutCreerAdresse = () => typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';

export default function PieceJointe({ piece }) {
  const { t } = useTraduction();
  const [apercu, setApercu] = useState('');
  const [echec, setEchec] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const image = piece.type === 'image' && !piece.local && piece.url;

  useEffect(() => {
    if (!image || !peutCreerAdresse()) return undefined;
    let adresse = '';
    let annule = false;
    lirePieceJointe(piece.url)
      .then((blob) => { if (!annule) { adresse = URL.createObjectURL(blob); setApercu(adresse); } })
      .catch(() => { if (!annule) setEchec(true); });
    return () => { annule = true; if (adresse) URL.revokeObjectURL(adresse); };
  }, [image, piece.url]);

  async function telecharger() {
    if (!piece.url || !peutCreerAdresse()) return;
    setOccupe(true);
    setEchec(false);
    try {
      const adresse = URL.createObjectURL(await lirePieceJointe(piece.url));
      const lien = document.createElement('a');
      lien.href = adresse;
      lien.download = piece.nom_original || 'fichier';
      document.body.appendChild(lien);
      lien.click();
      lien.remove();
      setTimeout(() => URL.revokeObjectURL(adresse), 10_000);
    } catch {
      setEchec(true);
    } finally {
      setOccupe(false);
    }
  }

  return (
    <div className={styles.pieceJointe}>
      {apercu && <img src={apercu} alt={piece.nom_original} className={styles.imageJointe} loading="lazy" />}
      {piece.local ? (
        <span>{piece.nom_original} ({tailleFichier(piece.taille)})</span>
      ) : (
        <button type="button" className={styles.lienPiece} onClick={telecharger} disabled={occupe}>
          {t('messagerie.telecharger', { nom: piece.nom_original, taille: tailleFichier(piece.taille) })}
        </button>
      )}
      {echec && <span className={styles.erreurPiece} role="alert">{t('messagerie.pieceIndisponible')}</span>}
    </div>
  );
}
