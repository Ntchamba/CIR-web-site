// Bandeaux d'annonce de l'équipe (actifs et dans leurs dates, filtrés par le serveur).
// Un lien n'est suivi que s'il reste sur le site (chemin interne commençant par « / »).
import { Link } from 'react-router';

import { useTraduction } from '@/i18n/index.js';

import styles from '../Accueil.module.css';

// Espaces, tabulations, retours à la ligne et barres obliques inversées refusés (« /\t/site.com » deviendrait « //site.com »).
const estInterne = (lien) => typeof lien === 'string' && lien.startsWith('/') && !lien.startsWith('//') && !/[\s\\]/.test(lien);

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
