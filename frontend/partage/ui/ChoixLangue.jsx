// Choix de la langue de l'interface : liste native (accessible au clavier et sur téléphone), chaque
// langue écrite dans sa propre langue (« 日本語 », « Deutsch ») pour être reconnue sans lire le français.
// `surChangement(code)` est appelé après le changement (ex. enregistrer la langue dans le compte).
import { useId } from 'react';

import useTraduction from '../i18n/useTraduction.js';
import Icone from './Icone.jsx';
import styles from './ui.module.css';

export default function ChoixLangue({ className = '', surChangement }) {
  const { t, langue, langues, changerLangue } = useTraduction();
  const id = useId();

  async function changer(e) {
    const code = await changerLangue(e.target.value);
    surChangement?.(code);
  }

  return (
    <div className={`${styles.langue} ${className}`}>
      <label htmlFor={id} className="visuellement-cache">{t('langue.choisir')}</label>
      <Icone nom="langue" taille={18} className={styles.langueIcone} />
      <select id={id} value={langue} onChange={changer}>
        {langues.map((l) => (
          <option key={l.code} value={l.code} lang={l.html}>{l.nom}</option>
        ))}
      </select>
    </div>
  );
}
