// Indique si l'adresse du client est complète (condition pour commander).
import styles from '../Clients.module.css';

export default function PastilleAdresse({ complete }) {
  return (
    <span className={`${styles.pastille} ${complete ? styles.ok : styles.attention}`}>
      {complete ? 'Adresse complète' : 'Adresse incomplète'}
    </span>
  );
}
