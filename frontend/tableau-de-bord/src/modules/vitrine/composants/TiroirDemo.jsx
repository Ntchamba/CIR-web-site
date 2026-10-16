// Création ou modification d'une démo vidéo : titre et description traduits, vidéo envoyée (.mp4 ou .webm,
// 50 Mo au plus) ou lien YouTube / Vimeo (au moins l'un des deux), miniature, durée, réalisation liée.
import { useId, useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';

import { t as traduire, useTraduction } from '@/i18n/index.js';
import BoutonSupprimer from '@/composants/BoutonSupprimer.jsx';
import ChampImage from '@/composants/ChampImage.jsx';
import { repartirErreur } from '@/composants/envoi.js';
import OngletsLangues from '@/composants/OngletsLangues.jsx';
import Tiroir from '@/composants/Tiroir.jsx';
import gestion from '@/composants/Gestion.module.css';

import { creerDemo, modifierDemo, supprimerDemo } from '../api.js';

const CHAMPS = ['titre', 'description', 'video', 'lien', 'miniature', 'duree', 'realisation', 'publie', 'ordre', 'traductions'];
const LIEN_VIDEO = /^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be|vimeo\.com|player\.vimeo\.com)\//i;
const DUREE = /^\d{1,3}:[0-5]\d$/;

export function validerDemo(form, { video }) {
  const erreurs = {};
  if (!form.titre.trim()) erreurs.titre = traduire('vitrine.demos.titreManquant');
  const lien = form.lien.trim();
  if (lien && !LIEN_VIDEO.test(lien)) erreurs.lien = traduire('vitrine.demos.lienInvalide');
  else if (!lien && !video) erreurs.lien = traduire('vitrine.demos.videoOuLien');
  if (form.duree.trim() && !DUREE.test(form.duree.trim())) erreurs.duree = traduire('vitrine.demos.dureeInvalide');
  return erreurs;
}

const idRealisation = (r) => (r && typeof r === 'object' ? r.id : r);

export default function TiroirDemo({ demo, realisations, surFermeture, surEnregistrement, surSuppression }) {
  const { t } = useTraduction();
  const idForm = useId();
  const [form, setForm] = useState({
    titre: demo?.titre || '', description: demo?.description || '', traductions: demo?.traductions || {},
    lien: demo?.lien || '', duree: demo?.duree || '',
    realisation: idRealisation(demo?.realisation) != null ? String(idRealisation(demo.realisation)) : '',
    publie: demo ? Boolean(demo.publie) : true, ordre: String(demo?.ordre ?? 0),
  });
  const [fichiers, setFichiers] = useState({});
  const [erreurs, setErreurs] = useState({});
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const changer = (champ, valeur) => setForm((f) => ({ ...f, [champ]: valeur }));
  const choisir = (champ, fichier) => setFichiers((f) => ({ ...f, [champ]: fichier ?? undefined }));
  const videoActuelle = fichiers.video === null ? null : demo?.video;
  const miniatureActuelle = fichiers.miniature === null ? null : demo?.miniature;

  async function envoyer(e) {
    e.preventDefault();
    const locales = validerDemo(form, { video: fichiers.video || videoActuelle });
    setErreurs(locales);
    setErreur(null);
    if (Object.keys(locales).length) return;
    setEnvoi(true);
    const donnees = {
      titre: form.titre.trim(), description: form.description.trim(), traductions: form.traductions,
      lien: form.lien.trim(), duree: form.duree.trim(), realisation: form.realisation ? Number(form.realisation) : null,
      publie: form.publie, ordre: Number.parseInt(form.ordre, 10) || 0,
    };
    try {
      const resultat = demo ? await modifierDemo(demo.id, donnees, fichiers) : await creerDemo(donnees, fichiers);
      surEnregistrement(resultat);
    } catch (err) {
      const { champs, generale } = repartirErreur(err, CHAMPS);
      setErreurs(champs);
      setErreur(generale);
      setEnvoi(false);
    }
  }

  const titre = demo ? t('vitrine.demos.titreModifier') : t('vitrine.demos.titreNouvelle');
  return (
    <Tiroir ouvert large titre={titre} sousTitre={demo?.titre} surFermeture={surFermeture}
      pied={(
        <>
          <Bouton type="submit" form={idForm} chargement={envoi}>{t('actions.enregistrer')}</Bouton>
          <Bouton variante="texte" onClick={surFermeture}>{t('actions.annuler')}</Bouton>
          {demo && (
            <span style={{ marginLeft: 'auto' }}>
              <BoutonSupprimer nom={demo.titre} surConfirmation={async () => {
                await supprimerDemo(demo.id);
                surSuppression(demo);
              }} />
            </span>
          )}
        </>
      )}>
      <form id={idForm} className={gestion.formulaire} onSubmit={envoyer} noValidate aria-label={titre}>
        <OngletsLangues valeurs={form} traductions={form.traductions} erreurs={erreurs} surChangement={changer}
          surTraductions={(traductions) => changer('traductions', traductions)}
          champs={[
            { nom: 'titre', libelle: t('vitrine.demos.titreChamp'), required: true },
            { nom: 'description', libelle: t('vitrine.demos.description'), multiligne: true },
          ]} />
        <fieldset className={gestion.bloc}>
          <legend>{t('vitrine.demos.source')}</legend>
          <p className={gestion.aide}>{t('vitrine.demos.aideSource')}</p>
          <ChampImage video libelle={t('vitrine.demos.video')} image={videoActuelle} fichier={fichiers.video || null}
            erreur={erreurs.video} surChoix={(f) => choisir('video', f)}
            surRetrait={() => setFichiers((f) => ({ ...f, video: null }))} />
          <Champ libelle={t('vitrine.demos.lien')} name="lien" type="url" value={form.lien} inputMode="url"
            placeholder="https://www.youtube.com/watch?v=…" erreur={erreurs.lien} aide={t('vitrine.demos.aideLien')}
            onChange={(e) => changer('lien', e.target.value)} />
        </fieldset>
        <div className={gestion.grille}>
          <Champ libelle={t('vitrine.demos.duree')} name="duree" value={form.duree} placeholder="1:45"
            aide={t('vitrine.demos.aideDuree')} erreur={erreurs.duree} onChange={(e) => changer('duree', e.target.value)} />
          <Champ libelle={t('vitrine.demos.realisation')} name="realisation" value={form.realisation} erreur={erreurs.realisation}
            onChange={(e) => changer('realisation', e.target.value)}
            options={[['', t('vitrine.demos.aucuneRealisation')], ...realisations.map((r) => [String(r.id), r.titre])]} />
          <Champ libelle={t('vitrine.demos.ordre')} name="ordre" type="number" min="0" value={form.ordre} erreur={erreurs.ordre}
            onChange={(e) => changer('ordre', e.target.value)} />
        </div>
        <ChampImage libelle={t('vitrine.demos.miniature')} image={miniatureActuelle} fichier={fichiers.miniature || null}
          erreur={erreurs.miniature} surChoix={(f) => choisir('miniature', f)}
          surRetrait={() => setFichiers((f) => ({ ...f, miniature: null }))} />
        <label className={gestion.case}>
          <input type="checkbox" name="publie" checked={form.publie} onChange={(e) => changer('publie', e.target.checked)} />
          {t('vitrine.publie')}
        </label>
        <MessageErreur erreur={erreur} />
      </form>
    </Tiroir>
  );
}
