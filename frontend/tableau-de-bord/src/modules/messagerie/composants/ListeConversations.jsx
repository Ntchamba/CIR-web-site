// Liste des conversations (à gauche) : recherche, filtre « non lus », pastille par conversation, aperçu, heure.
import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { depuis } from '@partage/utils/format.js';

import gestion from '@/composants/Gestion.module.css';
import { useTraduction } from '@/i18n/index.js';

import styles from '../Messagerie.module.css';

export default function ListeConversations({
  liste, saisie, changerSaisie, nonLus, basculerNonLus, effacer, filtre, selectionId, ouvrir, page, allerALaPage, pages,
}) {
  const { t } = useTraduction();
  const { elements, chargement, erreur, recharger, suivante, precedente } = liste;
  return (
    <div className={styles.liste}>
      <form className={styles.filtres} role="search" aria-label={t('messagerie.liste.recherche')} onSubmit={(e) => e.preventDefault()}>
        <Champ libelle={t('messagerie.liste.rechercher')} name="q" type="search" value={saisie} autoComplete="off"
          onChange={(e) => changerSaisie(e.target.value)} />
        <label className={gestion.case}>
          <input type="checkbox" checked={nonLus} onChange={(e) => basculerNonLus(e.target.checked)} />
          <span>{t('messagerie.liste.nonLusSeulement')}</span>
        </label>
        {(filtre || saisie) && <Bouton variante="texte" onClick={effacer}>{t('messagerie.liste.effacer')}</Bouton>}
      </form>

      {chargement && elements.length === 0 ? (
        <Chargement texte={t('messagerie.liste.chargement')} />
      ) : erreur ? (
        <MessageErreur erreur={erreur} reessayer={recharger} />
      ) : elements.length === 0 ? (
        <EtatVide titre={filtre || saisie ? t('messagerie.liste.aucunFiltre') : t('messagerie.liste.aucune')} niveau={2}>
          {filtre || saisie ? t('messagerie.liste.aucunFiltreTexte') : t('messagerie.liste.aucuneTexte')}
        </EtatVide>
      ) : (
        <ul className={styles.conversations} aria-label={t('messagerie.liste.titre')}>
          {elements.map((c) => {
            const dernier = c.dernier_message;
            const apercu = dernier ? (dernier.texte || t('messagerie.liste.pieceJointe')) : t('messagerie.liste.aucunMessage');
            return (
              <li key={c.id}>
                <button type="button" className={`${styles.conversation} ${c.id === selectionId ? styles.conversationActive : ''}`}
                  aria-current={c.id === selectionId ? 'true' : undefined} onClick={() => ouvrir(c)}>
                  <span className={styles.ligneHaut}>
                    <strong>{c.client?.nom_complet || c.client?.email}</strong>
                    {c.dernier_message_le && <small>{depuis(c.dernier_message_le)}</small>}
                  </span>
                  <span className={styles.ligneBas}>
                    <span className={styles.apercu}>
                      {dernier?.auteur_role === 'equipe' && <span>{t('messagerie.liste.vous')} </span>}
                      {apercu}
                    </span>
                    {c.non_lus > 0 && (
                      <span className={styles.pastille}>
                        <span aria-hidden="true">{c.non_lus}</span>
                        <span className="visuellement-cache">{t('messagerie.liste.nonLus', { n: c.non_lus })}</span>
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {(precedente || suivante) && (
        <nav className={gestion.pagination} aria-label={t('messagerie.liste.pagination')}>
          <Bouton variante="contour" taille="petit" disabled={!precedente} onClick={() => allerALaPage(page - 1)}>
            {t('pagination.precedente')}
          </Bouton>
          <span>{t('pagination.pageSur', { page, pages })}</span>
          <Bouton variante="contour" taille="petit" disabled={!suivante} onClick={() => allerALaPage(page + 1)}>
            {t('pagination.suivante')}
          </Bouton>
        </nav>
      )}
    </div>
  );
}
