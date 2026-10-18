// Formulaire de proposition ou de contre-proposition : prix au m², total, délai, message.
// Le serveur calcule le total si la surface est connue ; ses erreurs s'affichent sous les champs.
import { useState } from 'react';

import { erreursChamps } from '@partage/api/client.js';
import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';

import { useTraduction } from '@/i18n/index.js';

import * as commandes from '../api.js';
import { corpsProposition, MESSAGE_MAX, validerProposition } from '../regles.js';
import styles from '../Commandes.module.css';

const VIDE = { prix_m2: '', total: '', delai_jours: '', message: '' };

export default function FormulaireProposition({ commande, titre, onEnvoyee, onFermer }) {
  const { t } = useTraduction();
  const [form, setForm] = useState(VIDE);
  const [erreurs, setErreurs] = useState({});
  const [etat, setEtat] = useState({ envoi: false, erreur: null });
  const changer = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function envoyer(e) {
    e.preventDefault();
    const locales = validerProposition(form);
    setErreurs(locales);
    if (Object.keys(locales).length) {
      setEtat({ envoi: false, erreur: t('commandes.proposition.erreurs.incomplet') });
      return;
    }
    setEtat({ envoi: true, erreur: null });
    try {
      await commandes.proposer(commande.id, corpsProposition(form));
      setEtat({ envoi: false, erreur: null });
      await onEnvoyee();
    } catch (erreur) {
      setErreurs(erreursChamps(erreur));
      setEtat({ envoi: false, erreur });
    }
  }

  return (
    <form className={styles.formProposition} onSubmit={envoyer} noValidate aria-label={titre}>
      <h3>{titre}</h3>
      <div className={styles.deuxColonnes}>
        <Champ libelle={t('commandes.proposition.prixM2')} name="prix_m2" type="number" inputMode="numeric" min="0" step="1"
          value={form.prix_m2} onChange={changer} erreur={erreurs.prix_m2} />
        <Champ libelle={t('commandes.proposition.total')} name="total" type="number" inputMode="numeric" min="0" step="1"
          value={form.total} onChange={changer} erreur={erreurs.total} aide={t('commandes.proposition.aideTotal')} />
      </div>
      <Champ libelle={t('commandes.proposition.delai')} name="delai_jours" type="number" inputMode="numeric" min="1" step="1"
        value={form.delai_jours} onChange={changer} erreur={erreurs.delai_jours} />
      <Champ libelle={t('commandes.proposition.message')} name="message" multiligne maxLength={MESSAGE_MAX}
        value={form.message} onChange={changer} erreur={erreurs.message}
        aide={t('commandes.proposition.aideMessage', { n: form.message.length, max: MESSAGE_MAX })} />
      <MessageErreur erreur={etat.erreur} />
      <div className={styles.rangee}>
        <Bouton type="submit" chargement={etat.envoi}>{t('commandes.proposition.envoyer')}</Bouton>
        <Bouton variante="contour" onClick={onFermer} disabled={etat.envoi}>{t('confirmation.retour')}</Bouton>
      </div>
    </form>
  );
}
