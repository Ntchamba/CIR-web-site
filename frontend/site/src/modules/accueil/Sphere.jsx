// Sphère de photos en 3D (CSS) : elle tourne ; au survol d'une photo, elle s'arrête et la photo
// s'agrandit ; un clic ouvre le produit lié, comme depuis le catalogue.
import { Link } from 'react-router-dom';

import styles from './Sphere.module.css';

// Trois anneaux : 6 photos en haut, 10 au milieu, 6 en bas.
const ANNEAUX = [
  { y: -245, rayon: 206, nombre: 6 },
  { y: 0, rayon: 320, nombre: 10 },
  { y: 245, rayon: 206, nombre: 6 },
];
const PHOTOS_PAR_DEFAUT = Array.from({ length: 13 }, (_, i) => ({
  id: `p${i + 1}`, image: `/media/sphere/photo${i + 1}.webp`, produit_slug: null, alt: 'Sol en résine époxy',
}));

export default function Sphere({ photos }) {
  const source = photos?.length ? photos : PHOTOS_PAR_DEFAUT;
  let n = 0;
  return (
    <div className={styles.cadre}>
      <div className={styles.centre}>
        <div className={styles.perspective}>
          <div className={styles.globe}>
            {ANNEAUX.map((anneau) => (
              <div key={anneau.y} className={styles.anneau} style={{ transform: `translateY(${anneau.y}px)` }}>
                {Array.from({ length: anneau.nombre }, (_, i) => {
                  const photo = source[n++ % source.length];
                  const angle = (360 / anneau.nombre) * i;
                  return (
                    <Link key={i} to={photo.produit_slug ? `/catalogue/${photo.produit_slug}` : '/catalogue'}
                      className={styles.tuile} aria-label="Voir ce sol" tabIndex={anneau.y === 0 && i < 4 ? 0 : -1}>
                      <img src={photo.image} alt="" width="200" height="170" decoding="async"
                        style={{ transform: `rotateY(${angle}deg) translateZ(${anneau.rayon}px)` }} />
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
