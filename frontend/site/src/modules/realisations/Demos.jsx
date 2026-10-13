// BF-03 : démonstrations vidéo. Sans démo publiée, la vidéo de l'accueil sert de démonstration.
import useApi from '@/hooks/useApi.js';

import * as vitrine from './api.js';
import styles from './Realisations.module.css';

export default function Demos() {
  const { donnees } = useApi((s) => vitrine.demos(s), []);
  const demos = donnees?.length ? donnees : null;

  return (
    <section id="demos" className={`section ${styles.demos}`} aria-labelledby="titre-demos">
      <div className="conteneur">
        <div className="entete-section">
          <span className="surtitre">Démonstration</span>
          <h2 id="titre-demos">La transformation en vidéo</h2>
        </div>
        <div className={styles.videos}>
          {demos ? demos.map((d) => (
            <figure key={d.id}>
              {d.video
                ? <video controls preload="none" poster={d.miniature || undefined} src={d.video} />
                : <a href={d.lien} target="_blank" rel="noopener noreferrer" className={styles.lienVideo}>
                    {d.miniature && <img src={d.miniature} alt="" loading="lazy" />}<span>Voir la vidéo</span></a>}
              <figcaption>{d.titre}{d.duree ? ` · ${d.duree}` : ''}</figcaption>
            </figure>
          )) : (
            <figure>
              <video controls preload="none" poster="/media/accueil/video-poster-768.webp" playsInline>
                <source src="/media/accueil/fond.webm" type="video/webm" />
                <source src="/media/accueil/fond.mp4" type="video/mp4" />
              </video>
              <figcaption>Pose d'un sol en résine époxy · 0:10</figcaption>
            </figure>
          )}
        </div>
      </div>
    </section>
  );
}
