// Accueil : vidéo et sphère, produits à la une, réalisations, témoignages, nouveautés, contact.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import Bouton from '@/components/ui/Bouton.jsx';
import useApi from '@/hooks/useApi.js';
import usePageMeta from '@/hooks/usePageMeta.js';

import CarteProduit from '../catalogue/CarteProduit.jsx';
import SectionContact from '../contact/SectionContact.jsx';
import SectionNouveautes from '../nouveautes/SectionNouveautes.jsx';
import { chargerContenuAccueil, produitsALaUne, realisationsRecentes } from './api.js';
import Hero from './Hero.jsx';
import Temoignages from './Temoignages.jsx';
import styles from './Accueil.module.css';

export default function AccueilPage() {
  usePageMeta(null, "Complexe Industriel Révélation (CIR) : revêtements de sol en résine époxy pour la maison, l'industrie et l'entreprise, à Douala.");
  const [contenu, setContenu] = useState(null);
  useEffect(() => { chargerContenuAccueil().then(setContenu).catch(() => {}); }, []);
  const produits = useApi((s) => produitsALaUne(s), []);
  const realisations = useApi((s) => realisationsRecentes(s), []);

  return (
    <>
      <Hero contenu={contenu} />

      <section className="section" aria-labelledby="titre-une">
        <div className="conteneur">
          <div className="entete-section">
            <span className="surtitre">Notre sélection</span>
            <h2 id="titre-une">Produits à la une</h2>
          </div>
          <div className="grille-vignettes">
            {(produits.donnees || []).slice(0, 4).map((p) => <CarteProduit key={p.id} produit={p} />)}
          </div>
          <div className={styles.suite}><Link to="/catalogue" className="lien-souligne">Voir tout le catalogue</Link></div>
        </div>
      </section>

      {realisations.donnees?.length > 0 && (
        <section className={`section ${styles.bandeClaire}`} aria-labelledby="titre-real">
          <div className="conteneur">
            <div className="entete-section">
              <span className="surtitre">Avant, après</span>
              <h2 id="titre-real">Nos réalisations</h2>
            </div>
            <div className={styles.realisations}>
              {realisations.donnees.slice(0, 4).map((r) => (
                <figure key={r.id}>
                  <img src={r.image} alt={r.titre} width="560" height="560" loading="lazy" decoding="async" />
                  <figcaption><strong>{r.titre}</strong><span>{r.type_chantier_libelle}{r.ville ? ` · ${r.ville}` : ''}</span></figcaption>
                </figure>
              ))}
            </div>
            <div className={styles.suite}><Bouton vers="/realisations" variante="contour">Toutes les réalisations</Bouton></div>
          </div>
        </section>
      )}

      <Temoignages />
      <SectionNouveautes />
      <SectionContact />
    </>
  );
}
