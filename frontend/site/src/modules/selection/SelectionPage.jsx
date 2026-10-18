// BF-09 : « Ma sélection » (/selection). Produits gardés de côté, retrait, vidage et passage à la commande.
import { useState } from 'react';
import { Link } from 'react-router';

import Bouton from '@partage/ui/Bouton.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { prix } from '@partage/utils/format.js';
import usePageMeta from '@partage/utils/usePageMeta.js';

import ImageMedia from '@/composants/ImageMedia.jsx';
import Confirmation from '@/composants/Confirmation.jsx';
import { useTraduction } from '@/i18n/index.js';

import useSelectionPage from './useSelection.js';
import styles from './Selection.module.css';

export default function SelectionPage() {
  const { t } = useTraduction();
  usePageMeta(t('selection.titre'));
  const { liste, action, retirer, vider } = useSelectionPage();
  const [confirmerVidage, setConfirmerVidage] = useState(false);
  const elements = liste.donnees?.elements || [];
  const horsLigne = elements.some((e) => e.disponible === false);

  let message = '';
  if (action.message === '*') message = t('selection.videe');
  else if (action.message) message = t('selection.retire', { nom: action.message });

  return (
    <div className="conteneur section">
      <div className={styles.entete}>
        <h1 className="titre-page">{t('selection.titre')}</h1>
        {elements.length > 0 && <p aria-live="polite">{t('selection.nombre', { n: elements.length })}</p>}
      </div>
      <p className={styles.intro}>{t('selection.intro')}</p>

      <p role="status" aria-live="polite" className="visuellement-cache">{message}</p>
      <MessageErreur erreur={action.erreur} />

      {liste.chargement && !liste.donnees && <Chargement />}
      {!liste.donnees && !liste.chargement && <MessageErreur erreur={liste.erreur} reessayer={liste.recharger} />}

      {liste.donnees && elements.length === 0 && (
        <EtatVide titre={t('selection.vide.titre')} action={<Bouton as={Link} to="/catalogue">{t('selection.vide.action')}</Bouton>}>
          {t('selection.vide.texte')}
        </EtatVide>
      )}

      {elements.length > 0 && (
        <>
          <ul className={styles.liste} aria-label={t('selection.liste')}>
            {elements.map((e) => {
              const p = e.produit || {};
              return (
                <li key={e.id} className={`${styles.element} ${e.disponible === false ? styles.horsLigne : ''}`}>
                  <div className={styles.vignette}>
                    {p.image?.url
                      ? <ImageMedia image={p.image} largeur={176} hauteur={132} alt="" />
                      : <span aria-hidden="true">{p.reference || p.nom?.slice(0, 2)}</span>}
                  </div>
                  <div className={styles.infos}>
                    <h2>
                      {e.disponible === false ? p.nom : <Link to={`/catalogue/${p.slug}`}>{p.nom}</Link>}
                    </h2>
                    <span className={styles.meta}>
                      {[p.reference, p.famille?.nom].filter(Boolean).join(' · ')}
                    </span>
                    {e.design && (
                      <span className={`${styles.meta} ${styles.design}`}>
                        {e.design.couleur && (
                          <span className={styles.pastilleCouleur} style={{ background: e.design.couleur }} aria-hidden="true" />
                        )}
                        {t('selection.design', { nom: e.design.nom })}
                      </span>
                    )}
                    <span className={styles.meta}>{prix(p.prix, p.unite_prix)}</span>
                    {e.disponible === false && <p className={styles.alerte}>{t('selection.horsLigne')}</p>}
                  </div>
                  <Bouton variante="texte" onClick={() => retirer(e)} disabled={action.envoi}
                    aria-label={t('selection.retirerNom', { nom: p.nom })}>
                    {t('selection.retirer')}
                  </Bouton>
                </li>
              );
            })}
          </ul>

          <div className={styles.actionsListe}>
            {horsLigne && <p className={styles.alerte} role="alert">{t('selection.retirerHorsLigne')}</p>}
            <div className={styles.actions}>
              {horsLigne
                ? <Bouton disabled>{t('selection.commander')}</Bouton>
                : <Bouton as={Link} to="/commandes/nouvelle?depuis_selection=1">{t('selection.commander')}</Bouton>}
              <Bouton variante="contour" onClick={() => setConfirmerVidage(true)} disabled={action.envoi}>
                {t('selection.vider')}
              </Bouton>
              <Bouton as={Link} to="/catalogue" variante="texte">{t('selection.continuer')}</Bouton>
            </div>
            {confirmerVidage && (
              <Confirmation titre={t('selection.confirmerVidage')} danger libelleConfirmer={t('selection.vider')}
                chargement={action.envoi}
                onConfirmer={async () => { await vider(); setConfirmerVidage(false); }}
                onRetour={() => setConfirmerVidage(false)} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
