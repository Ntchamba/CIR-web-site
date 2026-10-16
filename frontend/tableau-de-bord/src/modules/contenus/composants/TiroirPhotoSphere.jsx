// Ajout ou modification d'une photo de la sphère de l'accueil : image (obligatoire à l'ajout), texte
// alternatif traduit, produit ouvert au clic.
import { useId, useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';

import { t as traduire, useTraduction } from '@/i18n/index.js';
import ChampImage from '@/composants/ChampImage.jsx';
import { repartirErreur } from '@/composants/envoi.js';
import OngletsLangues from '@/composants/OngletsLangues.jsx';
import Tiroir from '@/composants/Tiroir.jsx';
import gestion from '@/composants/Gestion.module.css';

import { ajouterPhotoSphere, modifierPhotoSphere } from '../api.js';

const CHAMPS = ['image', 'alt', 'produit', 'traductions'];
const idProduit = (p) => (p && typeof p === 'object' ? p.id : p);

export function validerPhoto({ image, fichier }) {
  return image || fichier ? {} : { image: traduire('contenus.sphere.imageManquante') };
}

export default function TiroirPhotoSphere({ photo, produits, ordre, surFermeture, surEnregistrement }) {
  const { t } = useTraduction();
  const idForm = useId();
  const [form, setForm] = useState({
    alt: photo?.alt || '', traductions: photo?.traductions || {},
    produit: idProduit(photo?.produit) != null ? String(idProduit(photo.produit)) : '',
  });
  const [fichier, setFichier] = useState(null);
  const [erreurs, setErreurs] = useState({});
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const changer = (champ, valeur) => setForm((f) => ({ ...f, [champ]: valeur }));

  async function envoyer(e) {
    e.preventDefault();
    const locales = validerPhoto({ image: photo?.image, fichier });
    setErreurs(locales);
    setErreur(null);
    if (Object.keys(locales).length) return;
    setEnvoi(true);
    const donnees = {
      alt: form.alt.trim(), traductions: form.traductions, produit: form.produit ? Number(form.produit) : null,
      ...(photo ? {} : { ordre }),
    };
    const fichiers = fichier ? { image: fichier } : {};
    try {
      surEnregistrement(photo ? await modifierPhotoSphere(photo.id, donnees, fichiers) : await ajouterPhotoSphere(donnees, fichiers));
    } catch (err) {
      const { champs, generale } = repartirErreur(err, CHAMPS);
      setErreurs(champs);
      setErreur(generale);
      setEnvoi(false);
    }
  }

  const titre = photo ? t('contenus.sphere.titreModifier') : t('contenus.sphere.titreNouvelle');
  return (
    <Tiroir ouvert titre={titre} surFermeture={surFermeture}
      pied={(
        <>
          <Bouton type="submit" form={idForm} chargement={envoi}>{t('actions.enregistrer')}</Bouton>
          <Bouton variante="texte" onClick={surFermeture}>{t('actions.annuler')}</Bouton>
        </>
      )}>
      <form id={idForm} className={gestion.formulaire} onSubmit={envoyer} noValidate aria-label={titre}>
        <ChampImage libelle={t('contenus.sphere.image')} image={photo?.image} fichier={fichier} required
          erreur={erreurs.image} surChoix={setFichier} aide={t('contenus.sphere.aideImage')} />
        <OngletsLangues valeurs={form} traductions={form.traductions} erreurs={erreurs} surChangement={changer}
          surTraductions={(traductions) => changer('traductions', traductions)}
          champs={[{ nom: 'alt', libelle: t('contenus.sphere.alt'), aide: t('contenus.sphere.aideAlt') }]} />
        <Champ libelle={t('contenus.sphere.produit')} name="produit" value={form.produit} erreur={erreurs.produit}
          aide={t('contenus.sphere.aideProduit')} onChange={(e) => changer('produit', e.target.value)}
          options={[['', t('contenus.sphere.aucunProduit')], ...produits.map((p) => [String(p.id), p.nom])]} />
        <MessageErreur erreur={erreur} />
      </form>
    </Tiroir>
  );
}
