// BF-10, BF-13 : mes commandes (/commandes), filtrées par étape (?etat=), avec le signalement des réponses attendues.
import { Link, useSearchParams } from 'react-router';

import Bouton from '@partage/ui/Bouton.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { date, fcfa, STATUTS, surface } from '@partage/utils/format.js';
import usePageMeta from '@partage/utils/usePageMeta.js';

import VoirPlus from '@/composants/VoirPlus.jsx';
import { useTraduction } from '@/i18n/index.js';

import BadgeEtape from './composants/BadgeEtape.jsx';
import { useCommandes } from './useCommandes.js';
import styles from './Commandes.module.css';

export default function CommandesPage() {
  const { t } = useTraduction();
  usePageMeta(t('commandes.titre'), t('commandes.description'));
  const [parametres, setParametres] = useSearchParams();
  const demande = parametres.get('etat') || '';
  const etat = Object.hasOwn(STATUTS, demande) ? demande : '';
  const liste = useCommandes(etat);

  const choisir = (cle) => setParametres((actuels) => {
    const suivants = new URLSearchParams(actuels);
    if (cle) suivants.set('etat', cle);
    else suivants.delete('etat');
    return suivants;
  }, { replace: true });

  return (
    <div className="conteneur section">
      <div className={styles.entetePage}>
        <div>
          <h1 className="titre-page">{t('commandes.titre')}</h1>
          <p className={styles.intro}>{t('commandes.intro')}</p>
        </div>
        <Bouton as={Link} to="/commandes/nouvelle">{t('commandes.nouvelle.bouton')}</Bouton>
      </div>

      <div role="group" aria-label={t('commandes.filtre.etape')} className={styles.filtreEtapes}>
        {['', ...Object.keys(STATUTS)].map((cle) => (
          <button key={cle || 'toutes'} type="button" aria-pressed={etat === cle} onClick={() => choisir(cle)}>
            {cle ? STATUTS[cle].libelle : t('commandes.filtre.toutes')}
          </button>
        ))}
      </div>

      {liste.chargement && !liste.elements.length && <Chargement />}
      {liste.erreur && <MessageErreur erreur={liste.erreur} reessayer={liste.recharger} />}

      {!liste.chargement && !liste.erreur && liste.elements.length === 0 && (
        <EtatVide titre={etat ? t('commandes.vide.titreFiltre') : t('commandes.vide.titre')}
          action={!etat && <Bouton as={Link} to="/catalogue">{t('commandes.vide.action')}</Bouton>}>
          {etat ? t('commandes.vide.texteFiltre') : t('commandes.vide.texte')}
        </EtatVide>
      )}

      {liste.elements.length > 0 && (
        <ul className={styles.liste} aria-label={t('commandes.titre')}>
          {liste.elements.map((c) => (
            <li key={c.id}>
              <article className={`${styles.carteCommande} ${c.action_requise ? styles.carteAttente : ''}`}>
                <div className={styles.carteHaut}>
                  <h2><Link to={`/commandes/${c.id}`}>{c.reference}</Link></h2>
                  <BadgeEtape etat={c.etat} />
                </div>
                <p className={styles.meta}>
                  {t(`commandes.types.${c.type_batiment}`)}
                  {c.surface_m2 ? ` · ${surface(c.surface_m2)}` : ''}
                  {' · '}{t('commandes.carte.produits', { n: c.nombre_lignes ?? 0 })}
                </p>
                {c.montant_convenu !== null && c.montant_convenu !== undefined && (
                  <p className={styles.montantCarte}>{t('commandes.carte.montant', { montant: fcfa(c.montant_convenu) })}</p>
                )}
                {c.action_requise && <p className={styles.attente}>{t('commandes.carte.actionRequise')}</p>}
                <p className={styles.meta}>{t('commandes.carte.maj', { date: date(c.modifie_le) })}</p>
              </article>
            </li>
          ))}
        </ul>
      )}
      <VoirPlus liste={liste} />
    </div>
  );
}
