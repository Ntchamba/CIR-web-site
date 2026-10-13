// BF-04 : témoignages des clients (accueil et page Réalisations).
import useApi from '@/hooks/useApi.js';
import { TYPES_BATIMENT } from '@shared/format.js';

import { temoignages } from './api.js';
import styles from './Accueil.module.css';

export default function Temoignages() {
  const { donnees } = useApi((s) => temoignages(s), []);
  if (!donnees?.length) return null;
  return (
    <section className="section" aria-labelledby="titre-temoignages">
      <div className="conteneur">
        <div className="entete-section">
          <span className="surtitre">Ils nous ont fait confiance</span>
          <h2 id="titre-temoignages">Témoignages</h2>
        </div>
        <div className={styles.temoignages}>
          {donnees.slice(0, 3).map((t) => (
            <blockquote key={t.id}>
              <p>« {t.texte} »</p>
              <footer>{t.nom_client} · {TYPES_BATIMENT[t.type_batiment]}{t.ville ? ` · ${t.ville}` : ''}</footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
