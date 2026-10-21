// Négociation : proposition en cours, réponse (accepter, refuser, contre-proposer), nouvelle proposition et historique.
// Les boutons suivent UNIQUEMENT `peut_repondre` (par proposition) et `actions_possibles` (par commande) du serveur.
import { useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { fcfa } from '@partage/utils/format.js';

import Confirmation from '@/composants/Confirmation.jsx';
import { useTraduction } from '@/i18n/index.js';

import * as commandes from '../api.js';
import FormulaireProposition from './FormulaireProposition.jsx';
import Proposition from './Proposition.jsx';
import styles from '../Commandes.module.css';

/** Phrase de ce que l'on accepte : total si la proposition en a un, sinon prix au m² (rien n'est calculé ici). */
function resume(t, p) {
  const morceaux = [];
  if (p.total !== null && p.total !== undefined) morceaux.push(t('commandes.negociation.resumeTotal', { montant: fcfa(p.total) }));
  if (p.prix_m2 !== null && p.prix_m2 !== undefined) morceaux.push(t('commandes.negociation.parM2', { montant: fcfa(p.prix_m2) }));
  if (p.delai_jours) morceaux.push(t('commandes.negociation.jours', { n: p.delai_jours }));
  return morceaux.join(', ');
}

/**
 * `commande` : détail renvoyé par le serveur ; `onDetail(detail)` : réponse d'une action ; `onActualiser()` : redemande la commande.
 */
export default function Negociation({ commande, onDetail, onActualiser }) {
  const { t } = useTraduction();
  const actions = commande.actions_possibles || [];
  const propositions = [...(commande.propositions || [])].sort((a, b) => new Date(b.cree_le) - new Date(a.cree_le) || b.id - a.id);
  const enAttente = propositions.find((p) => p.etat === 'en_attente') || null;
  const anciennes = propositions.filter((p) => p !== enAttente);
  const peutProposer = actions.includes('proposer');
  const peutRepondre = Boolean(enAttente?.peut_repondre);

  const [mode, setMode] = useState(null); // 'accepter' | 'refuser' | 'proposer' | null
  const [messageReponse, setMessageReponse] = useState('');
  const [etat, setEtat] = useState({ envoi: false, erreur: null });
  const [resultat, setResultat] = useState('');

  const fermer = () => {
    setMode(null);
    setMessageReponse('');
    setEtat({ envoi: false, erreur: null });
  };

  async function repondre(action) {
    setEtat({ envoi: true, erreur: null });
    try {
      const detail = await (action === 'accepter' ? commandes.accepter : commandes.refuser)(
        commande.id, enAttente.id, messageReponse.trim(),
      );
      setResultat(action === 'accepter'
        ? t('commandes.negociation.signe', { montant: fcfa(detail?.montant_convenu) })
        : t('commandes.negociation.refusee'));
      fermer();
      onDetail(detail);
    } catch (erreur) {
      setEtat({ envoi: false, erreur });
    }
  }

  async function apresProposition() {
    setResultat(t('commandes.negociation.envoyee'));
    fermer();
    await onActualiser();
  }

  const libelleProposer = peutRepondre
    ? t('commandes.negociation.contrePropose')
    : enAttente ? t('commandes.negociation.reviser') : t('commandes.negociation.proposer');

  return (
    <section id="negociation" aria-labelledby="titre-negociation" className={styles.bloc}>
      <h2 id="titre-negociation" className="visuellement-cache">{t('commandes.negociation.titre')}</h2>
      <p role="status" aria-live="polite" className={resultat ? styles.succes : 'visuellement-cache'}>{resultat}</p>

      {propositions.length === 0 && <p className={styles.meta}>{t('commandes.negociation.aucune')}</p>}

      {enAttente && (
        <div className={styles.enCours}>
          <h3>{t(enAttente.auteur_role === 'equipe' ? 'commandes.negociation.enCours' : 'commandes.negociation.enCoursClient')}</h3>
          <Proposition proposition={enAttente} mise />
          {!peutRepondre && enAttente.auteur_role === 'client' && (
            <p className={styles.meta}>{t('commandes.negociation.attenteEquipe')}</p>
          )}
          {peutRepondre && mode === null && (
            <div className={styles.rangee}>
              <Bouton onClick={() => setMode('accepter')}>{t('commandes.negociation.accepter')}</Bouton>
              <Bouton variante="contour" onClick={() => setMode('refuser')}>{t('commandes.negociation.refuser')}</Bouton>
            </div>
          )}
        </div>
      )}

      {(mode === 'accepter' || mode === 'refuser') && enAttente && (
        <Confirmation
          titre={mode === 'accepter' ? t('commandes.negociation.confirmerAccepter') : t('commandes.negociation.confirmerRefuser')}
          danger={mode === 'refuser'}
          libelleConfirmer={mode === 'accepter' ? t('commandes.negociation.accepter') : t('commandes.negociation.refuser')}
          chargement={etat.envoi} onConfirmer={() => repondre(mode)} onRetour={fermer}>
          <p>{mode === 'accepter'
            ? t('commandes.negociation.texteAccepter', { resume: resume(t, enAttente) })
            : t('commandes.negociation.texteRefuser')}</p>
          <Champ libelle={t('commandes.negociation.messageFacultatif')} multiligne value={messageReponse} maxLength={1000}
            onChange={(e) => setMessageReponse(e.target.value)} />
          <MessageErreur erreur={etat.erreur} />
        </Confirmation>
      )}

      {peutProposer && mode === null && (
        <div className={styles.rangee}>
          <Bouton variante={peutRepondre ? 'contour' : 'plein'} onClick={() => setMode('proposer')}>{libelleProposer}</Bouton>
        </div>
      )}
      {mode === 'proposer' && (
        <FormulaireProposition commande={commande} titre={libelleProposer} onEnvoyee={apresProposition} onFermer={fermer} />
      )}

      {anciennes.length > 0 && (
        <div className={styles.historiquePropositions}>
          <h3>{t('commandes.negociation.historique')}</h3>
          <ul className={styles.liste}>
            {anciennes.map((p) => <li key={p.id}><Proposition proposition={p} /></li>)}
          </ul>
        </div>
      )}
    </section>
  );
}
