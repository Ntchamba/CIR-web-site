// Sphère de photos de sols de l'accueil (maquettes) : trois anneaux de photos qui tournent ensemble ; la rotation
// s'arrête au survol et au focus, la photo survolée grandit, un clic ouvre le produit lié (sinon le catalogue).
// Géométrie des maquettes : ordinateur 6 + 8 + 6 photos (rayons 235 / 315 / 235, anneaux à -215 / 0 / +215 px),
// téléphone 6 + 12 + 6 photos (rayons 206 / 320 / 206, anneaux à ±245 px, réduite à 44 %). Les photos de la base sont
// réparties sur les emplacements en boucle : la sphère est toujours pleine. Faces arrière visibles comme dans les
// maquettes. Accessibilité : bouton Pause / Lecture (WCAG 2.2.2), mouvement réduit = sphère immobile.
import { useState } from 'react';
import { Link } from 'react-router';

import { useEcranTelephone, useMouvementReduit } from '@/app/preferences.js';
import { useTraduction } from '@/i18n/index.js';

import styles from '../Accueil.module.css';

export const ANNEAUX_ORDINATEUR = [
  { y: -215, rayon: 235, l: 190, h: 160, nombre: 6 },
  { y: 0, rayon: 315, l: 210, h: 178, nombre: 8 },
  { y: 215, rayon: 235, l: 190, h: 160, nombre: 6 },
];
export const ANNEAUX_TELEPHONE = [
  { y: -245, rayon: 206, l: 200, h: 170, nombre: 6 },
  { y: 0, rayon: 320, l: 200, h: 170, nombre: 12 },
  { y: 245, rayon: 206, l: 200, h: 170, nombre: 6 },
];

/** Répartit les photos (en boucle) sur les emplacements des anneaux ; chaque tuile garde son angle. */
export function repartir(photos, anneaux) {
  let n = 0;
  return anneaux.map((a) => ({
    ...a,
    tuiles: Array.from({ length: a.nombre }, (_, i) => {
      const rang = n++;
      return { photo: photos[rang % photos.length], angle: (360 / a.nombre) * i, doublon: rang >= photos.length };
    }),
  }));
}

export default function Sphere({ photos = [] }) {
  const { t } = useTraduction();
  const reduit = useMouvementReduit();
  const telephone = useEcranTelephone();
  const [enPause, setEnPause] = useState(false);
  const liste = photos.filter((p) => p?.image?.url);
  if (!liste.length) return null;

  const lien = (p) => (p.produit?.slug ? `/catalogue/${p.produit.slug}` : '/catalogue');
  const libelle = (p) => (p.produit?.nom
    ? t('accueil.sphere.voirProduit', { nom: p.produit.nom })
    : t('accueil.sphere.voirCatalogue', { alt: p.image.alt || t('accueil.sphere.photo') }));

  if (liste.length < 4) {
    return (
      <ul className={styles.grilleSphere} aria-label={t('accueil.sphere.titre')}>
        {liste.map((p) => (
          <li key={p.id}>
            <Link to={lien(p)} aria-label={libelle(p)}>
              <img src={p.image.url} alt="" width="240" height="200" loading="lazy" decoding="async" />
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  const anneaux = repartir(liste, telephone ? ANNEAUX_TELEPHONE : ANNEAUX_ORDINATEUR);
  return (
    <div className={styles.cadreSphere}>
      <div className={styles.sphere}>
        <div className={styles.centre}>
          <div className={`${styles.globe} ${enPause ? styles.globeArrete : ''}`} role="group" aria-label={t('accueil.sphere.titre')}
            style={reduit ? { animation: 'none' } : undefined}>
            {anneaux.map((a, k) => (
              <div key={k} className={styles.anneau} style={{ transform: `translateY(${a.y}px)` }}>
                {a.tuiles.map(({ photo, angle, doublon }, i) => (
                  // Une photo répétée pour remplir la sphère n'est ni un deuxième arrêt de tabulation ni une deuxième annonce.
                  <Link key={`${k}-${i}`} to={lien(photo)} className={styles.tuile} aria-label={libelle(photo)}
                    tabIndex={doublon ? -1 : undefined} aria-hidden={doublon || undefined}>
                    <img src={photo.image.url} alt="" decoding="async" loading="lazy"
                      style={{
                        left: -a.l / 2, top: -a.h / 2, width: a.l, height: a.h,
                        transform: `rotateY(${angle}deg) translateZ(${a.rayon}px)`,
                      }} />
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <button type="button" className={styles.pauseSphere} aria-pressed={enPause} onClick={() => setEnPause((v) => !v)}>
        {enPause ? t('accueil.sphere.lecture') : t('accueil.sphere.pause')}
      </button>
    </div>
  );
}
