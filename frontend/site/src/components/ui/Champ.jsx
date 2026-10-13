// Champ de formulaire avec libellé, aide et message d'erreur.
import { useId } from 'react';

import styles from './ui.module.css';

export default function Champ({ libelle, aide, erreur, type = 'text', options, multiligne, ...props }) {
  const id = useId();
  const decrit = [aide && `${id}-aide`, erreur && `${id}-erreur`].filter(Boolean).join(' ') || undefined;
  const commun = { id, 'aria-describedby': decrit, 'aria-invalid': erreur ? true : undefined, ...props };
  let saisie;
  if (options) {
    saisie = (
      <select {...commun}>
        {options.map(([valeur, texte]) => <option key={valeur} value={valeur}>{texte}</option>)}
      </select>
    );
  } else if (multiligne) {
    saisie = <textarea {...commun} />;
  } else {
    saisie = <input type={type} {...commun} />;
  }
  return (
    <div className={styles.champ}>
      <label htmlFor={id}>{libelle}</label>
      {saisie}
      {aide && <span id={`${id}-aide`} className={styles.aide}>{aide}</span>}
      {erreur && <span id={`${id}-erreur`} className={styles.erreurChamp}>{erreur}</span>}
    </div>
  );
}
