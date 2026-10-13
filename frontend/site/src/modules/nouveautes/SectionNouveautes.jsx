// BF-07 : dernières nouveautés, sur l'accueil. La section se masque s'il n'y en a pas.
import { Link } from 'react-router-dom';

import useApi from '@/hooks/useApi.js';
import { api, resultats } from '@/lib/api.js';
import { date } from '@shared/format.js';

import styles from './Nouveautes.module.css';

export default function SectionNouveautes() {
  const { donnees } = useApi((signal) => api.get('/nouveautes/?taille=3', { auth: false, signal }).then(resultats), []);
  if (!donnees?.length) return null;
  return (
    <section className="section" aria-labelledby="titre-nouveautes">
      <div className="conteneur">
        <div className="entete-section">
          <span className="surtitre">À ne pas manquer</span>
          <h2 id="titre-nouveautes">Nouveautés</h2>
        </div>
        <div className={styles.liste}>
          {donnees.map((n) => {
            const contenu = (
              <>
                {n.image && <img src={n.image} alt="" width="640" height="360" loading="lazy" />}
                <span className="etiquette">{date(n.publie_le)}</span>
                <strong>{n.titre}</strong>
                {n.texte && <span className={styles.texte}>{n.texte}</span>}
              </>
            );
            return n.produit_slug
              ? <Link key={n.id} to={`/catalogue/${n.produit_slug}`} className={styles.carte}>{contenu}</Link>
              : <article key={n.id} className={styles.carte}>{contenu}</article>;
          })}
        </div>
      </div>
    </section>
  );
}
