// Fiche produit (BF-05, BF-06) : grande image sur fond flouté, prix, puis panneau d'options
// (commander, sélectionner, message, contact…) qui s'ouvre sur la droite.
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import Bouton from '@/components/ui/Bouton.jsx';
import Chargement from '@/components/ui/Chargement.jsx';
import Icone from '@/components/ui/Icone.jsx';
import MessageErreur from '@/components/ui/MessageErreur.jsx';
import useApi from '@/hooks/useApi.js';
import usePageMeta from '@/hooks/usePageMeta.js';
import { prix } from '@shared/format.js';

import * as catalogue from '../catalogue/api.js';
import BoutonSelection from '../selection/BoutonSelection.jsx';
import FicheTechnique from './FicheTechnique.jsx';
import PanneauOptions from './PanneauOptions.jsx';
import styles from './Produit.module.css';

export default function ProduitPage() {
  const { slug } = useParams();
  const { donnees: produit, chargement, erreur, recharger } = useApi((s) => catalogue.produit(slug, s), [slug]);
  const [panneau, setPanneau] = useState(false);
  const [image, setImage] = useState(0);
  usePageMeta(produit?.nom, produit?.accroche);

  if (chargement) return <div className={styles.attente}><Chargement /></div>;
  if (erreur) {
    return <div className={`conteneur section ${styles.attenteErreur}`}><MessageErreur erreur={erreur} reessayer={recharger} /></div>;
  }

  const photos = produit.images.length ? produit.images : [{ id: 0, image: produit.vignette, alt: produit.nom }];
  const photo = photos[Math.min(image, photos.length - 1)];

  return (
    <>
      <section className={styles.scene}>
        {photo?.image && <img className={styles.flou} src={photo.image} alt="" aria-hidden="true" />}
        <div className={styles.voile} aria-hidden="true" />
        <div className={`conteneur ${styles.grille}`}>
          <div className={styles.infos}>
            <Link to="/catalogue" className={styles.retour}><Icone nom="retour" taille={18} />Catalogue</Link>
            <span className={styles.famille}>{produit.famille}</span>
            <h1>{produit.nom}</h1>
            {produit.reference && <span className={styles.ref}>Réf. {produit.reference}</span>}
            <p className={styles.prix}>{prix(produit.prix, produit.unite_prix)}</p>
            {produit.accroche && <p className={styles.accroche}>{produit.accroche}</p>}
            <div className={styles.actions}>
              <button type="button" className={styles.ouvrir} onClick={() => setPanneau(true)}
                aria-expanded={panneau} aria-controls="panneau-options">
                <span>Commander ou personnaliser</span><Icone nom="plus" />
              </button>
              <BoutonSelection slug={produit.slug} variante="clair" />
            </div>
          </div>

          <figure className={styles.visuel}>
            <button type="button" className={styles.grandeImage} onClick={() => setPanneau(true)}
              aria-label="Ouvrir les options de commande">
              {photo?.image && <img src={photo.image} alt={photo.alt || produit.nom} width="560" height="560"
                fetchPriority="high" />}
            </button>
            {photos.length > 1 && (
              <div className={styles.miniatures}>
                {photos.map((p, i) => (
                  <button key={p.id} type="button" aria-label={`Photo ${i + 1}`} aria-pressed={i === image}
                    onClick={() => setImage(i)}>
                    <img src={p.image} alt="" width="64" height="64" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </figure>
        </div>
      </section>

      <FicheTechnique produit={produit} />

      <section className={`conteneur ${styles.suite}`}>
        <Bouton onClick={() => setPanneau(true)}>Commander ou personnaliser</Bouton>
        <Bouton vers="/realisations" variante="contour">Voir les réalisations</Bouton>
      </section>

      {panneau && <PanneauOptions produit={produit} onFermer={() => setPanneau(false)} />}
    </>
  );
}
