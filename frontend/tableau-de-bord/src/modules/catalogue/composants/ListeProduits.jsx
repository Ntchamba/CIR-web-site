// Liste des produits : filtres (recherche, famille, en ligne / hors ligne), tableau, pagination, tiroir du produit.
import { useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { prix } from '@partage/utils/format.js';

import { useTraduction } from '@/i18n/index.js';
import { PastilleTraductions } from '@/composants/OngletsLangues.jsx';
import gestion from '@/composants/Gestion.module.css';

import { TAILLE_PAGE } from '../api.js';
import useCatalogue from '../useCatalogue.js';
import TiroirProduit from './TiroirProduit.jsx';

const vignette = (produit) => {
  const images = [...(produit.images || [])].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
  return images[0]?.url || produit.image?.url || '';
};

/** `surChangementFamilles` : recharge les familles (nombre de produits) après création, suppression ou changement de famille. */
export default function ListeProduits({ familles, surChangementFamilles }) {
  const { t } = useTraduction();
  const {
    produits, total, suivante, precedente, criteres, saisie, changerSaisie, filtrer, allerALaPage, effacer, filtre,
    chargement, erreur, recharger, remplacer, retirer,
  } = useCatalogue();
  const [ouvert, setOuvert] = useState(null); // id, 'nouveau' ou null
  const [annonce, setAnnonce] = useState('');
  const nomFamille = (id) => familles.find((f) => f.id === (id?.id ?? id))?.nom || '—';
  const pages = Math.max(1, Math.ceil(total / TAILLE_PAGE));

  return (
    <section className={gestion.page} aria-labelledby="titre-produits">
      <div className={gestion.entete}>
        <h2 id="titre-produits" className={gestion.titreCarte}>{t('catalogue.produits.titre')}</h2>
        <Bouton onClick={() => { setOuvert('nouveau'); setAnnonce(''); }}>{t('catalogue.produits.ajouter')}</Bouton>
      </div>
      <p className="visuellement-cache" role="status" aria-live="polite">{annonce}</p>
      {annonce && <p className={gestion.succes}>{annonce}</p>}

      <form className={`carte ${gestion.filtres}`} role="search" aria-label={t('catalogue.produits.recherche')}
        onSubmit={(e) => e.preventDefault()}>
        <Champ libelle={t('catalogue.produits.rechercher')} name="q" type="search" value={saisie}
          onChange={(e) => changerSaisie(e.target.value)} placeholder={t('catalogue.produits.exempleRecherche')}
          autoComplete="off" />
        <Champ libelle={t('catalogue.produits.famille')} name="famille" value={criteres.famille}
          onChange={(e) => filtrer('famille', e.target.value)}
          options={[['', t('catalogue.produits.toutesFamilles')], ...familles.map((f) => [String(f.id), f.nom])]} />
        <Champ libelle={t('catalogue.produits.statut')} name="en_ligne" value={criteres.enLigne}
          onChange={(e) => filtrer('enLigne', e.target.value)}
          options={[['', t('catalogue.produits.tous')], ['1', t('catalogue.produits.enLigne')], ['0', t('catalogue.produits.horsLigne')]]} />
        {filtre && <Bouton variante="texte" onClick={effacer}>{t('catalogue.produits.effacer')}</Bouton>}
      </form>

      {chargement ? (
        <Chargement texte={t('catalogue.produits.chargement')} />
      ) : erreur ? (
        <MessageErreur erreur={erreur} reessayer={recharger} />
      ) : produits.length === 0 ? (
        <EtatVide titre={filtre ? t('catalogue.produits.aucunFiltre') : t('catalogue.produits.vide')}
          action={filtre ? <Bouton variante="contour" onClick={effacer}>{t('catalogue.produits.effacer')}</Bouton> : null}>
          {filtre ? t('catalogue.produits.aucunFiltreTexte') : t('catalogue.produits.videTexte')}
        </EtatVide>
      ) : (
        <>
          <p className={gestion.compte} aria-live="polite">{t('catalogue.produits.nombre', { n: total })}</p>
          <div className={`carte ${gestion.tableau}`}>
            <table>
              <caption className="visuellement-cache">{t('catalogue.produits.legende')}</caption>
              <thead>
                <tr>
                  <th scope="col"><span className="visuellement-cache">{t('catalogue.produits.colonnes.photo')}</span></th>
                  <th scope="col">{t('catalogue.produits.colonnes.produit')}</th>
                  <th scope="col">{t('catalogue.produits.colonnes.famille')}</th>
                  <th scope="col">{t('catalogue.produits.colonnes.prix')}</th>
                  <th scope="col">{t('catalogue.produits.colonnes.statut')}</th>
                  <th scope="col">{t('catalogue.produits.colonnes.traductions')}</th>
                </tr>
              </thead>
              <tbody>
                {produits.map((p) => (
                  <tr key={p.id}>
                    <td>{vignette(p) ? <img src={vignette(p)} alt="" className={gestion.vignette} loading="lazy" />
                      : <span className={gestion.vignette} aria-hidden="true" />}</td>
                    <td>
                      <button type="button" className={gestion.nom} onClick={() => { setOuvert(p.id); setAnnonce(''); }}>
                        {p.nom}
                      </button>
                      {p.reference && <span className={gestion.secondaire}>{p.reference}</span>}
                    </td>
                    <td>{nomFamille(p.famille)}</td>
                    <td>{prix(p.prix, p.unite_prix)}</td>
                    <td>
                      <span className={gestion.pastilles}>
                        <span className={`${gestion.pastille} ${p.en_ligne ? gestion.ok : gestion.neutre}`}>
                          {p.en_ligne ? t('catalogue.produits.enLigne') : t('catalogue.produits.horsLigne')}
                        </span>
                        {p.a_la_une && <span className={`${gestion.pastille} ${gestion.info}`}>{t('catalogue.produits.aLaUne')}</span>}
                        {p.est_nouveau && <span className={`${gestion.pastille} ${gestion.attention}`}>{t('catalogue.produits.nouveau')}</span>}
                      </span>
                    </td>
                    <td>{p.langues_incompletes?.length ? <PastilleTraductions langues={p.langues_incompletes} />
                      : <span className={`${gestion.pastille} ${gestion.ok}`}>{t('langues.complet')}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(precedente || suivante) && (
            <nav className={gestion.pagination} aria-label={t('catalogue.produits.pagination')}>
              <Bouton variante="contour" taille="petit" disabled={!precedente} onClick={() => allerALaPage(criteres.page - 1)}>
                {t('pagination.precedente')}
              </Bouton>
              <span>{t('pagination.pageSur', { page: criteres.page, pages })}</span>
              <Bouton variante="contour" taille="petit" disabled={!suivante} onClick={() => allerALaPage(criteres.page + 1)}>
                {t('pagination.suivante')}
              </Bouton>
            </nav>
          )}
        </>
      )}

      {ouvert && (
        <TiroirProduit key={ouvert} produitId={ouvert} familles={familles} surFermeture={() => setOuvert(null)}
          surEnregistrement={(produit) => {
            const avant = produits.find((p) => p.id === produit.id);
            const idFamille = (f) => f?.id ?? f;
            remplacer(produit);
            if (!avant || idFamille(avant.famille) !== idFamille(produit.famille)) surChangementFamilles?.();
          }}
          surSuppression={(id) => {
            const nom = produits.find((p) => p.id === id)?.nom || '';
            retirer(id);
            surChangementFamilles?.();
            setOuvert(null);
            setAnnonce(t('catalogue.produits.supprime', { nom }));
          }} />
      )}
    </section>
  );
}
