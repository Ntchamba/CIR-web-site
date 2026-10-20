// BF-10, BF-12 : liste des paiements pour l'équipe. Filtres (état, mode, recherche), pastille « anomalie »,
// détail dans un volet avec revérification auprès de CamPay. Mise à jour en direct (trame `paiement_mis_a_jour`).
import { useState } from 'react';
import { Link } from 'react-router';

import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { depuis, fcfa } from '@partage/utils/format.js';
import usePageMeta from '@partage/utils/usePageMeta.js';

import gestion from '@/composants/Gestion.module.css';
import { TAILLE_PAGE } from '@/composants/useListe.js';
import { useTraduction } from '@/i18n/index.js';

import { ETATS, MODES } from './api.js';
import { PastilleEtatPaiement } from './composants/PastillesPaiement.jsx';
import TiroirPaiement from './composants/TiroirPaiement.jsx';
import styles from './Paiements.module.css';
import usePaiements from './usePaiements.js';

export default function PaiementsPage() {
  const { t } = useTraduction();
  usePageMeta(t('paiements.titre'));
  const {
    elements, total, suivante, precedente, page, chargement, erreur, recharger, remplacer, resume, rechargerResume,
    etat, mode, commande, saisie, changerSaisie, choisirEtat, choisirMode, allerALaPage, effacer, filtre,
  } = usePaiements();
  const [ouvertId, setOuvertId] = useState(null);
  const [ouvertCopie, setOuvertCopie] = useState(null);
  const ouvert = elements.find((p) => p.id === ouvertId) || (ouvertCopie?.id === ouvertId ? ouvertCopie : null);
  const pages = Math.max(1, Math.ceil(total / TAILLE_PAGE));
  const fermer = () => { setOuvertId(null); setOuvertCopie(null); };

  return (
    <div className={styles.page}>
      <div>
        <h1 className="titre-page">{t('paiements.titre')}</h1>
        <p className="sous-titre-page">{t('paiements.sousTitre')}</p>
      </div>

      {(typeof resume.en_attente === 'number' || typeof resume.anomalies === 'number') && (
        <dl className={`carte ${styles.resume}`} aria-label={t('paiements.resume.titre')}>
          <div><dt>{t('paiements.resume.enAttente')}</dt><dd>{Number(resume.en_attente) || 0}</dd></div>
          <div><dt>{t('paiements.resume.anomalies')}</dt><dd>{Number(resume.anomalies) || 0}</dd></div>
          {resume.encaisse_mois != null && (
            <div><dt>{t('paiements.resume.encaisseMois')}</dt><dd>{fcfa(resume.encaisse_mois)}</dd></div>
          )}
        </dl>
      )}

      <form className={`carte ${styles.filtres}`} role="search" aria-label={t('paiements.recherche')}
        onSubmit={(e) => e.preventDefault()}>
        <Champ libelle={t('paiements.rechercher')} name="q" type="search" value={saisie} autoComplete="off"
          onChange={(e) => changerSaisie(e.target.value)} placeholder={t('paiements.exempleRecherche')} />
        <Champ libelle={t('paiements.filtreEtat')} name="etat" value={etat}
          options={[['', t('paiements.tousEtats')], ...ETATS.map((c) => [c, t(`paiements.etats.${c}`)])]}
          onChange={(e) => choisirEtat(e.target.value)} />
        <Champ libelle={t('paiements.filtreMode')} name="mode" value={mode}
          options={[['', t('paiements.tousModes')], ...MODES.map((c) => [c, t(`paiements.modes.${c}`)])]}
          onChange={(e) => choisirMode(e.target.value)} />
        {(filtre || saisie) && <Bouton variante="texte" onClick={effacer}>{t('paiements.effacer')}</Bouton>}
      </form>
      {commande && <p className={gestion.compte}>{t('paiements.filtreCommande', { id: commande })}</p>}

      {chargement ? (
        <Chargement texte={t('paiements.chargement')} />
      ) : erreur ? (
        <MessageErreur erreur={erreur} reessayer={recharger} />
      ) : elements.length === 0 ? (
        <EtatVide titre={filtre ? t('paiements.aucunFiltre') : t('paiements.aucun')}
          action={filtre ? <Bouton variante="contour" onClick={effacer}>{t('paiements.effacer')}</Bouton> : null}>
          {filtre ? t('paiements.aucunFiltreTexte') : t('paiements.aucunTexte')}
        </EtatVide>
      ) : (
        <>
          <p className={gestion.compte} aria-live="polite">{t('paiements.nombre', { n: total })}</p>
          <div className={`carte ${gestion.tableau}`}>
            <table>
              <caption className="visuellement-cache">{t('paiements.legende')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('paiements.colonnes.reference')}</th>
                  <th scope="col">{t('paiements.colonnes.commande')}</th>
                  <th scope="col">{t('paiements.colonnes.client')}</th>
                  <th scope="col">{t('paiements.colonnes.montant')}</th>
                  <th scope="col">{t('paiements.colonnes.mode')}</th>
                  <th scope="col">{t('paiements.colonnes.etat')}</th>
                  <th scope="col">{t('paiements.colonnes.date')}</th>
                </tr>
              </thead>
              <tbody>
                {elements.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <button type="button" className={styles.reference} onClick={() => setOuvertId(p.id)}>{p.reference}</button>
                    </td>
                    <td>
                      {p.commande?.id ? (
                        <Link to={`/commandes/${p.commande.id}`}>{p.commande.reference}</Link>
                      ) : '—'}
                    </td>
                    <td>{p.client?.nom_complet}</td>
                    <td>{fcfa(p.montant)}</td>
                    <td>{t(`paiements.modes.${p.mode}`)}</td>
                    <td><span className={styles.etatCellule}><PastilleEtatPaiement paiement={p} /></span></td>
                    <td>{depuis(p.cree_le)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(precedente || suivante) && (
            <nav className={gestion.pagination} aria-label={t('paiements.pagination')}>
              <Bouton variante="contour" taille="petit" disabled={!precedente} onClick={() => allerALaPage(page - 1)}>
                {t('pagination.precedente')}
              </Bouton>
              <span>{t('pagination.pageSur', { page, pages })}</span>
              <Bouton variante="contour" taille="petit" disabled={!suivante} onClick={() => allerALaPage(page + 1)}>
                {t('pagination.suivante')}
              </Bouton>
            </nav>
          )}
        </>
      )}

      {ouvert && (
        <TiroirPaiement key={ouvert.id} paiement={ouvert} surFermeture={fermer}
          surMiseAJour={(maj) => { remplacer(maj); setOuvertCopie(maj); rechargerResume(); }} />
      )}
    </div>
  );
}
