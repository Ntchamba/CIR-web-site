// BF-11, BF-13 : boîte de réception des demandes de contact (questions et demandes de rappel).
// Onglets par état avec leurs nombres, filtre par type, recherche, tiroir de détail pour répondre.
import { useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { depuis } from '@partage/utils/format.js';
import usePageMeta from '@partage/utils/usePageMeta.js';

import LiensContact from '@/composants/LiensContact.jsx';
import Onglets from '@/composants/Onglets.jsx';
import PastilleEtat from '@/composants/PastilleEtat.jsx';
import gestion from '@/composants/Gestion.module.css';
import { TAILLE_PAGE } from '@/composants/useListe.js';
import { useTraduction } from '@/i18n/index.js';

import TiroirDemande from './composants/TiroirDemande.jsx';
import useContact, { ETATS, TYPES } from './useContact.js';
import styles from './Contact.module.css';

const TONS = { nouvelle: 'alerte', en_cours: 'attention', traitee: 'ok' };
const apercu = (texte = '') => (texte.length > 100 ? `${texte.slice(0, 100)}…` : texte);

export default function DemandesPage() {
  const { t } = useTraduction();
  usePageMeta(t('contact.titre'));
  const {
    elements, total, suivante, precedente, page, chargement, erreur, recharger, remplacer, resume, rechargerResume,
    etat, type, saisie, changerSaisie, choisirEtat, choisirType, allerALaPage, effacer, filtre,
  } = useContact();
  const [ouverte, setOuverte] = useState(null);
  const pages = Math.max(1, Math.ceil(total / TAILLE_PAGE));

  const onglets = [
    { cle: 'toutes', libelle: t('contact.toutes'), nombre: resume.total },
    ...ETATS.map((cle) => ({ cle, libelle: t(`contact.etats.${cle}`), nombre: resume[cle], urgent: cle === 'nouvelle' })),
  ];

  return (
    <div className={styles.page}>
      <div>
        <h1 className="titre-page">{t('contact.titre')}</h1>
        <p className="sous-titre-page">{t('contact.sousTitre')}</p>
      </div>

      <Onglets libelle={t('contact.onglets')} idBase="contact" onglets={onglets} actif={etat || 'toutes'}
        surChoix={(cle) => choisirEtat(cle === 'toutes' ? '' : cle)}>
        <form className={`carte ${styles.filtres}`} role="search" aria-label={t('contact.recherche')}
          onSubmit={(e) => e.preventDefault()}>
          <Champ libelle={t('contact.rechercher')} name="q" type="search" value={saisie} autoComplete="off"
            onChange={(e) => changerSaisie(e.target.value)} />
          <Champ libelle={t('contact.type')} name="type" value={type}
            options={[['', t('contact.tousTypes')], ...TYPES.map((c) => [c, t(`contact.types.${c}`)])]}
            onChange={(e) => choisirType(e.target.value)} />
          {(filtre || saisie) && <Bouton variante="texte" onClick={effacer}>{t('contact.effacer')}</Bouton>}
        </form>

        {chargement ? (
          <Chargement texte={t('contact.chargement')} />
        ) : erreur ? (
          <MessageErreur erreur={erreur} reessayer={recharger} />
        ) : elements.length === 0 ? (
          <EtatVide titre={filtre ? t('contact.aucunFiltre') : t('contact.aucune')}
            action={filtre ? <Bouton variante="contour" onClick={effacer}>{t('contact.effacer')}</Bouton> : null}>
            {filtre ? t('contact.aucunFiltreTexte') : t('contact.aucuneTexte')}
          </EtatVide>
        ) : (
          <>
            <p className={gestion.compte} aria-live="polite">{t('contact.nombre', { n: total })}</p>
            <div className={`carte ${gestion.tableau}`}>
              <table>
                <caption className="visuellement-cache">{t('contact.legende')}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t('contact.colonnes.demande')}</th>
                    <th scope="col">{t('contact.colonnes.contact')}</th>
                    <th scope="col">{t('contact.colonnes.type')}</th>
                    <th scope="col">{t('contact.colonnes.etat')}</th>
                    <th scope="col">{t('contact.colonnes.recue')}</th>
                  </tr>
                </thead>
                <tbody>
                  {elements.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <button type="button" className={gestion.nom} onClick={() => setOuverte(d)}>{d.reference}</button>
                        <span className={gestion.secondaire}>{apercu(d.message)}</span>
                      </td>
                      <td>
                        <strong>{d.nom}</strong>
                        <LiensContact email={d.email} telephone={d.telephone} />
                      </td>
                      <td>
                        {t(`contact.types.${d.type}`)}
                        {d.type === 'rappel' && d.creneau && (
                          <span className={gestion.secondaire}>{t(`contact.creneaux.${d.creneau}`)}</span>
                        )}
                      </td>
                      <td><PastilleEtat ton={TONS[d.etat] || 'neutre'}>{t(`contact.etats.${d.etat}`)}</PastilleEtat></td>
                      <td>{depuis(d.cree_le)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(precedente || suivante) && (
              <nav className={gestion.pagination} aria-label={t('contact.pagination')}>
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

      {ouverte && (
        <TiroirDemande key={ouverte.id} demande={ouverte} surFermeture={() => setOuverte(null)}
          surMiseAJour={(maj) => { remplacer(maj); setOuverte((o) => ({ ...o, ...maj })); rechargerResume(); }} />
      )}
    </div>
  );
}
