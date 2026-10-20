// BF-10, BF-12, BF-13 : détail d'une commande (/commandes/:id). Étapes, produits, actions autorisées par le
// serveur, négociation, devis envoyés et contrat.
import { Link, useParams } from 'react-router';

import Bouton from '@partage/ui/Bouton.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import Icone from '@partage/ui/Icone.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { date, fcfa, surface } from '@partage/utils/format.js';
import usePageMeta from '@partage/utils/usePageMeta.js';

import { useTraduction } from '@/i18n/index.js';
import BoutonAppel from '@/modules/appels/composants/BoutonAppel.jsx';
import ApercuDevis from '@/modules/devis/composants/ApercuDevis.jsx';

import ActionsCommande from './composants/ActionsCommande.jsx';
import BadgeEtape from './composants/BadgeEtape.jsx';
import Contrat from './composants/Contrat.jsx';
import EtapesCommande from './composants/EtapesCommande.jsx';
import LignesCommande from './composants/LignesCommande.jsx';
import Negociation from './composants/Negociation.jsx';
import { useCommande } from './useCommandes.js';
import styles from './Commandes.module.css';

const ligneAdresse = (a) => [a?.rue_ou_repere, a?.quartier, a?.ville].filter(Boolean).join(', ');

export default function DetailCommande() {
  const { id } = useParams();
  const { t } = useTraduction();
  const { commande, chargement, erreur, recharger, appliquer, actualiser, apresAction } = useCommande(id);
  usePageMeta(commande ? t('commandes.detail.meta', { reference: commande.reference }) : t('commandes.titre'));

  const retour = (
    <Link to="/commandes" className={styles.retour}><Icone nom="retour" taille={18} />{t('commandes.detail.retour')}</Link>
  );

  if (!commande) {
    if (erreur?.statut === 404) {
      return (
        <div className="conteneur section">
          <EtatVide titre={t('commandes.detail.introuvable.titre')} niveau={1}
            action={<Bouton as={Link} to="/commandes">{t('commandes.detail.retour')}</Bouton>}>
            {t('commandes.detail.introuvable.texte')}
          </EtatVide>
        </div>
      );
    }
    return (
      <div className="conteneur section">
        {retour}
        {chargement ? <Chargement plein /> : <MessageErreur erreur={erreur} reessayer={recharger} />}
      </div>
    );
  }

  const devis = commande.devis || [];
  const convenu = commande.montant_convenu !== null && commande.montant_convenu !== undefined;
  return (
    <div className={`conteneur section ${styles.page}`}>
      <div className="masquer-impression">{retour}</div>
      <header className={styles.enteteDetail}>
        <div>
          <h1 className="titre-page">{commande.reference}</h1>
          <p className={styles.meta}>
            {t(`commandes.types.${commande.type_batiment}`)}
            {commande.surface_m2 ? ` · ${surface(commande.surface_m2)}` : ''}
            {' · '}{t('commandes.detail.creeLe', { date: date(commande.cree_le) })}
          </p>
        </div>
        <div className={styles.etatDetail}>
          <BadgeEtape etat={commande.etat} />
          {commande.action_requise && <span className={styles.attente}>{t('commandes.carte.actionRequise')}</span>}
        </div>
      </header>

      <div className={styles.grilleDetail}>
        <div className={styles.colonne}>
          <EtapesCommande commande={commande} />
          <ActionsCommande commande={commande} onApres={apresAction} />
          <Negociation commande={commande} onDetail={appliquer} onActualiser={actualiser} />
          {devis.length > 0 && (
            <section id="devis" aria-labelledby="titre-devis" className={styles.bloc}>
              <h2 id="titre-devis">{t('commandes.detail.devis')}</h2>
              <ul className={styles.liste}>
                {devis.map((d) => <li key={d.id}><ApercuDevis resume={d} /></li>)}
              </ul>
            </section>
          )}
          <Contrat contrat={commande.contrat} />
        </div>

        <aside className={styles.colonne} aria-label={t('commandes.detail.infos')}>
          <section aria-labelledby="titre-echanger" className={`${styles.bloc} masquer-impression`}>
            <h2 id="titre-echanger">{t('commandes.detail.echanger')}</h2>
            <div className={styles.echanges}>
              <Bouton as={Link} to={`/messages?commande=${commande.id}`} variante="contour">
                <Icone nom="message" taille={18} />&nbsp;{t('commandes.detail.ecrire')}
              </Bouton>
              <BoutonAppel commande={commande.id} />
            </div>
          </section>
          {convenu && (
            <section aria-labelledby="titre-convenu" className={`${styles.bloc} ${styles.convenu}`}>
              <h2 id="titre-convenu">{t('commandes.detail.convenu')}</h2>
              <p className={styles.montant}>{fcfa(commande.montant_convenu)}</p>
              {commande.prix_m2_convenu !== null && commande.prix_m2_convenu !== undefined && (
                <p>{t('commandes.negociation.parM2', { montant: fcfa(commande.prix_m2_convenu) })}</p>
              )}
              {commande.delai_convenu_jours ? <p>{t('commandes.negociation.jours', { n: commande.delai_convenu_jours })}</p> : null}
              {commande.signe_le && <p className={styles.meta}>{t('commandes.detail.signeLe', { date: date(commande.signe_le) })}</p>}
            </section>
          )}
          <LignesCommande lignes={commande.lignes} />
          <section aria-labelledby="titre-chantier" className={styles.bloc}>
            <h2 id="titre-chantier">{t('commandes.detail.chantier')}</h2>
            <p>{ligneAdresse(commande.adresse) || '—'}</p>
            {commande.description && (
              <>
                <h3>{t('commandes.nouvelle.description')}</h3>
                <p className={styles.messageLibre}>{commande.description}</p>
              </>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
