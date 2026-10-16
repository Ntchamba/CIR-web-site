// O2 : photos de la sphère de l'accueil (clic → produit). Ajout, modification, ordre, suppression.
import { useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';

import { useTraduction } from '@/i18n/index.js';
import BoutonSupprimer from '@/composants/BoutonSupprimer.jsx';
import { PastilleTraductions } from '@/composants/OngletsLangues.jsx';
import gestion from '@/composants/Gestion.module.css';
import { useProduitsChoix } from '@/modules/catalogue/useCatalogue.js';

import { ordonnerSphere, supprimerPhotoSphere } from './api.js';
import TiroirPhotoSphere from './composants/TiroirPhotoSphere.jsx';
import { useSphere } from './useContenus.js';

const adresse = (image) => (typeof image === 'string' ? image : image?.url) || '';
const idProduit = (p) => (p && typeof p === 'object' ? p.id : p);

export default function SectionSphere() {
  const { t } = useTraduction();
  const { elements, setDonnees, chargement, erreur, recharger, remplacer, retirer } = useSphere();
  const { produits } = useProduitsChoix();
  const [ouverte, setOuverte] = useState(null);
  const [annonce, setAnnonce] = useState('');
  const [erreurOrdre, setErreurOrdre] = useState(null);

  const nomProduit = (p) => (p && typeof p === 'object' && p.nom) || produits.find((x) => x.id === idProduit(p))?.nom || '';

  async function deplacer(index, sens) {
    const copie = [...elements];
    const [photo] = copie.splice(index, 1);
    copie.splice(index + sens, 0, photo);
    setErreurOrdre(null);
    try {
      const reponse = await ordonnerSphere(copie.map((p) => p.id));
      setDonnees(Array.isArray(reponse) ? reponse : copie.map((p, i) => ({ ...p, ordre: i })));
      setAnnonce(t('contenus.sphere.ordreEnregistre'));
    } catch (e) {
      setErreurOrdre(e);
    }
  }

  return (
    <section className={gestion.page} aria-labelledby="titre-sphere">
      <div className={gestion.entete}>
        <div>
          <h2 id="titre-sphere" className={gestion.titreCarte}>{t('contenus.sphere.titre')}</h2>
          <p className={gestion.aide}>{t('contenus.sphere.aide')}</p>
        </div>
        <Bouton onClick={() => { setOuverte('nouvelle'); setAnnonce(''); }}>{t('contenus.sphere.ajouter')}</Bouton>
      </div>
      <p className="visuellement-cache" role="status" aria-live="polite">{annonce}</p>
      {annonce && <p className={gestion.succes}>{annonce}</p>}
      <MessageErreur erreur={erreurOrdre} />

      {chargement ? (
        <Chargement texte={t('contenus.sphere.chargement')} />
      ) : erreur ? (
        <MessageErreur erreur={erreur} reessayer={recharger} />
      ) : elements.length === 0 ? (
        <EtatVide titre={t('contenus.sphere.vide')}>{t('contenus.sphere.videTexte')}</EtatVide>
      ) : (
        <>
          <p className={gestion.compte}>{t('contenus.sphere.nombre', { n: elements.length })}</p>
          <ol className={gestion.cartes}>
            {elements.map((photo, i) => {
              const nom = photo.alt || t('contenus.sphere.photoN', { n: i + 1 });
              return (
                <li key={photo.id} className={`carte ${gestion.carteElement}`}>
                  <img src={adresse(photo.image)} alt="" className={gestion.imageCarte} loading="lazy" />
                  <strong>{photo.alt || t('contenus.sphere.sansAlt')}</strong>
                  <span className={gestion.secondaire}>
                    {nomProduit(photo.produit) ? t('contenus.sphere.ouvre', { produit: nomProduit(photo.produit) })
                      : t('contenus.sphere.sansProduit')}
                  </span>
                  <PastilleTraductions langues={photo.langues_incompletes} />
                  <div className={gestion.boutonsLigne}>
                    <button type="button" className={gestion.icone} disabled={i === 0} onClick={() => deplacer(i, -1)}
                      aria-label={t('actions.monterNom', { nom })}>↑</button>
                    <button type="button" className={gestion.icone} disabled={i === elements.length - 1}
                      onClick={() => deplacer(i, 1)} aria-label={t('actions.descendreNom', { nom })}>↓</button>
                    <Bouton taille="petit" variante="contour" onClick={() => { setOuverte(photo); setAnnonce(''); }}
                      aria-label={t('actions.modifierNom', { nom })}>{t('actions.modifier')}</Bouton>
                    <BoutonSupprimer nom={nom} surConfirmation={async () => {
                      await supprimerPhotoSphere(photo.id);
                      retirer(photo.id);
                      setAnnonce(t('contenus.sphere.supprimee'));
                    }} />
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}

      {ouverte && (
        <TiroirPhotoSphere key={ouverte === 'nouvelle' ? 'nouvelle' : ouverte.id} photo={ouverte === 'nouvelle' ? null : ouverte}
          produits={produits} ordre={elements.length} surFermeture={() => setOuverte(null)}
          surEnregistrement={(p) => { remplacer(p); setOuverte(null); setAnnonce(t('contenus.sphere.enregistree')); }} />
      )}
    </section>
  );
}
