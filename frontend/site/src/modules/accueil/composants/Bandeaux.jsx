// Bandeaux d'annonce de l'équipe (actifs et dans leurs dates, filtrés par le serveur).
// Un lien n'est suivi que s'il reste sur le site (chemin interne commençant par « / »).
import { Link } from 'react-router';

import { useTraduction } from '@/i18n/index.js';

import styles from '../Accueil.module.css';

const estInterne = (lien) => typeof lien === 'string' && lien.startsWith('/') && !lien.startsWith('//') && !lien.includes('\\');

export default function Bandeaux({ bandeaux = [] }) {
  const { t } = useTraduction();
  const liste = bandeaux.filter((b) => b?.texte);
  if (!liste.length) return null;
  return (
    <aside className={styles.bandeaux} aria-label={t('accueil.bandeaux')}>
      <ul className="conteneur">
        {liste.map((b) => (
          <li key={b.id}>
            {estInterne(b.lien) ? <Link to={b.lien}>{b.texte}</Link> : <span>{b.texte}</span>}
          </li>
        ))}
      </ul>
    </aside>
  );
}
