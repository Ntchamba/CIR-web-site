// Actions du client sur sa commande : modifier (surface, description) et annuler (avec motif).
// Chaque bouton n'apparaît que si le serveur l'autorise (`actions_possibles`) ; annuler demande une confirmation.
import { useState } from 'react';

import { erreursChamps } from '@partage/api/client.js';
import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';

import Confirmation from '@/composants/Confirmation.jsx';
import { useTraduction } from '@/i18n/index.js';

import * as commandes from '../api.js';
import { DESCRIPTION_MAX, nombreOuVide } from '../regles.js';
import styles from '../Commandes.module.css';

export default function ActionsCommande({ commande, onApres }) {
  const { t } = useTraduction();
  const actions = commande.actions_possibles || [];
  const [mode, setMode] = useState(null); // 'modifier' | 'annuler'
  const [form, setForm] = useState({ surface_m2: commande.surface_m2 ?? '', description: commande.description ?? '' });
  const [motif, setMotif] = useState('');
  const [erreurs, setErreurs] = useState({});
  const [etat, setEtat] = useState({ envoi: false, erreur: null });
  const [resultat, setResultat] = useState('');

  const peutModifier = actions.includes('modifier');
  const peutAnnuler = actions.includes('annuler');
  if (!peutModifier && !peutAnnuler && !resultat) return null;

  const fermer = () => {
    setMode(null);
    setErreurs({});
    setEtat({ envoi: false, erreur: null });
  };

  async function modifier(e) {
    e.preventDefault();
    const surface = nombreOuVide(form.surface_m2);
    if (Number.isNaN(surface) || surface === 0) {
      setErreurs({ surface_m2: t('commandes.nouvelle.erreurs.surface') });
      return;
    }
    setEtat({ envoi: true, erreur: null });
    try {
      const corps = { description: form.description.trim() };
      if (surface !== null) corps.surface_m2 = surface;
      const reponse = await commandes.modifier(commande.id, corps);
      setResultat(t('commandes.actions.enregistre'));
      fermer();
      await onApres(reponse);
    } catch (erreur) {
      setErreurs(erreursChamps(erreur));
      setEtat({ envoi: false, erreur });
    }
  }

  async function annuler() {
    setEtat({ envoi: true, erreur: null });
    try {
      const reponse = await commandes.annuler(commande.id, motif.trim());
      setResultat(t('commandes.actions.annulee'));
      fermer();
      await onApres(reponse);
    } catch (erreur) {
      setEtat({ envoi: false, erreur });
    }
  }

  return (
    <section aria-label={t('commandes.actions.titre')} className={styles.bloc}>
      <p role="status" aria-live="polite" className={resultat ? styles.succes : 'visuellement-cache'}>{resultat}</p>
      {mode === null && (
        <div className={styles.rangee}>
          {peutModifier && <Bouton variante="contour" onClick={() => setMode('modifier')}>{t('commandes.actions.modifier')}</Bouton>}
          {peutAnnuler && <Bouton variante="contour" onClick={() => setMode('annuler')}>{t('commandes.actions.annuler')}</Bouton>}
        </div>
      )}

      {mode === 'modifier' && (
        <form onSubmit={modifier} noValidate className={styles.formProposition} aria-label={t('commandes.actions.modifier')}>
          <Champ libelle={t('commandes.nouvelle.surface')} name="surface_m2" type="number" inputMode="decimal" min="0" step="0.01"
            value={form.surface_m2} onChange={(e) => setForm((f) => ({ ...f, surface_m2: e.target.value }))}
            erreur={erreurs.surface_m2} />
          <Champ libelle={t('commandes.nouvelle.description')} name="description" multiligne maxLength={DESCRIPTION_MAX}
            value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            erreur={erreurs.description} />
          <MessageErreur erreur={etat.erreur} />
          <div className={styles.rangee}>
            <Bouton type="submit" chargement={etat.envoi}>{t('commandes.actions.enregistrer')}</Bouton>
            <Bouton variante="contour" onClick={fermer} disabled={etat.envoi}>{t('confirmation.retour')}</Bouton>
          </div>
        </form>
      )}

      {mode === 'annuler' && (
        <Confirmation titre={t('commandes.actions.confirmerAnnuler')} danger libelleConfirmer={t('commandes.actions.annuler')}
          libelleRetour={t('commandes.actions.garder')} chargement={etat.envoi} onConfirmer={annuler} onRetour={fermer}>
          <p>{t('commandes.actions.texteAnnuler')}</p>
          <Champ libelle={t('commandes.actions.motif')} multiligne maxLength={500} value={motif}
            onChange={(e) => setMotif(e.target.value)} />
          <MessageErreur erreur={etat.erreur} />
        </Confirmation>
      )}
    </section>
  );
}
