// BF-17 : liste des clients avec recherche et filtre par ville. Chaque ligne ouvre la fiche du client.
import { Link, useLocation } from 'react-router';

import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { date } from '@partage/utils/format.js';
import usePageMeta from '@partage/utils/usePageMeta.js';

import { useTraduction } from '@/i18n/index.js';

import PastilleAdresse from './composants/PastilleAdresse.jsx';
import useClients, { TAILLE_PAGE } from './useClients.js';
import { suggestionsVilles } from './villes.js';
import styles from './Clients.module.css';

export default function ClientsPage() {
  const { t } = useTraduction();
  usePageMeta(t('clients.titre'));
  const { search } = useLocation();
  const {
    clients, total, suivante, precedente, saisie, changerSaisie, effacer, filtre,
    page, allerALaPage, chargement, erreur, recharger,
  } = useClients();
  const pages = Math.max(1, Math.ceil(total / TAILLE_PAGE));

  return (
    <div className={styles.page}>
      <div>
        <h1 className="titre-page">{t('clients.titre')}</h1>
        <p className="sous-titre-page">{t('clients.sousTitre')}</p>
      </div>

      <form className={`carte ${styles.filtres}`} role="search" aria-label={t('clients.recherche')}
        onSubmit={(e) => e.preventDefault()}>
        <Champ libelle={t('clients.rechercher')} name="q" type="search" value={saisie.recherche}
          onChange={(e) => changerSaisie('recherche', e.target.value)}
          placeholder={t('clients.exempleRecherche')} autoComplete="off" />
        <Champ libelle={t('clients.ville')} name="ville" value={saisie.ville} list="villes-clients"
          onChange={(e) => changerSaisie('ville', e.target.value)} placeholder={t('clients.toutesVilles')} autoComplete="off" />
        <datalist id="villes-clients">
          {suggestionsVilles(clients).map((v) => <option key={v} value={v} />)}
        </datalist>
        {(filtre || saisie.recherche || saisie.ville) && (
          <Bouton variante="texte" onClick={effacer} className={styles.effacer}>{t('clients.effacer')}</Bouton>
        )}
      </form>

      {chargement ? (
        <Chargement texte={t('clients.chargement')} />
      ) : erreur ? (
        <MessageErreur erreur={erreur} reessayer={recharger} />
      ) : clients.length === 0 ? (
        <EtatVide titre={filtre ? t('clients.aucunFiltre') : t('clients.aucun')}
          action={filtre ? <Bouton variante="contour" onClick={effacer}>{t('clients.effacer')}</Bouton> : null}>
          {filtre ? t('clients.aucunFiltreTexte') : t('clients.aucunTexte')}
        </EtatVide>
      ) : (
        <>
          <p className={styles.compte} aria-live="polite">{t('clients.nombre', { n: total })}</p>
          <div className={`carte ${styles.tableau}`}>
            <table>
              <caption className="visuellement-cache">{t('clients.legende')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('clients.colonnes.client')}</th>
                  <th scope="col">{t('clients.colonnes.telephone')}</th>
                  <th scope="col">{t('clients.colonnes.villeQuartier')}</th>
                  <th scope="col">{t('clients.colonnes.adresse')}</th>
                  <th scope="col">{t('clients.colonnes.inscription')}</th>
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
                      {c.actif === false && <span className={styles.secondaire}>{t('clients.compteDesactive')}</span>}
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
            <nav className={styles.pagination} aria-label={t('clients.pagination')}>
              <Bouton variante="contour" taille="petit" disabled={!precedente} onClick={() => allerALaPage(page - 1)}>
                {t('clients.precedente')}
              </Bouton>
              <span>{t('clients.pageSur', { page, pages })}</span>
              <Bouton variante="contour" taille="petit" disabled={!suivante} onClick={() => allerALaPage(page + 1)}>
                {t('clients.suivante')}
              </Bouton>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
