// BF-11, BF-13 : mes demandes (/mes-demandes) : demandes de contact et demandes de rendu, avec la réponse de l'équipe.
// Les textes écrits par le client et par l'équipe sont affichés tels quels (non traduits).
import { Link, useLocation } from 'react-router';

import Bouton from '@partage/ui/Bouton.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { date, dateHeure, surface } from '@partage/utils/format.js';
import usePageMeta from '@partage/utils/usePageMeta.js';

import VoirPlus from '@/composants/VoirPlus.jsx';
import { useTraduction } from '@/i18n/index.js';

import { useDemandesContact, useDemandesRendu } from './useContact.js';
import styles from './Contact.module.css';

function Reponse({ texte }) {
  const { t } = useTraduction();
  if (!texte) return null;
  return (
    <blockquote className={styles.reponse}>
      <strong>{t('mesDemandes.reponse')}</strong>
      <p className={styles.libre}>{texte}</p>
    </blockquote>
  );
}

function ListeDemandes({ liste, titreId, titre, vide, children }) {
  const { t } = useTraduction();
  return (
    <section aria-labelledby={titreId} className={styles.groupe}>
      <h2 id={titreId}>{titre}</h2>
      {liste.chargement && !liste.elements.length && <Chargement />}
      <MessageErreur erreur={liste.erreur} reessayer={liste.recharger} />
      {!liste.chargement && !liste.erreur && liste.elements.length === 0 && <p className={styles.meta}>{vide}</p>}
      {liste.elements.length > 0 && (
        <ul className={styles.liste} aria-label={t('mesDemandes.listeDe', { titre })}>{liste.elements.map(children)}</ul>
      )}
      <VoirPlus liste={liste} />
    </section>
  );
}

export default function MesDemandesPage() {
  const { t } = useTraduction();
  usePageMeta(t('mesDemandes.titre'));
  const { state } = useLocation();
  const contact = useDemandesContact();
  const rendu = useDemandesRendu();
  const envoyee = state?.demandeEnvoyee;

  return (
    <div className="conteneur section">
      <div className={styles.entetePage}>
        <div>
          <h1 className="titre-page">{t('mesDemandes.titre')}</h1>
          <p className={styles.intro}>{t('mesDemandes.intro')}</p>
        </div>
        <Bouton as={Link} to="/devis/demande">{t('mesDemandes.nouvelleDemande')}</Bouton>
      </div>

      <div role="status" aria-live="polite">
        {envoyee !== undefined && (
          <p className={styles.succesPage}>
            {envoyee ? t('mesDemandes.envoyeeRef', { reference: envoyee }) : t('mesDemandes.envoyee')}
          </p>
        )}
      </div>

      <ListeDemandes liste={rendu} titreId="titre-rendu" titre={t('mesDemandes.rendu.titre')} vide={t('mesDemandes.rendu.vide')}>
        {(d) => (
          <li key={d.id}>
            <article className={styles.demande}>
              <div className={styles.demandeHaut}>
                <h3>{d.reference}</h3>
                <span className={styles.etat}>{t(`mesDemandes.rendu.etats.${d.etat}`)}</span>
                <time dateTime={d.cree_le} className={styles.meta}>{date(d.cree_le)}</time>
              </div>
              <p className={styles.meta}>
                {t(`commandes.types.${d.type_batiment}`)}
                {d.surface_m2 ? ` · ${surface(d.surface_m2)}` : ''}
                {d.produit?.nom ? ` · ${[d.produit.reference, d.produit.nom].filter(Boolean).join(' ')}` : ''}
              </p>
              <p className={styles.libre}>{d.description}</p>
              {(d.images || []).length > 0 && (
                <ul className={styles.images} aria-label={t('mesDemandes.rendu.photos', { n: d.images.length })}>
                  {d.images.map((im) => (
                    <li key={im.url}><img src={im.url} alt={im.alt || ''} width="72" height="54" loading="lazy" decoding="async" /></li>
                  ))}
                </ul>
              )}
              <Reponse texte={d.reponse_equipe} />
              {(d.devis || []).length > 0 && (
                <div className={styles.liens}>
                  {d.devis.map((v) => (
                    <Link key={v.id} to={`/commandes/${v.commande}`}>
                      {t('mesDemandes.rendu.voirDevis', { reference: v.reference })}
                    </Link>
                  ))}
                </div>
              )}
              {d.commande ? (
                <div className={styles.liens}>
                  <Link to={`/commandes/${d.commande}`}>{t('mesDemandes.rendu.voirCommande')}</Link>
                </div>
              ) : null}
            </article>
          </li>
        )}
      </ListeDemandes>

      <ListeDemandes liste={contact} titreId="titre-contact" titre={t('mesDemandes.contact.titre')} vide={t('mesDemandes.contact.vide')}>
        {(d) => (
          <li key={d.id}>
            <article className={styles.demande}>
              <div className={styles.demandeHaut}>
                <h3>{d.reference}</h3>
                <span className={styles.etat}>{t(`mesDemandes.contact.etats.${d.etat}`)}</span>
                <time dateTime={d.cree_le} className={styles.meta}>{dateHeure(d.cree_le)}</time>
              </div>
              <p className={styles.meta}>
                {t(`contact.type.${d.type}`)}
                {d.type === 'rappel' && d.creneau ? ` · ${t(`contact.creneau.${d.creneau}`)}` : ''}
                {d.produit?.nom ? ` · ${d.produit.nom}` : ''}
              </p>
              <p className={styles.libre}>{d.message}</p>
              <Reponse texte={d.reponse_equipe} />
              {d.traitee_le && <p className={styles.meta}>{t('mesDemandes.contact.traiteeLe', { date: date(d.traitee_le) })}</p>}
            </article>
          </li>
        )}
      </ListeDemandes>
    </div>
  );
}
