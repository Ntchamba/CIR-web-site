// Négociation côté équipe : propositions (état, auteur, montants, message), réponse à la proposition du client
// (`peut_repondre`), nouvelle proposition ou contre-proposition (`actions_possibles` contient « proposer »).
// Accepter une proposition passe la commande en « Contrat signé » : c'est le serveur qui décide, rien n'est déduit ici.
import { useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import { dateHeure, fcfa, STATUTS } from '@partage/utils/format.js';

import ConfirmerAction from '@/composants/ConfirmerAction.jsx';
import PastilleEtat from '@/composants/PastilleEtat.jsx';
import { useTraduction } from '@/i18n/index.js';

import { accepterProposition, refuserProposition } from '../api.js';
import styles from '../Commandes.module.css';
import FormulaireProposition from './FormulaireProposition.jsx';

const TONS = { en_attente: 'attention', acceptee: 'ok', refusee: 'alerte', remplacee: 'neutre' };

function Chiffre({ libelle, children }) {
  return <div><dt>{libelle}</dt><dd>{children}</dd></div>;
}

export default function PanneauNegociation({ commande, surMiseAJour, surDetail, annoncer }) {
  const { t } = useTraduction();
  const [formulaire, setFormulaire] = useState(false);
  const propositions = commande.propositions || [];
  const peutProposer = (commande.actions_possibles || []).includes('proposer');
  const aRepondre = propositions.some((p) => p.peut_repondre);

  async function repondre(fonction, proposition, message, texteAnnonce) {
    const detail = await fonction(commande.id, proposition.id, message);
    surDetail(detail);
    annoncer(texteAnnonce(detail));
  }

  return (
    <section className={`carte ${styles.carte}`} aria-labelledby="titre-negociation">
      <h2 id="titre-negociation" className={styles.titreCarte}>{t('commandes.negociation.titre')}</h2>

      {propositions.length === 0 ? (
        <p className={styles.vide}>{t('commandes.negociation.aucune')}</p>
      ) : (
        <ul className={styles.propositions}>
          {propositions.map((p) => (
            <li key={p.id} className={`${styles.proposition} ${p.etat === 'en_attente' ? styles.propositionEnAttente : ''}`}>
              <div className={styles.enteteProposition}>
                <strong>{t('commandes.negociation.de', { nom: p.auteur_nom || t(`commandes.auteurs.${p.auteur_role}`), role: t(`commandes.auteurs.${p.auteur_role}`) })}</strong>
                <PastilleEtat ton={TONS[p.etat] || 'neutre'}>{t(`commandes.negociation.etats.${p.etat}`)}</PastilleEtat>
              </div>
              <dl className={styles.chiffres}>
                {p.prix_m2 != null && <Chiffre libelle={t('commandes.negociation.prixM2')}>{fcfa(p.prix_m2)}</Chiffre>}
                {p.total != null && <Chiffre libelle={t('commandes.negociation.total')}>{fcfa(p.total)}</Chiffre>}
                {p.delai_jours != null && (
                  <Chiffre libelle={t('commandes.negociation.delai')}>{t('commandes.jours', { n: p.delai_jours })}</Chiffre>
                )}
              </dl>
              {p.message && <p className={styles.message}>{p.message}</p>}
              {p.reponse && (
                <p className={styles.message}>
                  <strong>{t(p.auteur_role === 'client' ? 'commandes.negociation.reponseEquipe' : 'commandes.negociation.reponseClient')}</strong>
                  {' : '}{p.reponse}
                </p>
              )}
              <small>{dateHeure(p.cree_le)}</small>
              {p.peut_repondre && (
                <div className={styles.actions}>
                  <ConfirmerAction libelle={t('commandes.negociation.accepter')} variante="plein"
                    question={t('commandes.negociation.confirmerAccepter', { etape: STATUTS.contrat_signe.libelle })}
                    libelleConfirmer={t('commandes.negociation.confirmerAccepterBouton')}
                    champ={{ libelle: t('commandes.negociation.messageFacultatif'), nom: 'message' }}
                    surConfirmation={(message) => repondre(accepterProposition, p, message,
                      () => t('commandes.negociation.accepteeAnnonce', { etape: STATUTS.contrat_signe.libelle }))} />
                  <ConfirmerAction libelle={t('commandes.negociation.refuser')}
                    question={t('commandes.negociation.confirmerRefuser')}
                    libelleConfirmer={t('commandes.negociation.confirmerRefuserBouton')}
                    champ={{ libelle: t('commandes.negociation.messageFacultatif'), nom: 'message' }}
                    surConfirmation={(message) => repondre(refuserProposition, p, message,
                      () => t('commandes.negociation.refuseeAnnonce'))} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {peutProposer && !formulaire && (
        <div>
          <Bouton variante={aRepondre ? 'contour' : 'plein'} onClick={() => setFormulaire(true)}>
            {aRepondre ? t('commandes.negociation.contreProposer') : t('commandes.negociation.proposer')}
          </Bouton>
        </div>
      )}
      {peutProposer && formulaire && (
        <FormulaireProposition commandeId={commande.id} contre={aRepondre}
          surAnnulation={() => setFormulaire(false)}
          surEnvoi={async () => {
            await surMiseAJour();
            setFormulaire(false);
            annoncer(t('commandes.negociation.envoyeeAnnonce'));
          }} />
      )}
    </section>
  );
}
