// O1, O4 : assistant IA côté équipe. Onglet « Brouillons » (propositions automatiques à relire : l'assistant ne publie
// et n'envoie rien) et onglet « Statut et usage » (service, limite du jour, consommation du mois).
import { useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { depuis } from '@partage/utils/format.js';
import usePageMeta from '@partage/utils/usePageMeta.js';

import Onglets from '@/composants/Onglets.jsx';
import PastilleEtat from '@/composants/PastilleEtat.jsx';
import gestion from '@/composants/Gestion.module.css';
import { TAILLE_PAGE } from '@/composants/useListe.js';
import { useTraduction } from '@/i18n/index.js';

import { ETATS_BROUILLON, TYPES_BROUILLON } from './api.js';
import NavigationAssistant from './composants/NavigationAssistant.jsx';
import StatutUsage from './composants/StatutUsage.jsx';
import TiroirBrouillon from './composants/TiroirBrouillon.jsx';
import { libelleGardeFou } from './erreurs.js';
import { useBrouillons, useStatut } from './useAssistant.js';
import styles from './Assistant.module.css';

const TONS = { propose: 'attention', accepte: 'ok', modifie: 'info', rejete: 'neutre' };

function Brouillons() {
  const { t } = useTraduction();
  const b = useBrouillons();
  const [ouvert, setOuvert] = useState(null);
  const pages = Math.max(1, Math.ceil(b.total / TAILLE_PAGE));

  return (
    <div className={styles.section}>
      <p className={styles.avertissement}>{t('assistant.avertissement')}</p>
      <form className={`carte ${styles.filtres}`} role="search" aria-label={t('assistant.brouillons.filtres')}
        onSubmit={(e) => e.preventDefault()}>
        <Champ libelle={t('assistant.brouillons.type')} name="type" value={b.type}
          options={[['', t('assistant.brouillons.tousTypes')], ...TYPES_BROUILLON.map((c) => [c, t(`assistant.types.${c}`)])]}
          onChange={(e) => b.choisirType(e.target.value)} />
        <Champ libelle={t('assistant.brouillons.etat')} name="etat" value={b.etat}
          options={[['', t('assistant.brouillons.tousEtats')], ...ETATS_BROUILLON.map((c) => [c, t(`assistant.etats.${c}`)])]}
          onChange={(e) => b.choisirEtat(e.target.value)} />
        {b.filtre && <Bouton variante="texte" onClick={b.effacer}>{t('assistant.brouillons.effacer')}</Bouton>}
      </form>

      {b.chargement ? (
        <Chargement texte={t('assistant.brouillons.chargement')} />
      ) : b.erreur ? (
        <MessageErreur erreur={b.erreur} reessayer={b.recharger} />
      ) : b.elements.length === 0 ? (
        <EtatVide titre={b.filtre ? t('assistant.brouillons.aucunFiltre') : t('assistant.brouillons.aucun')}
          action={b.filtre ? <Bouton variante="contour" onClick={b.effacer}>{t('assistant.brouillons.effacer')}</Bouton> : null}>
          {b.filtre ? t('assistant.brouillons.aucunFiltreTexte') : t('assistant.brouillons.aucunTexte')}
        </EtatVide>
      ) : (
        <>
          <p className={gestion.compte} aria-live="polite">{t('assistant.brouillons.nombre', { n: b.total })}</p>
          <div className={`carte ${gestion.tableau}`}>
            <table>
              <caption className="visuellement-cache">{t('assistant.brouillons.legende')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('assistant.brouillons.colonnes.brouillon')}</th>
                  <th scope="col">{t('assistant.brouillons.colonnes.type')}</th>
                  <th scope="col">{t('assistant.brouillons.colonnes.etat')}</th>
                  <th scope="col">{t('assistant.brouillons.colonnes.par')}</th>
                  <th scope="col">{t('assistant.brouillons.colonnes.cree')}</th>
                </tr>
              </thead>
              <tbody>
                {b.elements.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <button type="button" className={gestion.nom} onClick={() => setOuvert(d)}>
                        {t('assistant.brouillons.numero', { id: d.id })}
                      </button>
                      {d.bloque && <span className={gestion.secondaire}>{libelleGardeFou(d.bloque)}</span>}
                    </td>
                    <td>{t(`assistant.types.${d.type}`)}</td>
                    <td><PastilleEtat ton={TONS[d.etat] || 'neutre'}>{t(`assistant.etats.${d.etat}`)}</PastilleEtat></td>
                    <td>{d.cree_par?.nom_complet || '—'}</td>
                    <td>{depuis(d.cree_le)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(b.precedente || b.suivante) && (
            <nav className={gestion.pagination} aria-label={t('assistant.brouillons.pagination')}>
              <Bouton variante="contour" taille="petit" disabled={!b.precedente} onClick={() => b.allerALaPage(b.page - 1)}>
                {t('pagination.precedente')}
              </Bouton>
              <span>{t('pagination.pageSur', { page: b.page, pages })}</span>
              <Bouton variante="contour" taille="petit" disabled={!b.suivante} onClick={() => b.allerALaPage(b.page + 1)}>
                {t('pagination.suivante')}
              </Bouton>
            </nav>
          )}
        </>
      )}

      {ouvert && (
        <TiroirBrouillon key={ouvert.id} brouillon={ouvert} surFermeture={() => setOuvert(null)}
          surMiseAJour={(maj) => { b.remplacer(maj); setOuvert((o) => ({ ...o, ...maj })); }} />
      )}
    </div>
  );
}

export default function AssistantEquipe() {
  const { t } = useTraduction();
  usePageMeta(t('assistant.titre'));
  const [onglet, setOnglet] = useState('brouillons');
  const statut = useStatut();

  return (
    <div className={styles.page}>
      <div>
        <h1 className="titre-page">{t('assistant.titre')}</h1>
        <p className="sous-titre-page">{t('assistant.sousTitre')}</p>
      </div>
      <NavigationAssistant />
      <Onglets libelle={t('assistant.onglets.libelle')} idBase="assistant" actif={onglet} surChoix={setOnglet}
        onglets={[
          { cle: 'brouillons', libelle: t('assistant.onglets.brouillons') },
          { cle: 'statut', libelle: t('assistant.onglets.statut') },
        ]}>
        {onglet === 'brouillons' ? <Brouillons /> : <StatutUsage statut={statut} />}
      </Onglets>
    </div>
  );
}
