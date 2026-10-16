// BF-17 : liste des clients avec recherche et filtre par ville. Chaque ligne ouvre la fiche du client.
import { Link, useLocation } from 'react-router';

import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { date } from '@partage/utils/format.js';
import usePageMeta from '@partage/utils/usePageMeta.js';

import PastilleAdresse from './composants/PastilleAdresse.jsx';
import useClients, { TAILLE_PAGE } from './useClients.js';
import { suggestionsVilles } from './villes.js';
import styles from './Clients.module.css';

const nombreClients = (n) => (n === 0 ? 'Aucun client' : n === 1 ? '1 client' : `${n.toLocaleString('fr-FR')} clients`);

export default function ClientsPage() {
  usePageMeta('Clients');
  const { search } = useLocation();
  const {
    clients, total, suivante, precedente, saisie, changerSaisie, effacer, filtre,
    page, allerALaPage, chargement, erreur, recharger,
  } = useClients();
  const pages = Math.max(1, Math.ceil(total / TAILLE_PAGE));

  return (
    <div className={styles.page}>
      <div>
        <h1 className="titre-page">Clients</h1>
        <p className="sous-titre-page">Les comptes créés sur le site public.</p>
      </div>

      <form className={`carte ${styles.filtres}`} role="search" aria-label="Rechercher un client"
        onSubmit={(e) => e.preventDefault()}>
        <Champ libelle="Rechercher" name="q" type="search" value={saisie.recherche}
          onChange={(e) => changerSaisie('recherche', e.target.value)}
          placeholder="Nom, e-mail, téléphone, quartier…" autoComplete="off" />
        <Champ libelle="Ville" name="ville" value={saisie.ville} list="villes-clients"
          onChange={(e) => changerSaisie('ville', e.target.value)} placeholder="Toutes les villes" autoComplete="off" />
        <datalist id="villes-clients">
          {suggestionsVilles(clients).map((v) => <option key={v} value={v} />)}
        </datalist>
        {(filtre || saisie.recherche || saisie.ville) && (
          <Bouton variante="texte" onClick={effacer} className={styles.effacer}>Effacer les filtres</Bouton>
        )}
      </form>

      {chargement ? (
        <Chargement texte="Chargement des clients…" />
      ) : erreur ? (
        <MessageErreur erreur={erreur} reessayer={recharger} />
      ) : clients.length === 0 ? (
        <EtatVide titre={filtre ? 'Aucun client ne correspond à ces critères' : 'Aucun client pour le moment'}
          action={filtre ? <Bouton variante="contour" onClick={effacer}>Effacer les filtres</Bouton> : null}>
          {filtre ? 'Essayez une autre recherche ou une autre ville.' : 'Les comptes créés sur le site apparaîtront ici.'}
        </EtatVide>
      ) : (
        <>
          <p className={styles.compte} aria-live="polite">{nombreClients(total)}</p>
          <div className={`carte ${styles.tableau}`}>
            <table>
              <caption className="visuellement-cache">Liste des clients</caption>
              <thead>
                <tr>
                  <th scope="col">Client</th>
                  <th scope="col">Téléphone</th>
                  <th scope="col">Ville et quartier</th>
                  <th scope="col">Adresse</th>
                  <th scope="col">Inscription</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id} className={c.actif === false ? styles.inactif : ''}>
                    <td>
                      <Link to={`/clients/${c.id}`} state={{ retour: `/clients${search}` }} className={styles.nom}>
                        {c.nom_complet || c.email}
                      </Link>
                      <span className={styles.secondaire}>{c.email}</span>
                      {c.actif === false && <span className={styles.secondaire}>Compte désactivé</span>}
                    </td>
                    <td>{c.telephone || '—'}</td>
                    <td>{[c.ville, c.quartier].filter(Boolean).join(', ') || '—'}</td>
                    <td><PastilleAdresse complete={c.adresse_complete} /></td>
                    <td>{date(c.date_inscription)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(precedente || suivante) && (
            <nav className={styles.pagination} aria-label="Pages de la liste des clients">
              <Bouton variante="contour" taille="petit" disabled={!precedente} onClick={() => allerALaPage(page - 1)}>
                Page précédente
              </Bouton>
              <span>Page {page} sur {pages}</span>
              <Bouton variante="contour" taille="petit" disabled={!suivante} onClick={() => allerALaPage(page + 1)}>
                Page suivante
              </Bouton>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
