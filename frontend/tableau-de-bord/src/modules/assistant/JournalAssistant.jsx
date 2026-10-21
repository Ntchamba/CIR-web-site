// Journal de l'assistant : une ligne par appel à Gemini (agent, résultat, outils, jetons, durée, date), sans texte ni
// donnée personnelle. Pour le super-administrateur seulement : lecture des conversations (consultation journalisée).
import { useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { dateHeure } from '@partage/utils/format.js';
import usePageMeta from '@partage/utils/usePageMeta.js';

import Onglets from '@/composants/Onglets.jsx';
import PastilleEtat from '@/composants/PastilleEtat.jsx';
import gestion from '@/composants/Gestion.module.css';
import { TAILLE_PAGE } from '@/composants/useListe.js';
import { useTraduction } from '@/i18n/index.js';
import { useAuth } from '@/modules/connexion/AuthContext.jsx';

import { AGENTS, RESULTATS } from './api.js';
import ConversationsAssistant from './composants/ConversationsAssistant.jsx';
import NavigationAssistant from './composants/NavigationAssistant.jsx';
import { useJournal } from './useAssistant.js';
import styles from './Assistant.module.css';

const TONS = { ok: 'ok', bloque: 'attention', erreur_temporaire: 'attention', erreur: 'alerte', limite: 'alerte', consultation: 'info' };

function Journal() {
  const { t, locale } = useTraduction();
  const j = useJournal();
  const pages = Math.max(1, Math.ceil(j.total / TAILLE_PAGE));
  const nombre = (v) => (typeof v === 'number' ? new Intl.NumberFormat(locale).format(v) : '—');
  const comptes = j.resume && typeof j.resume === 'object'
    ? Object.entries(j.resume).filter(([, n]) => typeof n === 'number')
    : [];

  return (
    <div className={styles.section}>
      <p className={styles.aideVolet}>{t('assistant.journal.aucunTexte')}</p>
      {comptes.length > 0 && (
        <section aria-labelledby="journal-resume">
          <h2 id="journal-resume" className={styles.titreSection}>{t('assistant.journal.resume')}</h2>
          <ul className={styles.resume}>
            {comptes.map(([cle, n]) => (
              <li key={cle}>
                <PastilleEtat ton={TONS[cle] || 'neutre'}>
                  {t('assistant.journal.resumeLigne', { resultat: t(`assistant.resultats.${cle}`), n: nombre(n) })}
                </PastilleEtat>
              </li>
            ))}
          </ul>
        </section>
      )}
      <form className={`carte ${styles.filtres}`} role="search" aria-label={t('assistant.journal.filtres')}
        onSubmit={(e) => e.preventDefault()}>
        <Champ libelle={t('assistant.journal.agent')} name="agent" value={j.agent}
          options={[['', t('assistant.journal.tousAgents')], ...AGENTS.map((c) => [c, t(`assistant.agents.${c}`)])]}
          onChange={(e) => j.choisirAgent(e.target.value)} />
        <Champ libelle={t('assistant.journal.resultat')} name="resultat" value={j.resultat}
          options={[['', t('assistant.journal.tousResultats')], ...RESULTATS.map((c) => [c, t(`assistant.resultats.${c}`)])]}
          onChange={(e) => j.choisirResultat(e.target.value)} />
        {j.filtre && <Bouton variante="texte" onClick={j.effacer}>{t('assistant.brouillons.effacer')}</Bouton>}
      </form>

      {j.chargement ? (
        <Chargement texte={t('assistant.journal.chargement')} />
      ) : j.erreur ? (
        <MessageErreur erreur={j.erreur} reessayer={j.recharger} />
      ) : j.elements.length === 0 ? (
        <EtatVide titre={j.filtre ? t('assistant.brouillons.aucunFiltre') : t('assistant.journal.aucun')}>
          {j.filtre ? t('assistant.brouillons.aucunFiltreTexte') : t('assistant.journal.aucunVide')}
        </EtatVide>
      ) : (
        <>
          <p className={gestion.compte} aria-live="polite">{t('assistant.journal.nombre', { n: j.total })}</p>
          <div className={`carte ${gestion.tableau}`}>
            <table>
              <caption className="visuellement-cache">{t('assistant.journal.legende')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('assistant.journal.colonnes.date')}</th>
                  <th scope="col">{t('assistant.journal.colonnes.agent')}</th>
                  <th scope="col">{t('assistant.journal.colonnes.resultat')}</th>
                  <th scope="col">{t('assistant.journal.colonnes.outils')}</th>
                  <th scope="col">{t('assistant.journal.colonnes.jetons')}</th>
                  <th scope="col">{t('assistant.journal.colonnes.duree')}</th>
                </tr>
              </thead>
              <tbody>
                {j.elements.map((l) => (
                  <tr key={l.id}>
                    <td>{dateHeure(l.cree_le)}<span className={gestion.secondaire}>{l.modele}</span></td>
                    <td>{AGENTS.includes(l.agent) ? t(`assistant.agents.${l.agent}`) : l.agent}</td>
                    <td>
                      <PastilleEtat ton={TONS[l.resultat] || 'neutre'}>
                        {RESULTATS.includes(l.resultat) ? t(`assistant.resultats.${l.resultat}`) : l.resultat}
                      </PastilleEtat>
                      {l.code && <span className={gestion.secondaire}>{l.code}</span>}
                    </td>
                    <td>{Array.isArray(l.outils) && l.outils.length ? l.outils.join(', ') : '—'}</td>
                    <td>{t('assistant.journal.jetons', { entree: nombre(l.jetons_entree), sortie: nombre(l.jetons_sortie) })}</td>
                    <td>{typeof l.duree_ms === 'number' ? t('assistant.journal.ms', { n: nombre(l.duree_ms) }) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(j.precedente || j.suivante) && (
            <nav className={gestion.pagination} aria-label={t('assistant.journal.pagination')}>
              <Bouton variante="contour" taille="petit" disabled={!j.precedente} onClick={() => j.allerALaPage(j.page - 1)}>
                {t('pagination.precedente')}
              </Bouton>
              <span>{t('pagination.pageSur', { page: j.page, pages })}</span>
              <Bouton variante="contour" taille="petit" disabled={!j.suivante} onClick={() => j.allerALaPage(j.page + 1)}>
                {t('pagination.suivante')}
              </Bouton>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

export default function JournalAssistant() {
  const { t } = useTraduction();
  usePageMeta(t('assistant.journal.titre'));
  const { superAdmin } = useAuth();
  const [onglet, setOnglet] = useState('journal');

  return (
    <div className={styles.page}>
      <div>
        <h1 className="titre-page">{t('assistant.journal.titre')}</h1>
        <p className="sous-titre-page">{t('assistant.journal.sousTitre')}</p>
      </div>
      <NavigationAssistant />
      {superAdmin ? (
        <Onglets libelle={t('assistant.journal.onglets')} idBase="journal" actif={onglet} surChoix={setOnglet}
          onglets={[
            { cle: 'journal', libelle: t('assistant.journal.ongletJournal') },
            { cle: 'conversations', libelle: t('assistant.conversations.onglet') },
          ]}>
          {onglet === 'journal' ? <Journal /> : <ConversationsAssistant />}
        </Onglets>
      ) : <Journal />}
    </div>
  );
}
