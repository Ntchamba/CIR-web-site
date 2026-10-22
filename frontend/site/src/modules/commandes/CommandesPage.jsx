// BF-10, BF-13 : mes commandes, d'après la maquette. Bandeau (fenêtre sur la scène du salon), à gauche la liste des commandes
// (vignette, état, signalement des réponses attendues, « Nouvelle commande → »), à droite le détail de la commande choisie
// (par défaut la première). /commandes/:id ouvre directement le détail d'une commande. Filtre par étape : ?etat=.
import FondBandeau from '@/composants/FondBandeau.jsx';
import { Link, useParams, useSearchParams } from 'react-router';

import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { date } from '@partage/utils/format.js';
import usePageMeta from '@partage/utils/usePageMeta.js';

import VoirPlus from '@/composants/VoirPlus.jsx';
import { useTraduction } from '@/i18n/index.js';

import BadgeEtape from './composants/BadgeEtape.jsx';
import DetailCommande from './DetailCommande.jsx';
import { useCommandes } from './useCommandes.js';
import styles from './Commandes.module.css';

const ETATS = ['nouvelle', 'negociation', 'contrat_signe', 'travaux', 'terminee', 'annulee'];

export default function CommandesPage() {
  const { t } = useTraduction();
  const { id } = useParams();
  usePageMeta(t('commandes.titre'), t('commandes.description'));
  const [parametres, setParametres] = useSearchParams();
  const demande = parametres.get('etat') || '';
  const etat = ETATS.includes(demande) ? demande : '';
  const liste = useCommandes(etat);
  const choisi = id ? String(id) : (liste.elements[0] ? String(liste.elements[0].id) : '');

  const choisir = (cle) => setParametres((actuels) => {
    const suivants = new URLSearchParams(actuels);
    if (cle) suivants.set('etat', cle);
    else suivants.delete('etat');
    return suivants;
  }, { replace: true });

  return (
    <>
      <section className="m-bandeau">
        <FondBandeau />
        <div>
          <h1>{t('commandes.titre')}</h1>
          <p>{t('commandes.intro')}</p>
        </div>
      </section>

      <div className="m-fond-flou">
        <div className="m-conteneur m-commandes">
          <div>
            <label className={styles.filtreEtape}>
              <span className="visuellement-cache">{t('commandes.filtre.etape')}</span>
              <select value={etat} onChange={(e) => choisir(e.target.value)}>
                <option value="">{t('commandes.filtre.toutes')}</option>
                {ETATS.map((cle) => <option key={cle} value={cle}>{t(`commandes.etats.${cle}`)}</option>)}
              </select>
            </label>

            {liste.chargement && !liste.elements.length && <Chargement />}
            {liste.erreur && <MessageErreur erreur={liste.erreur} reessayer={liste.recharger} />}
            {!liste.chargement && !liste.erreur && liste.elements.length === 0 && (
              <EtatVide titre={etat ? t('commandes.vide.titreFiltre') : t('commandes.vide.titre')}
                action={!etat && <Link to="/catalogue" className="m-btn plein">{t('commandes.vide.action')}</Link>}>
                {etat ? t('commandes.vide.texteFiltre') : t('commandes.vide.texte')}
              </EtatVide>
            )}

            {liste.elements.length > 0 && (
              <ul className="m-liste-cmd" aria-label={t('commandes.titre')}>
                {liste.elements.map((c, i) => (
                  <li key={c.id} className="p3d">
                    <Link to={`/commandes/${c.id}`} className={`m-cmd ${c.action_requise ? styles.carteAttente : ''}`}
                      aria-current={String(c.id) === choisi ? 'true' : undefined}>
                      <span className="vignette" aria-hidden="true">{i + 1}</span>
                      <span>
                        <b>{t('commandes.carte.titre', { reference: c.reference })}</b>
                        <small>{t('commandes.carte.produits', { n: c.nombre_lignes ?? 0 })}</small>
                        <small>{t('commandes.carte.detailMeta', { date: date(c.cree_le), type: t(`commandes.types.${c.type_batiment}`) })}</small>
                        <BadgeEtape etat={c.etat} />
                        {c.action_requise && <small className={styles.attente}>{t('commandes.carte.actionRequise')}</small>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <VoirPlus liste={liste} />
            <p className={styles.nouvelle}>
              <Link to="/commandes/nouvelle" className="m-lien-fleche">{t('commandes.nouvelle.bouton')} <span aria-hidden="true">→</span></Link>
            </p>
          </div>

          <div>
            {choisi
              ? <DetailCommande key={choisi} id={choisi} />
              : !liste.chargement && <div className="m-detail"><p>{t('commandes.detail.selectionner')}</p></div>}
          </div>
        </div>
      </div>
    </>
  );
}
