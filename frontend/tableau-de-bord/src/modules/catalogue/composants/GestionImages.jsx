// Photos d'un produit : ajout (fichier + texte alternatif traduit), texte modifiable, ordre (la première
// photo sert de vignette), suppression avec confirmation. Chaque action part tout de suite au serveur.
import { useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';

import { useTraduction } from '@/i18n/index.js';
import BoutonSupprimer from '@/composants/BoutonSupprimer.jsx';
import ChampImage from '@/composants/ChampImage.jsx';
import { repartirErreur } from '@/composants/envoi.js';
import OngletsLangues, { PastilleTraductions } from '@/composants/OngletsLangues.jsx';
import gestion from '@/composants/Gestion.module.css';

import { ajouterImage, modifierImage, supprimerImage } from '../api.js';
import styles from '../Catalogue.module.css';

const VIDE = { fichier: null, alt: '', traductions: {} };
const trier = (images) => [...(images || [])].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));

function TexteImage({ image, surEnregistre, surAnnuler }) {
  const { t } = useTraduction();
  const [form, setForm] = useState({ alt: image.alt || '', traductions: image.traductions || {} });
  const [erreurs, setErreurs] = useState({});
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  async function enregistrer() {
    setEnvoi(true);
    setErreur(null);
    try {
      surEnregistre(await modifierImage(image.id, { alt: form.alt.trim(), traductions: form.traductions }));
    } catch (e) {
      const { champs, generale } = repartirErreur(e, ['alt', 'traductions']);
      setErreurs(champs);
      setErreur(generale);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className={styles.editionMedia}>
      <OngletsLangues champs={[{ nom: 'alt', libelle: t('catalogue.images.alt'), aide: t('catalogue.images.aideAlt') }]}
        valeurs={form} traductions={form.traductions} erreurs={erreurs}
        surChangement={(champ, valeur) => setForm((f) => ({ ...f, [champ]: valeur }))}
        surTraductions={(traductions) => setForm((f) => ({ ...f, traductions }))} />
      <MessageErreur erreur={erreur} />
      <div className={gestion.actionsFormulaire}>
        <Bouton taille="petit" chargement={envoi} onClick={enregistrer}>{t('actions.enregistrer')}</Bouton>
        <Bouton taille="petit" variante="texte" onClick={surAnnuler}>{t('actions.annuler')}</Bouton>
      </div>
    </div>
  );
}

export default function GestionImages({ produitId, images, surChangement }) {
  const { t } = useTraduction();
  const liste = trier(images);
  const [ajout, setAjout] = useState(VIDE);
  const [erreurs, setErreurs] = useState({});
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [edition, setEdition] = useState(null);

  async function ajouter() {
    if (!ajout.fichier) {
      setErreurs({ image: t('catalogue.images.fichierManquant') });
      return;
    }
    setEnvoi(true);
    setErreur(null);
    setErreurs({});
    try {
      const image = await ajouterImage(produitId, { fichier: ajout.fichier, alt: ajout.alt.trim(), traductions: ajout.traductions });
      surChangement([...liste, image]);
      setAjout(VIDE);
    } catch (e) {
      const { champs, generale } = repartirErreur(e, ['image', 'alt', 'traductions']);
      setErreurs(champs);
      setErreur(generale);
    } finally {
      setEnvoi(false);
    }
  }

  async function deplacer(index, sens) {
    const copie = [...liste];
    const [image] = copie.splice(index, 1);
    copie.splice(index + sens, 0, image);
    setErreur(null);
    try {
      // Seules les deux photos échangées changent d'ordre.
      const a = copie[index];
      const b = copie[index + sens];
      const [majA, majB] = await Promise.all([modifierImage(a.id, { ordre: index }), modifierImage(b.id, { ordre: index + sens })]);
      surChangement(copie.map((img) => (img.id === majA.id ? { ...img, ...majA } : img.id === majB.id ? { ...img, ...majB } : img))
        .map((img, i) => ({ ...img, ordre: i })));
    } catch (e) {
      setErreur(e);
    }
  }

  async function supprimer(id) {
    await supprimerImage(id);
    surChangement(liste.filter((img) => img.id !== id));
  }

  return (
    <fieldset className={gestion.bloc}>
      <legend>{t('catalogue.images.titre')}</legend>
      <p className={gestion.aide}>{t('catalogue.images.aide')}</p>
      <MessageErreur erreur={erreur} />
      {liste.length === 0 ? (
        <p className={gestion.aide}>{t('catalogue.images.vide')}</p>
      ) : (
        <ol className={gestion.lignes}>
          {liste.map((image, i) => {
            const nom = image.alt || t('catalogue.images.numero', { n: i + 1 });
            return (
              <li key={image.id} className={styles.media}>
                <img src={image.url} alt="" className={styles.miniature} />
                <div className={styles.infosMedia}>
                  <strong>{image.alt || t('catalogue.images.sansAlt')}</strong>
                  {i === 0 && <span className={`${gestion.pastille} ${gestion.info}`}>{t('catalogue.images.vignette')}</span>}
                  <PastilleTraductions langues={image.langues_incompletes} />
                </div>
                <div className={gestion.boutonsLigne}>
                  <button type="button" className={gestion.icone} disabled={i === 0} onClick={() => deplacer(i, -1)}
                    aria-label={t('actions.monterNom', { nom })}>↑</button>
                  <button type="button" className={gestion.icone} disabled={i === liste.length - 1}
                    onClick={() => deplacer(i, 1)} aria-label={t('actions.descendreNom', { nom })}>↓</button>
                  <Bouton taille="petit" variante="contour" onClick={() => setEdition(image.id)}
                    aria-label={t('actions.modifierNom', { nom })}>{t('actions.modifier')}</Bouton>
                  <BoutonSupprimer nom={nom} surConfirmation={() => supprimer(image.id)} />
                </div>
                {edition === image.id && (
                  <TexteImage image={image} surAnnuler={() => setEdition(null)}
                    surEnregistre={(maj) => { surChangement(liste.map((img) => (img.id === maj.id ? { ...img, ...maj } : img))); setEdition(null); }} />
                )}
              </li>
            );
          })}
        </ol>
      )}

      <div className={styles.ajoutMedia}>
        <h3 className={styles.titreAjout}>{t('catalogue.images.ajouter')}</h3>
        <ChampImage libelle={t('catalogue.images.fichier')} fichier={ajout.fichier} erreur={erreurs.image} required
          surChoix={(fichier) => setAjout((a) => ({ ...a, fichier }))} />
        <OngletsLangues champs={[{ nom: 'alt', libelle: t('catalogue.images.alt'), aide: t('catalogue.images.aideAlt') }]}
          valeurs={ajout} traductions={ajout.traductions} erreurs={erreurs}
          surChangement={(champ, valeur) => setAjout((a) => ({ ...a, [champ]: valeur }))}
          surTraductions={(traductions) => setAjout((a) => ({ ...a, traductions }))} />
        <div><Bouton taille="petit" chargement={envoi} onClick={ajouter}>{t('catalogue.images.envoyer')}</Bouton></div>
      </div>
    </fieldset>
  );
}
