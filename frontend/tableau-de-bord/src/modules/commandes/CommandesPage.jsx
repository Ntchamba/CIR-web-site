// BF-10, BF-12 : liste des commandes pour l'équipe. Onglets par étape (avec leurs nombres), recherche,
// filtre « action requise », tableau paginé. Chaque ligne ouvre le détail.
import { Link, useLocation } from 'react-router';

import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { depuis, fcfa, STATUTS, surface } from '@partage/utils/format.js';
import usePageMeta from '@partage/utils/usePageMeta.js';

import LiensContact from '@/composants/LiensContact.jsx';
import Onglets from '@/composants/Onglets.jsx';
import { PastilleEtape, PastilleUrgente } from '@/composants/PastilleEtat.jsx';
import { TAILLE_PAGE } from '@/composants/useListe.js';
import gestion from '@/composants/Gestion.module.css';
import { useTraduction } from '@/i18n/index.js';

import useCommandes, { ONGLETS } from './useCommandes.js';
import styles from './Commandes.module.css';

export default function CommandesPage() {
  const { t } = useTraduction();
  usePageMeta(t('commandes.titre'));
  const { search } = useLocation();
  const {
    elements, total, suivante, precedente, page, chargement, erreur, recharger, etat, action, resume, client,
    saisie, changerSaisie, choisirEtat, basculerAction, allerALaPage, effacer, filtre,
  } = useCommandes();
  const pages = Math.max(1, Math.ceil(total / TAILLE_PAGE));

  const onglets = [
    { cle: 'toutes', libelle: t('commandes.toutes'), nombre: resume.total },
    ...ONGLETS.map((cle) => ({ cle, libelle: STATUTS[cle].libelle, nombre: resume[cle] })),
  ];

  return (
    <div className={styles.page}>
      <div>
        <h1 className="titre-page">{t('commandes.titre')}</h1>
        <p className="sous-titre-page">{t('commandes.sousTitre')}</p>
      </div>

      <Onglets libelle={t('commandes.onglets')} idBase="commandes" onglets={onglets}
        actif={etat || 'toutes'} surChoix={(cle) => choisirEtat(cle === 'toutes' ? '' : cle)}>
        <form className={`carte ${styles.filtres}`} role="search" aria-label={t('commandes.recherche')}
          onSubmit={(e) => e.preventDefault()}>
          <Champ libelle={t('commandes.rechercher')} name="q" type="search" value={saisie} autoComplete="off"
            onChange={(e) => changerSaisie(e.target.value)} placeholder={t('commandes.exempleRecherche')} />
          <label className={styles.caseAction}>
            <input type="checkbox" name="action" checked={action} onChange={(e) => basculerAction(e.target.checked)} />
            {t('commandes.actionRequise')}
            {typeof resume.action_requise === 'number' && ` (${resume.action_requise})`}
          </label>
          {(filtre || saisie) && <Bouton variante="texte" onClick={effacer}>{t('commandes.effacer')}</Bouton>}
        </form>
        {client && <p className={gestion.compte}>{t('commandes.filtreClient', { id: client })}</p>}

        {chargement ? (
          <Chargement texte={t('commandes.chargement')} />
        ) : erreur ? (
          <MessageErreur erreur={erreur} reessayer={recharger} />
        ) : elements.length === 0 ? (
          <EtatVide titre={filtre ? t('commandes.aucunFiltre') : t('commandes.aucune')}
            action={filtre ? <Bouton variante="contour" onClick={effacer}>{t('commandes.effacer')}</Bouton> : null}>
            {filtre ? t('commandes.aucunFiltreTexte') : t('commandes.aucuneTexte')}
          </EtatVide>
        ) : (
          <>
            <p className={gestion.compte} aria-live="polite">{t('commandes.nombre', { n: total })}</p>
            <div className={`carte ${gestion.tableau}`}>
              <table>
                <caption className="visuellement-cache">{t('commandes.legende')}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t('commandes.colonnes.reference')}</th>
                    <th scope="col">{t('commandes.colonnes.client')}</th>
                    <th scope="col">{t('commandes.colonnes.type')}</th>
                    <th scope="col">{t('commandes.colonnes.surface')}</th>
                    <th scope="col">{t('commandes.colonnes.montant')}</th>
                    <th scope="col">{t('commandes.colonnes.etape')}</th>
                    <th scope="col">{t('commandes.colonnes.activite')}</th>
                  </tr>
                </thead>
                <tbody>
                  {elements.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link to={`/commandes/${c.id}`} state={{ retour: `/commandes${search}` }} className={styles.reference}>
                          {c.reference}
                        </Link>
                        <span className={gestion.secondaire}>{t('commandes.lignes', { n: c.nombre_lignes ?? 0 })}</span>
                      </td>
                      <td>
                        <strong>{c.client?.nom_complet}</strong>
                        {c.client?.ville && <span className={gestion.secondaire}>{c.client.ville}</span>}
                        <LiensContact email={c.client?.email} telephone={c.client?.telephone} />
                      </td>
                      <td>{t(`commandes.types.${c.type_batiment}`)}</td>
                      <td>{surface(c.surface_m2)}</td>
                      <td>{fcfa(c.montant_convenu)}</td>
                      <td>
                        <span className={styles.etapeCellule}>
                          <PastilleEtape etat={c.etat} />
                          {c.action_requise && <PastilleUrgente>{t('commandes.actionRequiseCourt')}</PastilleUrgente>}
                        </span>
                      </td>
                      <td>{depuis(c.modifie_le)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(precedente || suivante) && (
              <nav className={gestion.pagination} aria-label={t('commandes.pagination')}>
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
      </Onglets>
    </div>
  );
}
