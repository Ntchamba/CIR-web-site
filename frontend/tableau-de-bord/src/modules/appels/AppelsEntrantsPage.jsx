// BF-11 : appels des clients côté équipe : historique filtrable, appels manqués en tête avec « Rappeler » et « Écrire »,
// jauge d'utilisation JaaS, activation de la sonnerie, message clair si Jitsi n'est pas configuré.
import { Link } from 'react-router';

import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { dateHeure } from '@partage/utils/format.js';
import usePageMeta from '@partage/utils/usePageMeta.js';

import LiensContact from '@/composants/LiensContact.jsx';
import PastilleEtat from '@/composants/PastilleEtat.jsx';
import gestion from '@/composants/Gestion.module.css';
import { TAILLE_PAGE } from '@/composants/useListe.js';
import { useTraduction } from '@/i18n/index.js';

import JaugeUsage from './composants/JaugeUsage.jsx';
import { activerSonnerie, desactiverSonnerie, useSonnerie } from './sonnerie.js';
import useAppels, { ETATS } from './useAppels.js';
import styles from './Appels.module.css';

const TONS = { sonne: 'attention', en_cours: 'info', termine: 'ok', manque: 'alerte', refuse: 'neutre', annule: 'neutre' };

/** « 3 min 05 s » à partir d'un nombre de secondes ; « — » si absent. */
export function dureeTexte(secondes, t) {
  if (secondes == null || Number.isNaN(Number(secondes))) return '—';
  const total = Math.max(0, Math.round(Number(secondes)));
  const minutes = Math.floor(total / 60);
  const reste = total % 60;
  return minutes > 0 ? t('appels.duree.minutes', { m: minutes, s: String(reste).padStart(2, '0') }) : t('appels.duree.secondes', { s: reste });
}

/** Lien « Écrire » : celui du serveur s'il est interne, sinon l'ouverture de la messagerie sur ce client. */
function lienEcrire(appel) {
  const lien = appel.rappel?.lien_messagerie;
  if (typeof lien === 'string' && lien.startsWith('/') && !lien.startsWith('//')) return lien;
  return `/messagerie?client=${appel.client?.id}`;
}

export default function AppelsEntrantsPage() {
  const { t } = useTraduction();
  usePageMeta(t('appels.titre'));
  const sonnerie = useSonnerie();
  const {
    elements, total, suivante, precedente, page, chargement, erreur, recharger, usage,
    etat, saisie, changerSaisie, choisirEtat, allerALaPage, effacer, filtre,
  } = useAppels();
  const pages = Math.max(1, Math.ceil(total / TAILLE_PAGE));
  const nonConfigure = [erreur, usage.erreur].some((e) => e?.donnees?.code === 'appels_non_configures')
    || usage.donnees?.configure === false;

  return (
    <div className={styles.page}>
      <div>
        <h1 className="titre-page">{t('appels.titre')}</h1>
        <p className="sous-titre-page">{t('appels.sousTitre')}</p>
      </div>

      {nonConfigure && (
        <div className={styles.nonConfigure} role="alert">
          <strong>{t('appels.nonConfigureTitre')}</strong>
          <span>{t('appels.nonConfigure')}</span>
        </div>
      )}

      <div className={styles.haut}>
        <JaugeUsage usage={usage} />
        {sonnerie.disponible && (
          <section className={`carte ${styles.reglageSonnerie}`} aria-labelledby="sonnerie-titre">
            <h2 id="sonnerie-titre" className={styles.titreCarte}>{t('appels.sonnerie.titre')}</h2>
            <p>{sonnerie.active ? t('appels.sonnerie.active') : t('appels.sonnerie.aide')}</p>
            {sonnerie.active
              ? <Bouton variante="contour" onClick={desactiverSonnerie}>{t('appels.sonnerie.desactiver')}</Bouton>
              : <Bouton onClick={activerSonnerie}>{t('appels.sonnerie.activer')}</Bouton>}
          </section>
        )}
      </div>

      <form className={`carte ${gestion.filtres}`} role="search" aria-label={t('appels.recherche')}
        onSubmit={(e) => e.preventDefault()}>
        <Champ libelle={t('appels.rechercher')} name="q" type="search" value={saisie} autoComplete="off"
          onChange={(e) => changerSaisie(e.target.value)} />
        <Champ libelle={t('appels.etat')} name="etat" value={etat}
          options={[['', t('appels.tousEtats')], ...ETATS.map((c) => [c, t(`appels.etats.${c}`)])]}
          onChange={(e) => choisirEtat(e.target.value)} />
        {(filtre || saisie) && <Bouton variante="texte" onClick={effacer}>{t('appels.effacer')}</Bouton>}
      </form>

      {chargement && elements.length === 0 ? (
        <Chargement texte={t('appels.chargement')} />
      ) : erreur && !nonConfigure ? (
        <MessageErreur erreur={erreur} reessayer={recharger} />
      ) : elements.length === 0 ? (
        <EtatVide titre={filtre ? t('appels.aucunFiltre') : t('appels.aucun')}
          action={filtre ? <Bouton variante="contour" onClick={effacer}>{t('appels.effacer')}</Bouton> : null}>
          {filtre ? t('appels.aucunFiltreTexte') : t('appels.aucunTexte')}
        </EtatVide>
      ) : (
        <>
          <p className={gestion.compte} aria-live="polite">{t('appels.nombre', { n: total })}</p>
          <div className={`carte ${gestion.tableau}`}>
            <table>
              <caption className="visuellement-cache">{t('appels.legende')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('appels.colonnes.appel')}</th>
                  <th scope="col">{t('appels.colonnes.client')}</th>
                  <th scope="col">{t('appels.colonnes.etat')}</th>
                  <th scope="col">{t('appels.colonnes.date')}</th>
                  <th scope="col">{t('appels.colonnes.duree')}</th>
                  <th scope="col"><span className="visuellement-cache">{t('appels.colonnes.actions')}</span></th>
                </tr>
              </thead>
              <tbody>
                {elements.map((a) => (
                  <tr key={a.id} className={a.etat === 'manque' ? styles.manque : undefined}>
                    <td>
                      <strong>{a.reference}</strong>
                      <span className={gestion.secondaire}>
                        {t(`appels.types.${a.type}`)}{a.commande?.reference ? ` · ${a.commande.reference}` : ''}
                      </span>
                    </td>
                    <td>
                      <Link to={`/clients/${a.client?.id}`}><strong>{a.client?.nom_complet}</strong></Link>
                      <LiensContact telephone={a.client?.telephone} />
                    </td>
                    <td>
                      <PastilleEtat ton={TONS[a.etat] || 'neutre'}>{t(`appels.etats.${a.etat}`)}</PastilleEtat>
                      {a.repondu_par?.nom_complet && (
                        <span className={gestion.secondaire}>{t('appels.reponduPar', { nom: a.repondu_par.nom_complet })}</span>
                      )}
                    </td>
                    <td>{dateHeure(a.cree_le)}</td>
                    <td>{dureeTexte(a.duree_secondes, t)}</td>
                    <td className={gestion.actions}>
                      {a.rappel && (
                        <span className={styles.actionsAppel}>
                          {(a.rappel.telephone || a.client?.telephone) && (
                            <Bouton as="a" variante="contour" taille="petit"
                              href={`tel:${String(a.rappel.telephone || a.client.telephone).replace(/[^\d+]/g, '')}`}
                              aria-label={t('appels.rappelerNom', { nom: a.client?.nom_complet || '' })}>
                              {t('appels.rappeler')}
                            </Bouton>
                          )}
                          <Bouton as={Link} to={lienEcrire(a)} variante="contour" taille="petit"
                            aria-label={t('appels.ecrireNom', { nom: a.client?.nom_complet || '' })}>
                            {t('appels.ecrire')}
                          </Bouton>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(precedente || suivante) && (
            <nav className={gestion.pagination} aria-label={t('appels.pagination')}>
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
    </div>
  );
}
