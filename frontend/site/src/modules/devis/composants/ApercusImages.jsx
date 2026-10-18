// Choix des photos d'une demande de rendu (5 au plus) avec aperçu avant l'envoi et retrait image par image.
import { useEffect, useId, useMemo, useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';

import { useTraduction } from '@/i18n/index.js';

import styles from '../Devis.module.css';

export const IMAGES_MAX = 5;

/** `fichiers` : liste de File ; `onChange(nouvelleListe)` ; `erreur` : message du serveur sur `images`. */
export default function ApercusImages({ fichiers, onChange, erreur }) {
  const { t } = useTraduction();
  const id = useId();
  const [trop, setTrop] = useState(false);

  // Une adresse d'aperçu par fichier, libérée quand le fichier est retiré ou que le composant disparaît.
  const apercus = useMemo(
    () => fichiers.map((f) => (typeof URL.createObjectURL === 'function' ? URL.createObjectURL(f) : '')),
    [fichiers],
  );
  useEffect(() => () => {
    apercus.forEach((u) => u && typeof URL.revokeObjectURL === 'function' && URL.revokeObjectURL(u));
  }, [apercus]);

  function choisir(e) {
    const images = [...e.target.files].filter((f) => f.type.startsWith('image/'));
    e.target.value = ''; // permet de rechoisir le même fichier après l'avoir retiré
    if (!images.length) return;
    const suite = [...fichiers, ...images];
    setTrop(suite.length > IMAGES_MAX);
    onChange(suite.slice(0, IMAGES_MAX));
  }

  const retirer = (i) => {
    setTrop(false);
    onChange(fichiers.filter((_, k) => k !== i));
  };
  const message = trop ? t('devis.demande.imagesTrop', { max: IMAGES_MAX }) : erreur;

  return (
    <fieldset className={styles.images} aria-describedby={`${id}-aide ${message ? `${id}-erreur` : ''}`.trim()}>
      <legend>{t('devis.demande.images')}</legend>
      <label htmlFor={id} className="visuellement-cache">{t('devis.demande.choisirImages')}</label>
      <input id={id} type="file" accept="image/*" multiple onChange={choisir} disabled={fichiers.length >= IMAGES_MAX} />
      <span id={`${id}-aide`} className={styles.aide}>
        {t('devis.demande.imagesAide', { n: fichiers.length, max: IMAGES_MAX })}
      </span>
      {message && <span id={`${id}-erreur`} className={styles.erreur} role="alert">{message}</span>}
      {fichiers.length > 0 && (
        <ul className={styles.apercus} aria-label={t('devis.demande.apercus')}>
          {fichiers.map((f, i) => (
            <li key={`${f.name}-${f.size}-${i}`}>
              {apercus[i] && <img src={apercus[i]} alt={t('devis.demande.apercuAlt', { nom: f.name })} width="120" height="90" />}
              <Bouton variante="texte" onClick={() => retirer(i)} aria-label={t('devis.demande.retirerImage', { nom: f.name })}>
                {t('devis.demande.retirer')}
              </Bouton>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}
