// Formulaire de paiement : montant (reste ou autre montant), mode (Mobile Money ou carte/lien), numéro de téléphone.
// Un seul envoi à la fois (double clic sans effet).
import { useRef, useState } from 'react';

import { erreursChamps } from '@partage/api/client.js';
import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { fcfa } from '@partage/utils/format.js';

import { useTraduction } from '@/i18n/index.js';

import * as paiements from '../api.js';
import { codeErreur, messageCreation, validerPaiement } from '../regles.js';
import styles from '../Paiements.module.css';

export default function FormulairePaiement({ commande, reste, minimum = null, telephoneInitial = '', surCree, surEnCours }) {
  const { t } = useTraduction();
  const [form, setForm] = useState({ choixMontant: 'reste', montant: '', mode: 'mobile', telephone: telephoneInitial });
  const [erreurs, setErreurs] = useState({});
  const [etat, setEtat] = useState({ envoi: false, erreur: null });
  const verrou = useRef(false);

  const changer = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function envoyer(e) {
    e.preventDefault();
    if (verrou.current) return;
    const locales = validerPaiement(form, reste, minimum);
    setErreurs(locales);
    if (Object.keys(locales).length) return;
    verrou.current = true;
    const corps = { commande: commande.id, mode: form.mode };
    if (form.mode === 'mobile') corps.telephone = form.telephone.trim();
    if (form.choixMontant === 'autre') corps.montant = Number(form.montant.trim());
    setEtat({ envoi: true, erreur: null });
    try {
      const paiement = await paiements.creer(corps);
      setEtat({ envoi: false, erreur: null });
      surCree(paiement);
    } catch (erreur) {
      const brut = erreursChamps(erreur);
      const champs = Object.fromEntries(Object.entries(brut).filter(([nom]) => ['montant', 'telephone'].includes(nom)));
      setErreurs(champs);
      // Erreur liée à un champ : affichée sous le champ seulement (pas deux fois).
      setEtat({ envoi: false, erreur: Object.keys(champs).length ? null : messageCreation(erreur) });
      if (codeErreur(erreur) === 'paiement_en_cours') surEnCours?.();
    } finally {
      verrou.current = false;
    }
  }

  return (
    <form onSubmit={envoyer} noValidate className={styles.formulaire}>
      <fieldset className={styles.groupe}>
        <legend>{t('paiements.form.montant')}</legend>
        <label className={styles.choix}>
          <input type="radio" name="choixMontant" value="reste" checked={form.choixMontant === 'reste'} onChange={changer} />
          <span>{t('paiements.form.payerReste', { montant: fcfa(reste) })}</span>
        </label>
        <label className={styles.choix}>
          <input type="radio" name="choixMontant" value="autre" checked={form.choixMontant === 'autre'} onChange={changer} />
          <span>{t('paiements.form.autreMontant')}</span>
        </label>
        {form.choixMontant === 'autre' && (
          <Champ libelle={t('paiements.form.montantFcfa')} name="montant" inputMode="numeric" autoComplete="off"
            value={form.montant} onChange={changer} erreur={erreurs.montant}
            aide={t('paiements.form.montantAide', { max: fcfa(reste) })} required />
        )}
      </fieldset>

      <fieldset className={styles.groupe}>
        <legend>{t('paiements.form.mode')}</legend>
        <label className={styles.choix}>
          <input type="radio" name="mode" value="mobile" checked={form.mode === 'mobile'} onChange={changer} />
          <span>{t('paiements.form.mobile')}</span>
        </label>
        <label className={styles.choix}>
          <input type="radio" name="mode" value="lien" checked={form.mode === 'lien'} onChange={changer} />
          <span>{t('paiements.form.lien')}</span>
        </label>
        {form.mode === 'mobile' && (
          <Champ libelle={t('paiements.form.telephone')} name="telephone" type="tel" inputMode="tel" autoComplete="tel"
            value={form.telephone} onChange={changer} erreur={erreurs.telephone}
            aide={t('paiements.form.telephoneAide')} required />
        )}
        {form.mode === 'lien' && <p className={styles.meta}>{t('paiements.form.lienAide')}</p>}
      </fieldset>

      <div aria-live="polite">
        <MessageErreur erreur={etat.erreur} />
      </div>
      <div className={styles.rangee}>
        <Bouton type="submit" chargement={etat.envoi}>
          {form.choixMontant === 'reste' ? t('paiements.form.payer', { montant: fcfa(reste) }) : t('paiements.form.payerSimple')}
        </Bouton>
      </div>
    </form>
  );
}
