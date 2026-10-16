// Champ de formulaire accessible : libellé relié, aide, message d'erreur annoncé.
// `options` ([[valeur, texte], …]) donne une liste déroulante, `multiligne` une zone de texte.
import { useId } from 'react';

import styles from './ui.module.css';

export default function Champ({ libelle, aide, erreur, type = 'text', options, multiligne, id: idFourni, required, ...props }) {
  const idAuto = useId();
  const id = idFourni || idAuto;
  const decrit = [aide && `${id}-aide`, erreur && `${id}-erreur`].filter(Boolean).join(' ') || undefined;
  const commun = { id, required, 'aria-describedby': decrit, 'aria-invalid': erreur ? true : undefined, ...props };

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
      <label htmlFor={id}>
        {libelle}
        {required && <span className={styles.obligatoire} aria-hidden="true"> *</span>}
      </label>
      {saisie}
      {aide && <span id={`${id}-aide`} className={styles.aide}>{aide}</span>}
      {erreur && <span id={`${id}-erreur`} className={styles.erreurChamp}>{erreur}</span>}
    </div>
  );
}
