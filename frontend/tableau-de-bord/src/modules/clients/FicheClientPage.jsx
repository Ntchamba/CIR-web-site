// BF-17 : fiche d'un client, en lecture seule (coordonnées, adresse de livraison, activité du compte).
import { Link, useLocation, useParams } from 'react-router';

import Bouton from '@partage/ui/Bouton.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import Icone from '@partage/ui/Icone.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { date, dateHeure } from '@partage/utils/format.js';
import usePageMeta from '@partage/utils/usePageMeta.js';

import { infosLangue } from '@partage/i18n/langues.js';

import { useTraduction } from '@/i18n/index.js';

import PastilleAdresse from './composants/PastilleAdresse.jsx';
import { useFicheClient } from './useClients.js';
import styles from './Clients.module.css';

function Info({ libelle, children }) {
  return (
    <div className={styles.info}>
      <dt>{libelle}</dt>
      <dd>{children || '—'}</dd>
    </div>
  );
}

export default function FicheClientPage() {
  const { t } = useTraduction();
  const { id } = useParams();
  const { state } = useLocation();
  const retour = typeof state?.retour === 'string' && state.retour.startsWith('/clients') ? state.retour : '/clients';
  const { client, chargement, erreur, recharger } = useFicheClient(id);
  usePageMeta(client?.nom_complet || t('fiche.meta'));

  const lienRetour = (
    <Link to={retour} className={styles.retour}>
      <Icone nom="retour" taille={18} /> {t('fiche.retour')}
    </Link>
  );

  if (chargement) return <Chargement texte={t('fiche.chargement')} />;
  if (erreur?.statut === 404) {
    return (
      <EtatVide titre={t('fiche.introuvable')} niveau={1}
        action={<Bouton as={Link} to="/clients" variante="contour">{t('fiche.retour')}</Bouton>}>
        {t('fiche.introuvableTexte')}
      </EtatVide>
    );
  }
  if (erreur) return <div className={styles.page}>{lienRetour}<MessageErreur erreur={erreur} reessayer={recharger} /></div>;

  return (
    <div className={styles.page}>
      {lienRetour}
      <div className={styles.enteteFiche}>
        <h1 className="titre-page">{client.nom_complet || client.email}</h1>
        <div className={styles.pastilles}>
          <PastilleAdresse complete={client.adresse_complete} />
          {client.actif === false && <span className={`${styles.pastille} ${styles.neutre}`}>{t('clients.compteDesactive')}</span>}
        </div>
      </div>

      <div className={styles.cartes}>
        <section className="carte" aria-labelledby="titre-coordonnees">
          <h2 id="titre-coordonnees" className={styles.titreCarte}>{t('fiche.coordonnees')}</h2>
          <dl className={styles.infos}>
            <Info libelle={t('fiche.email')}>{client.email && <a href={`mailto:${client.email}`}>{client.email}</a>}</Info>
            <Info libelle={t('fiche.telephone')}>{client.telephone && <a href={`tel:${client.telephone.replace(/\s+/g, '')}`}>{client.telephone}</a>}</Info>
          </dl>
        </section>

        <section className="carte" aria-labelledby="titre-adresse">
          <h2 id="titre-adresse" className={styles.titreCarte}>{t('fiche.adresse')}</h2>
          <dl className={styles.infos}>
            <Info libelle={t('fiche.ville')}>{client.ville}</Info>
            <Info libelle={t('fiche.quartier')}>{client.quartier}</Info>
            <Info libelle={t('fiche.rueOuRepere')}>{client.rue_ou_repere}</Info>
          </dl>
          {!client.adresse_complete && (
            <p className={styles.note}>{t('fiche.adresseACompleter')}</p>
          )}
        </section>

        <section className="carte" aria-labelledby="titre-compte">
          <h2 id="titre-compte" className={styles.titreCarte}>{t('fiche.compte')}</h2>
          <dl className={styles.infos}>
            <Info libelle={t('fiche.inscritLe')}>{client.date_inscription && date(client.date_inscription)}</Info>
            <Info libelle={t('fiche.derniereConnexion')}>
              {client.derniere_connexion ? dateHeure(client.derniere_connexion) : t('fiche.jamais')}
            </Info>
            <Info libelle={t('fiche.statut')}>{client.actif === false ? t('fiche.desactive') : t('fiche.actif')}</Info>
            <Info libelle={t('fiche.langue')}>{client.langue && infosLangue(client.langue).nom}</Info>
          </dl>
        </section>
      </div>
      <p className={styles.note}>{t('fiche.aVenir')}</p>
    </div>
  );
}
