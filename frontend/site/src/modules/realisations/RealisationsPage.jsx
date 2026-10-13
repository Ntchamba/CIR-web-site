// BF-02, BF-03, BF-04 : chantiers réalisés (avant / après), démonstrations vidéo, témoignages.
import { useState } from 'react';

import Bandeau from '@/components/layout/Bandeau.jsx';
import Chargement from '@/components/ui/Chargement.jsx';
import MessageErreur from '@/components/ui/MessageErreur.jsx';
import useApi from '@/hooks/useApi.js';
import usePageMeta from '@/hooks/usePageMeta.js';

import Temoignages from '../accueil/Temoignages.jsx';
import AvantApres from './AvantApres.jsx';
import Demos from './Demos.jsx';
import FormulaireTemoignage from './FormulaireTemoignage.jsx';
import * as vitrine from './api.js';
import styles from './Realisations.module.css';

const TYPES = [['', 'Toutes'], ['maison', 'Maisons'], ['industrie', 'Industries'], ['entreprise', 'Entreprises'],
  ['exterieur', 'Extérieur']];

export default function RealisationsPage() {
  usePageMeta('Réalisations', 'Avant, après : les chantiers en résine époxy réalisés par le CIR.');
  const [type, setType] = useState('');
  const liste = useApi((s) => vitrine.realisations(type, s), [type]);
  const toutes = liste.donnees || [];
  const avecAvant = toutes.find((r) => r.image_avant);

  return (
    <>
      <Bandeau titre="Réalisations" sousTitre="La résine époxy en action, sur les chantiers déjà réalisés." />

      {avecAvant && <AvantApres realisation={avecAvant} />}

      <Demos />

      <section className="section" aria-labelledby="titre-chantiers">
        <div className="conteneur">
          <div className="entete-section">
            <span className="surtitre">Nos chantiers</span>
            <h2 id="titre-chantiers">Ils ont choisi la résine époxy</h2>
          </div>
          <div className={styles.filtres} role="group" aria-label="Type de chantier">
            {TYPES.map(([valeur, libelle]) => (
              <button key={valeur || 'toutes'} type="button" aria-pressed={type === valeur}
                className={type === valeur ? styles.filtreActif : ''} onClick={() => setType(valeur)}>
                {libelle}
              </button>
            ))}
          </div>
          <MessageErreur erreur={liste.erreur} reessayer={liste.recharger} />
          {liste.chargement && !liste.donnees ? <Chargement /> : (
            <div className={styles.grille}>
              {toutes.map((r) => (
                <figure key={r.id} className={styles.chantier}>
                  <img src={r.image} alt={r.titre} width="560" height="560" loading="lazy" decoding="async" />
                  <figcaption>
                    <strong>{r.titre}</strong>
                    <span>{r.type_chantier_libelle}{r.ville ? ` · ${r.ville}` : ''}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      </section>

      <Temoignages />
      <FormulaireTemoignage />
    </>
  );
}
