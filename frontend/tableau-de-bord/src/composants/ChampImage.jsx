// Choix d'une image (ou d'une vidéo avec `video`) : aperçu de l'image actuelle ou du fichier choisi, envoi par
// le formulaire parent, erreur du serveur (400) affichée sous le champ. Contrôle local de la taille.
//
//   <ChampImage libelle="Photo après" image={realisation.image_apres} fichier={fichiers.image_apres}
//     surChoix={(f) => …} surRetrait={() => …} erreur={erreurs.image_apres} required />
//
// `image` : adresse (chaîne) ou objet { url, alt }. `surChoix(File | null)`. `surRetrait` (facultatif) : propose
// « Retirer » pour une image existante facultative.
import { useEffect, useId, useState } from 'react';

import { useTraduction } from '@/i18n/index.js';

import styles from './Composants.module.css';

export const TYPES_IMAGES = 'image/jpeg,image/png,image/webp';
export const TYPES_VIDEOS = 'video/mp4,video/webm';
const MEGA_OCTET = 1024 * 1024;

const adresse = (image) => (typeof image === 'string' ? image : image?.url) || '';

/** Adresse d'aperçu d'un fichier local (révoquée au changement). */
function useApercu(fichier) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!fichier || typeof URL.createObjectURL !== 'function') {
      setUrl('');
      return undefined;
    }
    const lien = URL.createObjectURL(fichier);
    setUrl(lien);
    return () => URL.revokeObjectURL?.(lien);
  }, [fichier]);
  return url;
}

export default function ChampImage({
  libelle, image, fichier, surChoix, surRetrait, erreur, aide, required = false, video = false,
  tailleMaxMo = video ? 50 : 10, name,
}) {
  const { t } = useTraduction();
  const id = useId();
  const [erreurLocale, setErreurLocale] = useState('');
  const apercuLocal = useApercu(fichier);
  const actuelle = adresse(image);
  const source = apercuLocal || (fichier ? '' : actuelle);
  const message = erreurLocale || erreur;
  const decrit = [`${id}-aide`, message && `${id}-erreur`].filter(Boolean).join(' ');

  function choisir(e) {
    const f = e.target.files?.[0] || null;
    e.target.value = ''; // permet de choisir à nouveau le même fichier
    if (!f) return;
    if (f.size > tailleMaxMo * MEGA_OCTET) {
      setErreurLocale(t('fichiers.tropLourd', { max: tailleMaxMo }));
      return;
    }
    setErreurLocale('');
    surChoix(f);
  }

  return (
    <div className={styles.champImage}>
      <span className={styles.libelleImage} id={`${id}-libelle`}>
        {libelle}
        {required && <span className={styles.obligatoire} aria-hidden="true"> *</span>}
      </span>
      <div className={styles.zoneImage}>
        <div className={styles.apercu}>
          {source ? (
            video ? <video src={source} muted controls preload="metadata" aria-label={t('fichiers.apercu')} />
              : <img src={source} alt={t('fichiers.apercu')} />
          ) : (
            <span className={styles.sansImage}>{video ? t('fichiers.aucuneVideo') : t('fichiers.aucuneImage')}</span>
          )}
        </div>
        <div className={styles.actionsImage}>
          <label htmlFor={id} className={styles.boutonFichier}>
            {actuelle || fichier ? (video ? t('fichiers.remplacerVideo') : t('fichiers.remplacer'))
              : (video ? t('fichiers.choisirVideo') : t('fichiers.choisir'))}
          </label>
          <input id={id} type="file" name={name} accept={video ? TYPES_VIDEOS : TYPES_IMAGES} onChange={choisir}
            className={styles.fichierCache} aria-labelledby={`${id}-libelle`} aria-describedby={decrit}
            aria-invalid={message ? true : undefined} aria-required={required || undefined} />
          {fichier && (
            <>
              <span className={styles.nomFichier}>{t('fichiers.choisi', { nom: fichier.name })}</span>
              <button type="button" className={styles.lienAction} onClick={() => surChoix(null)}>
                {t('fichiers.annulerChoix')}
              </button>
            </>
          )}
          {!fichier && actuelle && surRetrait && (
            <button type="button" className={styles.lienAction} onClick={surRetrait}>
              {video ? t('fichiers.retirerVideo') : t('fichiers.retirer')}
            </button>
          )}
        </div>
      </div>
      <span id={`${id}-aide`} className={styles.aide}>
        {aide || (video ? t('fichiers.aideVideo', { max: tailleMaxMo }) : t('fichiers.aideImage', { max: tailleMaxMo }))}
      </span>
      {message && <span id={`${id}-erreur`} className={styles.erreurChamp}>{message}</span>}
    </div>
  );
}
