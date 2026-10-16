// Création ou modification d'un bandeau d'annonce : texte traduit, lien interne facultatif (« /catalogue »),
// activation, période facultative, ordre.
import { useId, useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';

import { t as traduire, useTraduction } from '@/i18n/index.js';
import BoutonSupprimer from '@/composants/BoutonSupprimer.jsx';
import { repartirErreur } from '@/composants/envoi.js';
import OngletsLangues from '@/composants/OngletsLangues.jsx';
import Tiroir from '@/composants/Tiroir.jsx';
import gestion from '@/composants/Gestion.module.css';

import { creerBandeau, modifierBandeau, supprimerBandeau } from '../api.js';

const CHAMPS = ['texte', 'lien', 'actif', 'debut', 'fin', 'ordre', 'traductions'];
// Même règle que le serveur (^/(?!/)[^\s\\]*$) : chemin du site, sans espace, caractère de contrôle ni « \ ».
// eslint-disable-next-line no-control-regex
const LIEN_INTERNE = /^\/(?!\/)[^\s\\\u0000-\u001f\u007f]*$/;

export function validerBandeau(form) {
  const erreurs = {};
  if (!form.texte.trim()) erreurs.texte = traduire('contenus.bandeaux.texteManquant');
  const lien = form.lien.trim();
  // Fin incluse : le bandeau s'affiche encore le jour de fin ; fin == début est permis.
  if (lien && !LIEN_INTERNE.test(lien)) erreurs.lien = traduire('contenus.bandeaux.lienInvalide');
  if (form.debut && form.fin && form.fin < form.debut) erreurs.fin = traduire('contenus.bandeaux.finAvantDebut');
  return erreurs;
}

export default function TiroirBandeau({ bandeau, surFermeture, surEnregistrement, surSuppression }) {
  const { t } = useTraduction();
  const idForm = useId();
  const [form, setForm] = useState({
    texte: bandeau?.texte || '', traductions: bandeau?.traductions || {}, lien: bandeau?.lien || '',
    actif: bandeau ? Boolean(bandeau.actif) : true, debut: String(bandeau?.debut || '').slice(0, 10),
    fin: String(bandeau?.fin || '').slice(0, 10), ordre: String(bandeau?.ordre ?? 0),
  });
  const [erreurs, setErreurs] = useState({});
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const changer = (champ, valeur) => setForm((f) => ({ ...f, [champ]: valeur }));

  async function envoyer(e) {
    e.preventDefault();
    const locales = validerBandeau(form);
    setErreurs(locales);
    setErreur(null);
    if (Object.keys(locales).length) return;
    setEnvoi(true);
    const donnees = {
      texte: form.texte.trim(), traductions: form.traductions, lien: form.lien.trim(), actif: form.actif,
      debut: form.debut || null, fin: form.fin || null, ordre: Number.parseInt(form.ordre, 10) || 0,
    };
    try {
      surEnregistrement(bandeau ? await modifierBandeau(bandeau.id, donnees) : await creerBandeau(donnees));
    } catch (err) {
      const { champs, generale } = repartirErreur(err, CHAMPS);
      setErreurs(champs);
      setErreur(generale);
      setEnvoi(false);
    }
  }

  const titre = bandeau ? t('contenus.bandeaux.titreModifier') : t('contenus.bandeaux.titreNouveau');
  return (
    <Tiroir ouvert titre={titre} surFermeture={surFermeture}
      pied={(
        <>
          <Bouton type="submit" form={idForm} chargement={envoi}>{t('actions.enregistrer')}</Bouton>
          <Bouton variante="texte" onClick={surFermeture}>{t('actions.annuler')}</Bouton>
          {bandeau && (
            <span style={{ marginLeft: 'auto' }}>
              <BoutonSupprimer nom={bandeau.texte} surConfirmation={async () => {
                await supprimerBandeau(bandeau.id);
                surSuppression(bandeau);
              }} />
            </span>
          )}
        </>
      )}>
      <form id={idForm} className={gestion.formulaire} onSubmit={envoyer} noValidate aria-label={titre}>
        <OngletsLangues valeurs={form} traductions={form.traductions} erreurs={erreurs} surChangement={changer}
          surTraductions={(traductions) => changer('traductions', traductions)}
          champs={[{ nom: 'texte', libelle: t('contenus.bandeaux.texte'), required: true, maxLength: 200 }]} />
        <Champ libelle={t('contenus.bandeaux.lien')} name="lien" value={form.lien} placeholder="/catalogue"
          aide={t('contenus.bandeaux.aideLien')} erreur={erreurs.lien} onChange={(e) => changer('lien', e.target.value)} />
        <label className={gestion.case}>
          <input type="checkbox" name="actif" checked={form.actif} onChange={(e) => changer('actif', e.target.checked)} />
          {t('contenus.bandeaux.actif')}
        </label>
        <div className={gestion.grille}>
          <Champ libelle={t('contenus.bandeaux.debut')} name="debut" type="date" value={form.debut} erreur={erreurs.debut}
            onChange={(e) => changer('debut', e.target.value)} />
          <Champ libelle={t('contenus.bandeaux.fin')} name="fin" type="date" value={form.fin} erreur={erreurs.fin}
            onChange={(e) => changer('fin', e.target.value)} />
          <Champ libelle={t('contenus.bandeaux.ordre')} name="ordre" type="number" min="0" value={form.ordre}
            erreur={erreurs.ordre} onChange={(e) => changer('ordre', e.target.value)} />
        </div>
        <p className={gestion.aide}>{t('contenus.bandeaux.aidePeriode')}</p>
        <MessageErreur erreur={erreur} />
      </form>
    </Tiroir>
  );
}
