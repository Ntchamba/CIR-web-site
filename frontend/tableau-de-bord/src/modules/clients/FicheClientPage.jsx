// BF-17 : fiche d'un client, en lecture seule (coordonnées, adresse de livraison, activité du compte).
import { Link, useLocation, useParams } from 'react-router';

import Bouton from '@partage/ui/Bouton.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import Icone from '@partage/ui/Icone.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { date, dateHeure } from '@partage/utils/format.js';
import usePageMeta from '@partage/utils/usePageMeta.js';

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
  const { id } = useParams();
  const { state } = useLocation();
  const retour = typeof state?.retour === 'string' && state.retour.startsWith('/clients') ? state.retour : '/clients';
  const { client, chargement, erreur, recharger } = useFicheClient(id);
  usePageMeta(client?.nom_complet || 'Fiche client');

  const lienRetour = (
    <Link to={retour} className={styles.retour}>
      <Icone nom="retour" taille={18} /> Retour à la liste des clients
    </Link>
  );

  if (chargement) return <Chargement texte="Chargement de la fiche…" />;
  if (erreur?.statut === 404) {
    return (
      <EtatVide titre="Client introuvable" niveau={1}
        action={<Bouton as={Link} to="/clients" variante="contour">Retour à la liste des clients</Bouton>}>
        Ce compte n'existe pas ou n'est pas un compte client.
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
          {client.actif === false && <span className={`${styles.pastille} ${styles.neutre}`}>Compte désactivé</span>}
        </div>
      </div>

      <div className={styles.cartes}>
        <section className="carte" aria-labelledby="titre-coordonnees">
          <h2 id="titre-coordonnees" className={styles.titreCarte}>Coordonnées</h2>
          <dl className={styles.infos}>
            <Info libelle="E-mail">{client.email && <a href={`mailto:${client.email}`}>{client.email}</a>}</Info>
            <Info libelle="Téléphone">{client.telephone && <a href={`tel:${client.telephone.replace(/\s+/g, '')}`}>{client.telephone}</a>}</Info>
          </dl>
        </section>

        <section className="carte" aria-labelledby="titre-adresse">
          <h2 id="titre-adresse" className={styles.titreCarte}>Adresse</h2>
          <dl className={styles.infos}>
            <Info libelle="Ville">{client.ville}</Info>
            <Info libelle="Quartier">{client.quartier}</Info>
            <Info libelle="Rue ou repère">{client.rue_ou_repere}</Info>
          </dl>
          {!client.adresse_complete && (
            <p className={styles.note}>Le client devra compléter son adresse avant de pouvoir commander.</p>
          )}
        </section>

        <section className="carte" aria-labelledby="titre-compte">
          <h2 id="titre-compte" className={styles.titreCarte}>Compte</h2>
          <dl className={styles.infos}>
            <Info libelle="Inscrit le">{client.date_inscription && date(client.date_inscription)}</Info>
            <Info libelle="Dernière connexion">
              {client.derniere_connexion ? dateHeure(client.derniere_connexion) : 'Jamais'}
            </Info>
            <Info libelle="Statut">{client.actif === false ? 'Désactivé' : 'Actif'}</Info>
          </dl>
        </section>
      </div>
      <p className={styles.note}>Les commandes et les échanges de ce client apparaîtront ici dans une prochaine version.</p>
    </div>
  );
}
