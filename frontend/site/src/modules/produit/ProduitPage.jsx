// BF-01, BF-05, BF-06, BF-14 : fiche d'un produit, d'après les maquettes. Plein écran : l'image du produit, agrandie,
// floutée et teintée sombre, sert de fond ; à gauche le texte (« ← Catalogue », famille, titre, référence, prix, description,
// « Commander ou personnaliser + », « Sélectionner ce produit »), à droite le produit en grande image carrée avec « Préc. »
// et « Suiv. ». Téléphone : l'image en plein écran et le texte en police mono. Le panneau d'options s'ouvre à droite (bas
// sur téléphone). Au clic sur une vignette du catalogue, l'image grandit jusqu'au grand carré (View Transitions).
import { useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';

import Bouton from '@partage/ui/Bouton.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { prix } from '@partage/utils/format.js';
import usePageMeta from '@partage/utils/usePageMeta.js';

import { useEcranTelephone } from '@/app/preferences.js';
import { retenirProduitVu } from '@/composants/transitionProduit.js';
import { useTraduction } from '@/i18n/index.js';
import { useContexteAssistant } from '@/modules/assistant/contexte.js';
import BoutonSelection from '@/modules/selection/composants/BoutonSelection.jsx';

import FicheTechnique from './composants/FicheTechnique.jsx';
import PanneauOptions from './composants/PanneauOptions.jsx';
import PlanCoupe from './composants/PlanCoupe.jsx';
import useProduit from './useProduit.js';
import useVoisins from './useVoisins.js';
import styles from './Produit.module.css';

const premierParagraphe = (texte) => String(texte || '').split(/\n\s*\n/).map((b) => b.trim()).find(Boolean) || '';
const aFicheTechnique = (p) => Boolean(p?.description || p?.domaine_application || p?.performances
  || Object.values(p?.mise_en_oeuvre || {}).some(Boolean) || p?.caracteristiques?.length || p?.couches?.length);

function Fiche({ produit, detail, voisins }) {
  const { t } = useTraduction();
  const telephone = useEcranTelephone();
  const [index, setIndex] = useState(0);
  const [panneau, setPanneau] = useState(false);
  const declencheur = useRef(null);
  const images = detail?.images?.length ? detail.images : (produit.image?.url ? [produit.image] : []);
  const courante = images[Math.min(index, images.length - 1)];
  const surtitre = [produit.famille?.nom, produit.a_la_une ? t('produit.produitDuMoment') : null].filter(Boolean).join(' · ');
  const reference = [produit.reference ? t('produit.reference', { reference: produit.reference }) : null, produit.accroche].filter(Boolean).join(' · ');
  const description = premierParagraphe(produit.description) || produit.accroche || '';
  const grande = courante ? (
    <img className="grand" src={courante.url} alt={courante.alt || produit.nom} width="1280" height="1280" decoding="async"
      fetchPriority="high" style={{ viewTransitionName: 'produit-image' }} />
  ) : (
    <div className="grand neutre" role="img" aria-label={produit.nom} style={{ viewTransitionName: 'produit-image' }}>{produit.reference || produit.nom}</div>
  );
  const ouvrir = (e) => { declencheur.current = e.currentTarget; setPanneau(true); };
  const fermer = () => { setPanneau(false); };
  const lienVoisin = (v, cle, contenu) => v && (
    <Link to={`/catalogue/${v.slug}`} state={{ apercu: v }} rel={cle === 'precedent' ? 'prev' : 'next'} onClick={() => retenirProduitVu(v.slug)}
      aria-label={t(`produit.${cle}Nom`, { nom: v.nom })}>{contenu}</Link>
  );
  const actualisation = detail || produit;

  if (telephone) {
    return (
      <>
        <section className={styles.tel} aria-labelledby="titre-produit">
          {courante
            ? <img className={styles.telImage} src={courante.url} alt={courante.alt || produit.nom} decoding="async" fetchPriority="high" style={{ viewTransitionName: 'produit-image' }} />
            : <div className={styles.telNeutre} style={{ viewTransitionName: 'produit-image' }} />}
          <div className={styles.telVoile} aria-hidden="true" />
          <button type="button" className={styles.telTout} onClick={ouvrir} aria-label={t('produit.ouvrirOptions')} aria-haspopup="dialog" />
          <div className={styles.telContenu}>
            <div className={styles.telHaut}>
              <div className={styles.telLiens}>
                <Link to="/catalogue">[←] {t('produit.catalogue')}</Link>
                <Link to="/commandes">{t('nav.mesCommandes')}</Link>
              </div>
              <h1 id="titre-produit">{produit.nom}</h1>
              <div>
                <div className={styles.telLigne}>
                  <span>{produit.a_la_une ? t('produit.produitDuMoment') : ''}</span><span>{produit.famille?.nom}</span>
                </div>
                {reference && <div className={styles.telRef}>{reference}</div>}
              </div>
            </div>
            <div className={styles.telBas}>
              <div className={styles.telConseils}><span>{t('produit.conseils')}</span><span aria-hidden="true" /></div>
              <p>{description} {t('produit.toucherImage')}</p>
              <div className={styles.telPrix}><span>{t('produit.prixLibelle')}</span><span>{prix(produit.prix, produit.unite_prix)}</span></div>
              <button type="button" className={styles.telCommander} onClick={ouvrir} aria-haspopup="dialog">
                <span>{t('produit.commanderOuPersonnaliser')}</span><span aria-hidden="true">[+]</span>
              </button>
              <div className={styles.telLiens}>
                {lienVoisin(voisins.precedent, 'precedent', `[←] ${t('produit.precedent')}`) || <span />}
                {lienVoisin(voisins.suivant, 'suivant', `${t('produit.suivant')} [→]`)}
              </div>
            </div>
          </div>
        </section>
        <PanneauOptions produit={actualisation} ouvert={panneau} onFermer={fermer} />
        {detail && aFicheTechnique(detail) && (
          <section id="fiche-technique" className={`m-fiche-suite m-fond-flou ${styles.suite}`}>
            <div className="m-conteneur"><FicheTechnique produit={detail} /><PlanCoupe couches={detail.couches} /></div>
          </section>
        )}
      </>
    );
  }

  return (
    <>
      <section className="m-fiche" aria-labelledby="titre-produit">
        <div className={`m-fiche-fond ${styles.fond}`} aria-hidden="true">
          {courante ? <img src={courante.url} alt="" decoding="async" /> : <div className="neutre" />}
        </div>
        <div className="m-conteneur">
          <div className="p3d">
            <Link className="retour" to="/catalogue"><span aria-hidden="true">←</span> {t('produit.catalogue')}</Link>
            {surtitre && <p className="m-surtitre">{surtitre}</p>}
            <h1 id="titre-produit">{produit.nom}</h1>
            {reference && <p className="ref">{reference}</p>}
            <p className="prix">{prix(produit.prix, produit.unite_prix)}</p>
            {description && <p className="desc">{description}</p>}
            <div className="actions">
              <button type="button" className="m-btn clair" onClick={ouvrir} aria-haspopup="dialog">
                {t('produit.commanderOuPersonnaliser')} <span aria-hidden="true">+</span>
              </button>
              <BoutonSelection produit={produit.id} nom={produit.nom} apparence="fiche" lienSiAjoute={false} />
            </div>
          </div>
          <div className="visuel">
            {grande}
            {images.length > 1 && (
              <ul className="vignettes" aria-label={t('produit.galerie.vignettes')}>
                {images.map((image, i) => (
                  <li key={image.url}>
                    <button type="button" onClick={() => setIndex(i)} aria-pressed={i === index}
                      aria-label={t('produit.galerie.voirImage', { n: i + 1, total: images.length })}>
                      <img src={image.url} alt="" width="56" height="56" loading="lazy" decoding="async" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="fleches">
              {lienVoisin(voisins.precedent, 'precedent', <><span aria-hidden="true">←</span>&nbsp;{t('produit.precedent')}</>) || <span />}
              {lienVoisin(voisins.suivant, 'suivant', <>{t('produit.suivant')}&nbsp;<span aria-hidden="true">→</span></>)}
            </div>
          </div>
        </div>
      </section>
      <PanneauOptions produit={actualisation} ouvert={panneau} onFermer={fermer} />
      {detail && aFicheTechnique(detail) && (
        <section id="fiche-technique" className={`m-fiche-suite m-fond-flou ${styles.suite}`}>
          <div className="m-conteneur"><FicheTechnique produit={detail} /><PlanCoupe couches={detail.couches} /></div>
        </section>
      )}
    </>
  );
}

export default function ProduitPage() {
  const { slug } = useParams();
  const { t } = useTraduction();
  const { state } = useLocation();
  const { produit: detail, chargement, erreur, introuvable, recharger } = useProduit(slug);
  const apercu = state?.apercu?.slug === slug ? state.apercu : null; // carte du catalogue : la fiche s'affiche tout de suite
  const produit = detail || apercu;
  const voisins = useVoisins(slug);
  usePageMeta(produit?.nom || (introuvable ? t('produit.introuvable.titre') : t('catalogue.titre')), produit?.accroche);
  useContexteAssistant('produit', produit?.reference); // contexte transmis à l'assistant (indice vérifié par le serveur)

  if (introuvable) {
    return (
      <div className="m-fond-flou m-page-claire"><div className="m-conteneur" style={{ padding: '40px 0' }}>
        <EtatVide titre={t('produit.introuvable.titre')} niveau={1}
          action={<Bouton as={Link} to="/catalogue">{t('produit.retourCatalogue')}</Bouton>}>
          {t('produit.introuvable.texte')}
        </EtatVide>
      </div></div>
    );
  }
  if (!produit) {
    return (
      <div className="m-fond-flou m-page-claire"><div className="m-conteneur" style={{ padding: '40px 0' }}>
        {chargement ? <Chargement plein /> : <MessageErreur erreur={erreur} reessayer={recharger} />}
      </div></div>
    );
  }
  return <Fiche key={slug} produit={produit} detail={detail} voisins={voisins} />;
}
