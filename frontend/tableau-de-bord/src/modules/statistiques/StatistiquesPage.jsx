// BF-16 : statistiques de l'équipe. Période au choix, cartes d'indicateurs, « À traiter » avec liens, évolution mensuelle
// (graphique SVG + tableau pour les lecteurs d'écran), répartition par étape et par type de bâtiment, produits les plus commandés.
// Un membre simple ne voit aucune somme : le serveur n'envoie pas `montants`, les cartes d'argent n'existent pas.
import { useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { date, fcfa, STATUTS } from '@partage/utils/format.js';
import usePageMeta from '@partage/utils/usePageMeta.js';

import { useTraduction } from '@/i18n/index.js';

import ATraiter from './composants/ATraiter.jsx';
import CartesIndicateurs from './composants/CartesIndicateurs.jsx';
import GraphiqueMois from './composants/GraphiqueMois.jsx';
import Repartition from './composants/Repartition.jsx';
import { erreurPeriode, PERIODES } from './periode.js';
import styles from './Statistiques.module.css';
import useStatistiques from './useStatistiques.js';

const ETAPES = ['nouvelle', 'negociation', 'contrat_signe', 'travaux', 'terminee', 'annulee'];
const TYPES = ['maison', 'industrie', 'entreprise'];

function SelecteurPeriode({ choix, periode, erreurDates, choisir, appliquerDates }) {
  const { t } = useTraduction();
  const [du, setDu] = useState(periode.du);
  const [au, setAu] = useState(periode.au);
  const [essai, setEssai] = useState(false);
  const erreurSaisie = essai ? erreurPeriode({ du, au }) : null;
  const erreur = erreurSaisie || (choix === 'libre' ? erreurDates : null);

  function appliquer(e) {
    e.preventDefault();
    setEssai(true);
    if (!erreurPeriode({ du, au })) appliquerDates(du, au);
  }

  return (
    <div className={`carte ${styles.periode}`}>
      <div role="group" aria-label={t('statistiques.periode.nom')} className={styles.choixPeriode}>
        {PERIODES.map((p) => (
          <button key={p} type="button" aria-pressed={choix === p}
            className={`${styles.choix} ${choix === p ? styles.choixActif : ''}`} onClick={() => choisir(p)}>
            {t(`statistiques.periode.${p}`)}
          </button>
        ))}
      </div>
      {choix === 'libre' && (
        <form className={styles.datesLibres} onSubmit={appliquer} noValidate aria-label={t('statistiques.periode.libre')}>
          <Champ libelle={t('statistiques.periode.du')} name="du" type="date" value={du}
            onChange={(e) => setDu(e.target.value)} />
          <Champ libelle={t('statistiques.periode.au')} name="au" type="date" value={au}
            onChange={(e) => setAu(e.target.value)} />
          <Bouton type="submit" variante="contour">{t('statistiques.periode.appliquer')}</Bouton>
        </form>
      )}
      {erreur && <p className={styles.erreurPeriode} role="alert">{t(`statistiques.erreursPeriode.${erreur}`)}</p>}
    </div>
  );
}

export default function StatistiquesPage() {
  const { t } = useTraduction();
  usePageMeta(t('statistiques.titre'));
  const s = useStatistiques();
  const { resume, evolution } = s;
  const volumes = (evolution || []).some((m) => Number(m.commandes) > 0 || Number(m.signees) > 0);
  // Les sommes mensuelles n'existent que pour le super-administrateur (null pour un membre simple).
  const avecArgent = (evolution || []).some((m) => m.encaisse !== null && m.encaisse !== undefined);

  return (
    <div className={styles.page}>
      <div>
        <h1 className="titre-page">{t('statistiques.titre')}</h1>
        <p className="sous-titre-page">{t('statistiques.sousTitre')}</p>
      </div>

      <SelecteurPeriode key={`${s.choix}|${s.periode.du}|${s.periode.au}`} choix={s.choix} periode={s.periode}
        erreurDates={s.erreurDates} choisir={s.choisir} appliquerDates={s.appliquerDates} />

      {s.chargement ? (
        <Chargement texte={t('statistiques.chargement')} />
      ) : s.erreur ? (
        <MessageErreur erreur={s.erreur} reessayer={s.recharger} />
      ) : resume ? (
        <>
          <p className={styles.intervalle} aria-live="polite">
            {t('statistiques.periode.intervalle', { du: date(resume.periode?.du || s.periode.du), au: date(resume.periode?.au || s.periode.au) })}
          </p>
          <CartesIndicateurs resume={resume} titre={t('statistiques.cartes.titre')} />
          {Number(resume.commandes?.total) === 0 && (
            <EtatVide titre={t('statistiques.vide')} niveau={2}>{t('statistiques.videTexte')}</EtatVide>
          )}
        </>
      ) : null}

      {resume && (
        <ATraiter donnees={resume.a_traiter} idTitre="stat-a-traiter" titre={t('statistiques.aTraiter.titre')} />
      )}

      <section className={`carte ${styles.bloc}`} aria-labelledby="stat-evolution">
        <h2 id="stat-evolution" className={styles.titreBloc}>{t('statistiques.evolution.titre')}</h2>
        {s.chargementEvolution && !evolution ? (
          <Chargement texte={t('statistiques.chargement')} />
        ) : s.erreurEvolution ? (
          <MessageErreur erreur={s.erreurEvolution} reessayer={s.recharger} />
        ) : !evolution || !volumes ? (
          <p className={styles.vide}>{t('statistiques.evolution.vide')}</p>
        ) : (
          <div className={styles.graphiques}>
            <GraphiqueMois titre={t('statistiques.evolution.volumes')} description={t('statistiques.evolution.descriptionVolumes')}
              mois={evolution}
              series={[
                { cle: 'commandes', libelle: t('statistiques.evolution.commandes'), classe: 'serieBleue' },
                { cle: 'signees', libelle: t('statistiques.evolution.signees'), classe: 'serieCorail' },
              ]} />
            {avecArgent && (
              <GraphiqueMois titre={t('statistiques.evolution.argent')} description={t('statistiques.evolution.descriptionArgent')}
                mois={evolution}
                series={[{ cle: 'encaisse', libelle: t('statistiques.evolution.encaisse'), classe: 'serieEncre', format: fcfa }]} />
            )}
          </div>
        )}
      </section>

      {resume && Number(resume.commandes?.total) > 0 && (
        <div className={styles.deuxColonnes}>
          <Repartition idTitre="stat-etapes" titre={t('statistiques.repartition.etapes')}
            lignes={ETAPES.map((cle) => ({ cle, libelle: STATUTS[cle].libelle, valeur: Number(resume.commandes.par_etape?.[cle]) || 0 }))} />
          <Repartition idTitre="stat-types" titre={t('statistiques.repartition.types')}
            lignes={TYPES.map((cle) => ({ cle, libelle: t(`commandes.types.${cle}`), valeur: Number(resume.commandes.par_type_batiment?.[cle]) || 0 }))} />
        </div>
      )}

      {resume && (
        <section className={`carte ${styles.bloc}`} aria-labelledby="stat-top">
          <h2 id="stat-top" className={styles.titreBloc}>{t('statistiques.top.titre')}</h2>
          {(resume.top_produits || []).length === 0 ? (
            <p className={styles.vide}>{t('statistiques.top.aucun')}</p>
          ) : (
            <ol className={styles.top}>
              {resume.top_produits.map((p) => (
                <li key={`${p.produit_reference}-${p.produit_nom}`}>
                  <span>{p.produit_nom}{p.produit_reference && <small> {p.produit_reference}</small>}</span>
                  <strong>{t('statistiques.top.commandes', { n: Number(p.commandes) || 0 })}</strong>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </div>
  );
}
