// Création ou modification d'une actualité : titre, résumé (280 caractères) et texte traduits, image
// facultative, produit lié, publication et date de publication (une date future la programme).
import { useId, useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { dateHeure } from '@partage/utils/format.js';

import { t as traduire, useTraduction } from '@/i18n/index.js';
import BoutonSupprimer from '@/composants/BoutonSupprimer.jsx';
import ChampImage from '@/composants/ChampImage.jsx';
import { depuisDateHeureLocale, repartirErreur, versDateHeureLocale } from '@/composants/envoi.js';
import OngletsLangues from '@/composants/OngletsLangues.jsx';
import Tiroir from '@/composants/Tiroir.jsx';
import gestion from '@/composants/Gestion.module.css';
import { useProduitsChoix } from '@/modules/catalogue/useCatalogue.js';

import { creerActualite, modifierActualite, supprimerActualite } from '../api.js';

const CHAMPS = ['titre', 'resume', 'texte', 'image', 'produit', 'publie', 'publie_le', 'traductions'];
const idProduit = (p) => (p && typeof p === 'object' ? p.id : p);

export function validerActualite(form) {
  const erreurs = {};
  if (!form.titre.trim()) erreurs.titre = traduire('actualites.titreManquant');
  if (form.resume.length > 280) erreurs.resume = traduire('actualites.resumeLong');
  return erreurs;
}

export default function TiroirActualite({ actualite, surFermeture, surEnregistrement, surSuppression }) {
  const { t } = useTraduction();
  const idForm = useId();
  const { produits } = useProduitsChoix();
  const [form, setForm] = useState({
    titre: actualite?.titre || '', resume: actualite?.resume || '', texte: actualite?.texte || '',
    traductions: actualite?.traductions || {},
    produit: idProduit(actualite?.produit) != null ? String(idProduit(actualite.produit)) : '',
    publie: actualite ? Boolean(actualite.publie) : true, publie_le: versDateHeureLocale(actualite?.publie_le),
  });
  const [fichiers, setFichiers] = useState({});
  const [erreurs, setErreurs] = useState({});
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const changer = (champ, valeur) => setForm((f) => ({ ...f, [champ]: valeur }));
  const image = fichiers.image === null ? null : actualite?.image;
  const datePublication = depuisDateHeureLocale(form.publie_le);
  const programmee = form.publie && datePublication && new Date(datePublication).getTime() > Date.now();

  async function envoyer(e) {
    e.preventDefault();
    const locales = validerActualite(form);
    setErreurs(locales);
    setErreur(null);
    if (Object.keys(locales).length) return;
    setEnvoi(true);
    const donnees = {
      titre: form.titre.trim(), resume: form.resume.trim(), texte: form.texte.trim(), traductions: form.traductions,
      produit: form.produit ? Number(form.produit) : null, publie: form.publie,
      // Sans date : le serveur publie maintenant (création) ou garde la date actuelle (modification).
      ...(datePublication ? { publie_le: datePublication } : {}),
    };
    try {
      const resultat = actualite
        ? await modifierActualite(actualite.id, donnees, fichiers)
        : await creerActualite(donnees, fichiers);
      surEnregistrement(resultat);
    } catch (err) {
      const { champs, generale } = repartirErreur(err, CHAMPS);
      setErreurs(champs);
      setErreur(generale);
      setEnvoi(false);
    }
  }

  const titre = actualite ? t('actualites.titreModifier') : t('actualites.titreNouvelle');
  return (
    <Tiroir ouvert large titre={titre} sousTitre={actualite?.titre} surFermeture={surFermeture}
      pied={(
        <>
          <Bouton type="submit" form={idForm} chargement={envoi}>
            {programmee ? t('actualites.programmer') : t('actions.enregistrer')}
          </Bouton>
          <Bouton variante="texte" onClick={surFermeture}>{t('actions.annuler')}</Bouton>
          {actualite && (
            <span style={{ marginLeft: 'auto' }}>
              <BoutonSupprimer nom={actualite.titre} surConfirmation={async () => {
                await supprimerActualite(actualite.id);
                surSuppression(actualite);
              }} />
            </span>
          )}
        </>
      )}>
      <form id={idForm} className={gestion.formulaire} onSubmit={envoyer} noValidate aria-label={titre}>
        <OngletsLangues contexteIA="actualite" valeurs={form} traductions={form.traductions} erreurs={erreurs} surChangement={changer}
          surTraductions={(traductions) => changer('traductions', traductions)}
          champs={[
            { nom: 'titre', libelle: t('actualites.titreChamp'), required: true },
            { nom: 'resume', libelle: t('actualites.resume'), multiligne: true, maxLength: 280, aide: t('actualites.aideResume') },
            { nom: 'texte', libelle: t('actualites.texte'), multiligne: true },
          ]} />
        <ChampImage libelle={t('actualites.image')} image={image} fichier={fichiers.image || null} erreur={erreurs.image}
          surChoix={(f) => setFichiers({ image: f ?? undefined })} surRetrait={() => setFichiers({ image: null })} />
        <Champ libelle={t('actualites.produit')} name="produit" value={form.produit} erreur={erreurs.produit}
          onChange={(e) => changer('produit', e.target.value)}
          options={[['', t('actualites.aucunProduit')], ...produits.map((p) => [String(p.id), p.nom])]} />
        <fieldset className={gestion.bloc}>
          <legend>{t('actualites.publication')}</legend>
          <label className={gestion.case}>
            <input type="checkbox" name="publie" checked={form.publie} onChange={(e) => changer('publie', e.target.checked)} />
            {t('actualites.publie')}
          </label>
          <Champ libelle={t('actualites.publieLe')} name="publie_le" type="datetime-local" value={form.publie_le}
            aide={t('actualites.aidePublieLe')} erreur={erreurs.publie_le} onChange={(e) => changer('publie_le', e.target.value)} />
          {programmee && (
            <p className={`${gestion.pastille} ${gestion.info}`} style={{ justifySelf: 'start' }}>
              {t('actualites.seraPubliee', { date: dateHeure(datePublication) })}
            </p>
          )}
        </fieldset>
        <MessageErreur erreur={erreur} />
      </form>
    </Tiroir>
  );
}
