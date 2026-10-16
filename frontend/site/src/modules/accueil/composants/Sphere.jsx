// Sphère de photos de sols (contenus de l'accueil) : elle tourne lentement et s'arrête au survol ou au
// focus ; un clic ouvre le produit lié (sinon le catalogue). Mouvement réduit : grille simple.
// Accessibilité : bouton Pause / Lecture (WCAG 2.2.2) ; la photo qui reçoit le focus clavier est tournée face
// au visiteur ; les faces arrière sont masquées (jamais de photo inversée ou cachée sous le focus).
import { useState } from 'react';
import { Link } from 'react-router';

import { useMouvementReduit } from '@/app/preferences.js';
import { useTraduction } from '@/i18n/index.js';

import styles from '../Accueil.module.css';

const LARGEUR_TUILE = 180;

/** Place les photos sur un anneau (8 au plus) ou trois anneaux (haut, milieu, bas). */
export function positions(nombre) {
  const anneau = (n, y, rayon) => Array.from({ length: n }, (_, i) => ({ y, rayon, angle: (360 / n) * i }));
  const rayonPour = (n) => Math.max(200, Math.round((n * (LARGEUR_TUILE + 24)) / (2 * Math.PI)));
  if (nombre <= 8) return anneau(nombre, 0, rayonPour(nombre));
  const milieu = Math.ceil(nombre * 0.44);
  const haut = Math.ceil((nombre - milieu) / 2);
  const bas = nombre - milieu - haut;
  const rayon = rayonPour(milieu);
  return [
    ...anneau(haut, -Math.round(rayon * 0.72), Math.round(rayon * 0.68)),
    ...anneau(milieu, 0, rayon),
    ...anneau(bas, Math.round(rayon * 0.72), Math.round(rayon * 0.68)),
  ];
}

export default function Sphere({ photos = [] }) {
  const { t } = useTraduction();
  const reduit = useMouvementReduit();
  const [enPause, setEnPause] = useState(false);
  const [cible, setCible] = useState(null); // angle de la photo focalisée au clavier
  const liste = photos.filter((p) => p?.image?.url);
  if (!liste.length) return null;

  const lien = (p) => (p.produit?.slug ? `/catalogue/${p.produit.slug}` : '/catalogue');
  const libelle = (p) => (p.produit?.nom
    ? t('accueil.sphere.voirProduit', { nom: p.produit.nom })
    : t('accueil.sphere.voirCatalogue', { alt: p.image.alt || t('accueil.sphere.photo') }));

  if (reduit || liste.length < 4) {
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

  const places = positions(liste.length);
  return (
    <div className={styles.cadreSphere}>
      <div className={styles.sphere}>
        <ul className={[styles.globe, enPause && styles.globeArrete, cible !== null && styles.globeCible].filter(Boolean).join(' ')}
          style={cible !== null ? { '--cible': `${-cible}deg` } : undefined} aria-label={t('accueil.sphere.titre')}
          onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setCible(null); }}>
          {liste.map((p, i) => {
            const { y, rayon, angle } = places[i];
            return (
              <li key={p.id} className={styles.tuile}
                style={{ transform: `translateY(${y}px) rotateY(${angle}deg) translateZ(${rayon}px)` }}>
                <Link to={lien(p)} aria-label={libelle(p)} onFocus={() => setCible(angle)}>
                  <img src={p.image.url} alt="" width={LARGEUR_TUILE} height="150" decoding="async" />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      <button type="button" className={styles.pauseSphere} aria-pressed={enPause} onClick={() => setEnPause((v) => !v)}>
        {enPause ? t('accueil.sphere.lecture') : t('accueil.sphere.pause')}
      </button>
    </div>
  );
}
