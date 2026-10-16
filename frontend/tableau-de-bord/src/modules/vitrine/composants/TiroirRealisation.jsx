// Création ou modification d'une réalisation : titre et description traduits, type de chantier, ville, date,
// photos avant (facultative) et après (obligatoire), produits utilisés, publication.
import { useId, useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';

import { t as traduire, useTraduction } from '@/i18n/index.js';
import BoutonSupprimer from '@/composants/BoutonSupprimer.jsx';
import ChampImage from '@/composants/ChampImage.jsx';
import { identifiants, repartirErreur } from '@/composants/envoi.js';
import OngletsLangues from '@/composants/OngletsLangues.jsx';
import Tiroir from '@/composants/Tiroir.jsx';
import { optionsUsages } from '@/composants/usages.js';
import gestion from '@/composants/Gestion.module.css';
import { useProduitsChoix } from '@/modules/catalogue/useCatalogue.js';

import { creerRealisation, modifierRealisation, supprimerRealisation } from '../api.js';
import styles from '../Vitrine.module.css';

const CHAMPS = ['titre', 'description', 'type_chantier', 'ville', 'date', 'ordre', 'publie', 'produits', 'traductions',
  'image_apres', 'image_avant'];

export function versFormulaireRealisation(r) {
  return {
    titre: r?.titre || '', description: r?.description || '', traductions: r?.traductions || {},
    type_chantier: r?.type_chantier || 'maison', ville: r?.ville || '', date: String(r?.date || '').slice(0, 10),
    ordre: String(r?.ordre ?? 0), publie: r ? Boolean(r.publie) : true, produits: identifiants(r?.produits),
  };
}

export function validerRealisation(form, { imageApres, fichierApres }) {
  const erreurs = {};
  if (!form.titre.trim()) erreurs.titre = traduire('vitrine.realisations.titreManquant');
  if (!imageApres && !fichierApres) erreurs.image_apres = traduire('vitrine.realisations.imageApresManquante');
  return erreurs;
}

/** Cases à cocher des produits du catalogue utilisés sur le chantier. */
function ChoixProduits({ valeur, surChangement, erreur }) {
  const { t } = useTraduction();
  const { produits, chargement, erreur: erreurChargement } = useProduitsChoix();
  const basculer = (id) => surChangement(valeur.includes(id) ? valeur.filter((x) => x !== id) : [...valeur, id]);
  return (
    <fieldset className={gestion.bloc}>
      <legend>{t('vitrine.realisations.produits')}</legend>
      {chargement ? <p className={gestion.aide}>{t('vitrine.realisations.produitsChargement')}</p>
        : erreurChargement ? <MessageErreur erreur={erreurChargement} />
          : produits.length === 0 ? <p className={gestion.aide}>{t('vitrine.realisations.aucunProduit')}</p> : (
            <div className={styles.choixProduits}>
              {produits.map((p) => (
                <label key={p.id} className={gestion.case}>
                  <input type="checkbox" checked={valeur.includes(p.id)} onChange={() => basculer(p.id)} />
                  {p.reference ? `${p.nom} (${p.reference})` : p.nom}
                </label>
              ))}
            </div>
          )}
      {erreur && <p className={gestion.erreurChamp} role="alert">{erreur}</p>}
    </fieldset>
  );
}

export default function TiroirRealisation({ realisation, surFermeture, surEnregistrement, surSuppression }) {
  const { t } = useTraduction();
  const idForm = useId();
  const [form, setForm] = useState(() => versFormulaireRealisation(realisation));
  const [fichiers, setFichiers] = useState({});
  const [erreurs, setErreurs] = useState({});
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const changer = (champ, valeur) => setForm((f) => ({ ...f, [champ]: valeur }));
  const choisirFichier = (champ, fichier) => setFichiers((f) => ({ ...f, [champ]: fichier ?? undefined }));
  const imageAvant = fichiers.image_avant === null ? null : realisation?.image_avant;

  async function envoyer(e) {
    e.preventDefault();
    const locales = validerRealisation(form, { imageApres: realisation?.image_apres, fichierApres: fichiers.image_apres });
    setErreurs(locales);
    setErreur(null);
    if (Object.keys(locales).length) return;
    setEnvoi(true);
    const donnees = {
      titre: form.titre.trim(), description: form.description.trim(), traductions: form.traductions,
      type_chantier: form.type_chantier, ville: form.ville.trim(), date: form.date || null,
      ordre: Number.parseInt(form.ordre, 10) || 0, publie: form.publie, produits: form.produits,
    };
    try {
      const resultat = realisation
        ? await modifierRealisation(realisation.id, donnees, fichiers)
        : await creerRealisation(donnees, fichiers);
      surEnregistrement(resultat);
    } catch (err) {
      const { champs, generale } = repartirErreur(err, CHAMPS);
      setErreurs(champs);
      setErreur(generale);
      setEnvoi(false);
    }
  }

  const titre = realisation ? t('vitrine.realisations.titreModifier') : t('vitrine.realisations.titreNouvelle');
  return (
    <Tiroir ouvert large titre={titre} sousTitre={realisation?.titre} surFermeture={surFermeture}
      pied={(
        <>
          <Bouton type="submit" form={idForm} chargement={envoi}>{t('actions.enregistrer')}</Bouton>
          <Bouton variante="texte" onClick={surFermeture}>{t('actions.annuler')}</Bouton>
          {realisation && (
            <span style={{ marginLeft: 'auto' }}>
              <BoutonSupprimer nom={realisation.titre} surConfirmation={async () => {
                await supprimerRealisation(realisation.id);
                surSuppression(realisation);
              }} />
            </span>
          )}
        </>
      )}>
      <form id={idForm} className={gestion.formulaire} onSubmit={envoyer} noValidate aria-label={titre}>
        <OngletsLangues valeurs={form} traductions={form.traductions} erreurs={erreurs} surChangement={changer}
          surTraductions={(traductions) => changer('traductions', traductions)}
          champs={[
            { nom: 'titre', libelle: t('vitrine.realisations.titreChamp'), required: true },
            { nom: 'description', libelle: t('vitrine.realisations.description'), multiligne: true },
          ]} />
        <div className={gestion.grille}>
          <Champ libelle={t('vitrine.realisations.type')} name="type_chantier" value={form.type_chantier}
            options={optionsUsages()} erreur={erreurs.type_chantier} onChange={(e) => changer('type_chantier', e.target.value)} />
          <Champ libelle={t('vitrine.realisations.ville')} name="ville" value={form.ville} erreur={erreurs.ville}
            onChange={(e) => changer('ville', e.target.value)} />
          <Champ libelle={t('vitrine.realisations.date')} name="date" type="date" value={form.date} erreur={erreurs.date}
            onChange={(e) => changer('date', e.target.value)} />
          <Champ libelle={t('vitrine.realisations.ordre')} name="ordre" type="number" min="0" value={form.ordre}
            erreur={erreurs.ordre} onChange={(e) => changer('ordre', e.target.value)} />
        </div>
        <label className={gestion.case}>
          <input type="checkbox" name="publie" checked={form.publie} onChange={(e) => changer('publie', e.target.checked)} />
          {t('vitrine.publie')}
        </label>
        <div className={gestion.grille}>
          <ChampImage libelle={t('vitrine.realisations.imageApres')} image={realisation?.image_apres} required
            fichier={fichiers.image_apres || null} erreur={erreurs.image_apres}
            surChoix={(f) => choisirFichier('image_apres', f)} />
          <ChampImage libelle={t('vitrine.realisations.imageAvant')} image={imageAvant}
            fichier={fichiers.image_avant || null} erreur={erreurs.image_avant}
            surChoix={(f) => choisirFichier('image_avant', f)}
            surRetrait={() => setFichiers((f) => ({ ...f, image_avant: null }))} />
        </div>
        <ChoixProduits valeur={form.produits} erreur={erreurs.produits} surChangement={(ids) => changer('produits', ids)} />
        <MessageErreur erreur={erreur} />
      </form>
    </Tiroir>
  );
}
