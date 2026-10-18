// Coordonnées d'une personne avec liens cliquables : téléphone (tel:) et e-mail (mailto:).
import styles from './Pilotage.module.css';

const numero = (telephone) => String(telephone).replace(/[^\d+]/g, '');

export default function LiensContact({ email, telephone }) {
  if (!email && !telephone) return <span>—</span>;
  return (
    <span className={styles.liensContact}>
      {telephone && <a href={`tel:${numero(telephone)}`}>{telephone}</a>}
      {email && <a href={`mailto:${email}`}>{email}</a>}
    </span>
  );
}
