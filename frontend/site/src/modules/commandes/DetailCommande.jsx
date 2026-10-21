// BF-10, BF-12, BF-13 : détail d'une commande, à droite de la liste (maquette « Mes commandes ») : en-tête, étapes, dernière
// proposition (accepter, proposer un autre prix), échanges, puis produits, devis, contrat, paiement et adresse du chantier.
// Les actions autorisées viennent du serveur.
import { Link } from 'react-router';

import Bouton from '@partage/ui/Bouton.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import Icone from '@partage/ui/Icone.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { date, fcfa, surface } from '@partage/utils/format.js';
import usePageMeta from '@partage/utils/usePageMeta.js';

import { useTraduction } from '@/i18n/index.js';
import { useContexteAssistant } from '@/modules/assistant/contexte.js';
import BoutonAppel from '@/modules/appels/composants/BoutonAppel.jsx';
import ApercuDevis from '@/modules/devis/composants/ApercuDevis.jsx';
import BlocPaiement from '@/modules/paiements/composants/BlocPaiement.jsx';

import ActionsCommande from './composants/ActionsCommande.jsx';
import BadgeEtape from './composants/BadgeEtape.jsx';
import Contrat from './composants/Contrat.jsx';
import EtapesCommande from './composants/EtapesCommande.jsx';
import LignesCommande from './composants/LignesCommande.jsx';
import Negociation from './composants/Negociation.jsx';
import { useCommande } from './useCommandes.js';
import styles from './Commandes.module.css';

const ligneAdresse = (a) => [a?.rue_ou_repere, a?.quartier, a?.ville].filter(Boolean).join(', ');

/** `id` : commande affichée. `titreDeLaPage` : poser le titre du document (route /commandes/:id). */
export default function DetailCommande({ id }) {
  const { t } = useTraduction();
  const { commande, chargement, erreur, recharger, appliquer, actualiser, apresAction } = useCommande(id);
  usePageMeta(commande ? t('commandes.detail.meta', { reference: commande.reference }) : t('commandes.titre'));
  useContexteAssistant('commande', commande?.reference); // contexte transmis à l'assistant (indice vérifié par le serveur)

  if (!commande) {
    if (erreur?.statut === 404) {
      return (
        <div className="m-detail">
          <EtatVide titre={t('commandes.detail.introuvable.titre')} niveau={2}
            action={<Bouton as={Link} to="/commandes">{t('commandes.detail.retour')}</Bouton>}>
            {t('commandes.detail.introuvable.texte')}
          </EtatVide>
        </div>
      );
    }
    return (
      <div className="m-detail">
        {chargement ? <Chargement /> : <MessageErreur erreur={erreur} reessayer={recharger} />}
      </div>
    );
  }

  const devis = commande.devis || [];
  // Bloc « Paiement » : dès que le serveur indique un statut de paiement (rien à montrer pour une commande annulée sans règlement).
  const afficherPaiement = Boolean(commande.statut_paiement) && !(commande.etat === 'annulee' && commande.statut_paiement === 'non_applicable');
  const convenu = commande.montant_convenu !== null && commande.montant_convenu !== undefined;
  const produits = (commande.lignes || []).map((l) => l.produit?.nom).filter(Boolean);
  const references = [...new Set((commande.lignes || []).map((l) => l.produit?.reference).filter(Boolean))];
  const sousTitre = [
    references.join(', '),
    commande.surface_m2 ? surface(commande.surface_m2) : null,
    t(`commandes.types.${commande.type_batiment}`),
  ].filter(Boolean).join(' · ');
  return (
    <article className="m-detail" aria-labelledby="titre-detail">
      <div className="haut">
        <div>
          <span className="m-surtitre">{t('commandes.detail.surtitre', { reference: commande.reference, date: date(commande.cree_le) })}</span>
          <h2 id="titre-detail">{produits.length ? produits.join(', ') : commande.reference}</h2>
          <span className={styles.sousTitre}>{sousTitre}</span>
        </div>
        <div className={styles.etatDetail}>
          <BadgeEtape etat={commande.etat} />
          {commande.action_requise && <span className={styles.attente}>{t('commandes.carte.actionRequise')}</span>}
        </div>
      </div>

      <EtapesCommande commande={commande} />
      <Negociation commande={commande} onDetail={appliquer} onActualiser={actualiser} />
      <ActionsCommande commande={commande} onApres={apresAction} />
      {convenu && (
        <section aria-labelledby="titre-convenu" className={styles.convenu}>
          <h3 id="titre-convenu">{t('commandes.detail.convenu')}</h3>
          <p className={styles.montant}>{fcfa(commande.montant_convenu)}</p>
          {commande.prix_m2_convenu !== null && commande.prix_m2_convenu !== undefined && (
            <p>{t('commandes.negociation.parM2', { montant: fcfa(commande.prix_m2_convenu) })}</p>
          )}
          {commande.delai_convenu_jours ? <p>{t('commandes.negociation.jours', { n: commande.delai_convenu_jours })}</p> : null}
          {commande.signe_le && <p className={styles.meta}>{t('commandes.detail.signeLe', { date: date(commande.signe_le) })}</p>}
        </section>
      )}
      {devis.length > 0 && (
        <section id="devis" aria-labelledby="titre-devis" className={styles.bloc}>
          <h3 id="titre-devis">{t('commandes.detail.devis')}</h3>
          <ul className={styles.liste}>
            {devis.map((d) => <li key={d.id}><ApercuDevis resume={d} /></li>)}
          </ul>
        </section>
      )}
      <Contrat contrat={commande.contrat} />
      {afficherPaiement && <BlocPaiement commande={commande} onActualiser={actualiser} />}
      <LignesCommande lignes={commande.lignes} />
      <section aria-labelledby="titre-chantier" className={styles.bloc}>
        <h3 id="titre-chantier">{t('commandes.detail.chantier')}</h3>
        <p>{ligneAdresse(commande.adresse) || '—'}</p>
        {commande.description && (
          <>
            <h4>{t('commandes.nouvelle.description')}</h4>
            <p className={styles.messageLibre}>{commande.description}</p>
          </>
        )}
      </section>
      <section aria-labelledby="titre-echanger" className={`${styles.echanger} masquer-impression`}>
        <h3 id="titre-echanger">{t('commandes.detail.echanger')}</h3>
        <div className={styles.echanges}>
          <Link to={`/messages?commande=${commande.id}`} className="m-btn plein">
            <Icone nom="message" taille={18} />{t('commandes.detail.ecrire')}
          </Link>
          <BoutonAppel commande={commande.id} />
        </div>
      </section>
    </article>
  );
}
