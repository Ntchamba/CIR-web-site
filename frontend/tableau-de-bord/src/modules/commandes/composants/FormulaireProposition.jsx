// Formulaire d'une proposition ou contre-proposition de l'équipe : prix au m², total, délai, message.
// Le serveur calcule le total quand la surface est connue ; les erreurs 400 s'affichent sous les champs.
import { useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';

import { lirePrix, repartirErreur } from '@/composants/envoi.js';
import { useTraduction } from '@/i18n/index.js';

import { proposer } from '../api.js';
import styles from '../Commandes.module.css';

const CHAMPS = ['prix_m2', 'total', 'delai_jours', 'message', 'non_field_errors'];

/** Saisie → corps de la requête (champs vides omis) et erreurs locales. */
export function lireProposition(saisie, t) {
  const erreurs = {};
  const corps = {};
  [['prix_m2', 0], ['total', 0], ['delai_jours', 1]].forEach(([champ, minimum]) => {
    const valeur = lirePrix(saisie[champ]);
    if (valeur === null) return;
    if (Number.isNaN(valeur) || valeur < minimum) erreurs[champ] = t(champ === 'delai_jours' ? 'commandes.negociation.delaiInvalide' : 'commandes.negociation.montantInvalide');
    else corps[champ] = valeur;
  });
  if (!erreurs.prix_m2 && !erreurs.total && corps.prix_m2 === undefined && corps.total === undefined) {
    erreurs.prix_m2 = t('commandes.negociation.prixOuTotal');
  }
  if (saisie.message.trim()) corps.message = saisie.message.trim();
  return { corps, erreurs };
}

export default function FormulaireProposition({ commandeId, contre = false, surEnvoi, surAnnulation }) {
  const { t } = useTraduction();
  const [saisie, setSaisie] = useState({ prix_m2: '', total: '', delai_jours: '', message: '' });
  const [erreurs, setErreurs] = useState({});
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const changer = (e) => setSaisie((s) => ({ ...s, [e.target.name]: e.target.value }));

  async function envoyer(e) {
    e.preventDefault();
    const { corps, erreurs: locales } = lireProposition(saisie, t);
    setErreurs(locales);
    setErreur(null);
    if (Object.keys(locales).length) return;
    setEnvoi(true);
    try {
      const proposition = await proposer(commandeId, corps);
      await surEnvoi(proposition);
    } catch (err) {
      const { champs, generale } = repartirErreur(err, CHAMPS);
      setErreurs(champs);
      setErreur(generale);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form className={styles.formProposition} onSubmit={envoyer} noValidate
      aria-label={contre ? t('commandes.negociation.contreProposer') : t('commandes.negociation.proposer')}>
      <div className={styles.grille}>
        <Champ libelle={t('commandes.negociation.prixM2')} name="prix_m2" inputMode="numeric" value={saisie.prix_m2}
          onChange={changer} erreur={erreurs.prix_m2} />
        <Champ libelle={t('commandes.negociation.total')} name="total" inputMode="numeric" value={saisie.total}
          onChange={changer} erreur={erreurs.total} aide={t('commandes.negociation.aideTotal')} />
        <Champ libelle={t('commandes.negociation.delai')} name="delai_jours" inputMode="numeric" value={saisie.delai_jours}
          onChange={changer} erreur={erreurs.delai_jours} />
      </div>
      <Champ libelle={t('commandes.negociation.message')} name="message" multiligne rows={3} maxLength={1000}
        value={saisie.message} onChange={changer} erreur={erreurs.message}
        aide={t('commandes.negociation.aideMessage')} />
      {erreur && <MessageErreur erreur={erreur} />}
      <div className={styles.actions}>
        <Bouton type="submit" chargement={envoi}>{t('commandes.negociation.envoyer')}</Bouton>
        <Bouton variante="texte" onClick={surAnnulation}>{t('actions.annuler')}</Bouton>
      </div>
    </form>
  );
}
