// BF-15 : contenu de l'accueil du site : titre, accroche et texte du partenaire (traduits), vidéo de fond
// (30 Mo au plus) et son image, coordonnées (téléphones, WhatsApp, e-mail, adresse).
// Un champ laissé vide : le site affiche son propre texte par défaut.
import { useEffect, useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';

import { t as traduire, useTraduction } from '@/i18n/index.js';
import ChampImage from '@/composants/ChampImage.jsx';
import { repartirErreur } from '@/composants/envoi.js';
import OngletsLangues from '@/composants/OngletsLangues.jsx';
import gestion from '@/composants/Gestion.module.css';

import { modifierAccueil } from './api.js';
import EditeurTelephones from './composants/EditeurTelephones.jsx';
import useContenus from './useContenus.js';

const CHAMPS = ['titre', 'accroche', 'texte_partenaire', 'traductions', 'video_fond', 'image_affiche', 'telephones',
  'whatsapp', 'email', 'adresse'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function versFormulaireAccueil(a) {
  const coordonnees = a?.coordonnees || {};
  return {
    titre: a?.titre || '', accroche: a?.accroche || '', texte_partenaire: a?.texte_partenaire || '',
    traductions: a?.traductions || {},
    telephones: [...(a?.telephones ?? coordonnees.telephones ?? [])],
    whatsapp: a?.whatsapp ?? coordonnees.whatsapp ?? '', email: a?.email ?? coordonnees.email ?? '',
    adresse: a?.adresse ?? coordonnees.adresse ?? '',
  };
}

export function validerAccueil(form) {
  const erreurs = {};
  if (form.email.trim() && !EMAIL.test(form.email.trim())) erreurs.email = traduire('contenus.accueil.emailInvalide');
  return erreurs;
}

export default function SectionAccueil() {
  const { t } = useTraduction();
  const { donnees: accueil, setDonnees, chargement, erreur: erreurChargement, recharger } = useContenus();
  const [form, setForm] = useState(() => versFormulaireAccueil(null));
  const [fichiers, setFichiers] = useState({});
  const [erreurs, setErreurs] = useState({});
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [annonce, setAnnonce] = useState('');

  useEffect(() => {
    if (accueil) setForm(versFormulaireAccueil(accueil));
  }, [accueil]);

  const changer = (champ, valeur) => setForm((f) => ({ ...f, [champ]: valeur }));
  const video = fichiers.video_fond === null ? null : accueil?.video_fond;
  const affiche = fichiers.image_affiche === null ? null : accueil?.image_affiche;

  async function envoyer(e) {
    e.preventDefault();
    const locales = validerAccueil(form);
    setErreurs(locales);
    setErreur(null);
    setAnnonce('');
    if (Object.keys(locales).length) return;
    setEnvoi(true);
    try {
      const resultat = await modifierAccueil({
        titre: form.titre.trim(), accroche: form.accroche.trim(), texte_partenaire: form.texte_partenaire.trim(),
        traductions: form.traductions, telephones: form.telephones.map((n) => n.trim()).filter(Boolean),
        whatsapp: form.whatsapp.trim(), email: form.email.trim(), adresse: form.adresse.trim(),
      }, fichiers);
      setDonnees(resultat);
      setFichiers({});
      setAnnonce(t('contenus.accueil.enregistre'));
    } catch (err) {
      const { champs, generale } = repartirErreur(err, CHAMPS);
      setErreurs(champs);
      setErreur(generale);
    } finally {
      setEnvoi(false);
    }
  }

  if (chargement) return <Chargement texte={t('contenus.accueil.chargement')} />;
  if (erreurChargement) return <MessageErreur erreur={erreurChargement} reessayer={recharger} />;

  return (
    <section className={gestion.page} aria-labelledby="titre-accueil">
      <div>
        <h2 id="titre-accueil" className={gestion.titreCarte}>{t('contenus.accueil.titre')}</h2>
        <p className={gestion.aide}>{t('contenus.accueil.aide')}</p>
      </div>
      <p className="visuellement-cache" role="status" aria-live="polite">{annonce}</p>
      {annonce && <p className={gestion.succes}>{annonce}</p>}

      <form className={`carte ${gestion.formulaire}`} onSubmit={envoyer} noValidate aria-labelledby="titre-accueil">
        <fieldset className={gestion.bloc}>
          <legend>{t('contenus.accueil.textes')}</legend>
          <OngletsLangues valeurs={form} traductions={form.traductions} erreurs={erreurs} surChangement={changer}
            surTraductions={(traductions) => changer('traductions', traductions)}
            champs={[
              { nom: 'titre', libelle: t('contenus.accueil.titreChamp') },
              { nom: 'accroche', libelle: t('contenus.accueil.accroche'), multiligne: true },
              { nom: 'texte_partenaire', libelle: t('contenus.accueil.textePartenaire'), multiligne: true,
                aide: t('contenus.accueil.aidePartenaire') },
            ]} />
        </fieldset>

        <fieldset className={gestion.bloc}>
          <legend>{t('contenus.accueil.medias')}</legend>
          <div className={gestion.grille}>
            <ChampImage video tailleMaxMo={30} libelle={t('contenus.accueil.video')} image={video}
              fichier={fichiers.video_fond || null} erreur={erreurs.video_fond}
              surChoix={(f) => setFichiers((x) => ({ ...x, video_fond: f ?? undefined }))}
              surRetrait={() => setFichiers((x) => ({ ...x, video_fond: null }))} />
            <ChampImage libelle={t('contenus.accueil.affiche')} image={affiche} aide={t('contenus.accueil.aideAffiche')}
              fichier={fichiers.image_affiche || null} erreur={erreurs.image_affiche}
              surChoix={(f) => setFichiers((x) => ({ ...x, image_affiche: f ?? undefined }))}
              surRetrait={() => setFichiers((x) => ({ ...x, image_affiche: null }))} />
          </div>
        </fieldset>

        <fieldset className={gestion.bloc}>
          <legend>{t('contenus.accueil.coordonnees')}</legend>
          <EditeurTelephones telephones={form.telephones} erreur={erreurs.telephones}
            surChangement={(liste) => changer('telephones', liste)} />
          <div className={gestion.grille}>
            <Champ libelle={t('contenus.accueil.whatsapp')} name="whatsapp" type="tel" inputMode="tel" value={form.whatsapp}
              erreur={erreurs.whatsapp} onChange={(e) => changer('whatsapp', e.target.value)} />
            <Champ libelle={t('contenus.accueil.email')} name="email" type="email" inputMode="email" value={form.email}
              erreur={erreurs.email} onChange={(e) => changer('email', e.target.value)} />
          </div>
          <Champ libelle={t('contenus.accueil.adresse')} name="adresse" value={form.adresse} erreur={erreurs.adresse}
            onChange={(e) => changer('adresse', e.target.value)} />
        </fieldset>

        <MessageErreur erreur={erreur} />
        <div className={gestion.actionsFormulaire}>
          <Bouton type="submit" chargement={envoi}>{t('actions.enregistrer')}</Bouton>
        </div>
      </form>
    </section>
  );
}
