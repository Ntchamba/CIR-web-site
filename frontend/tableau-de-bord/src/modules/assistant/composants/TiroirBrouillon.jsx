// Détail d'un brouillon de l'assistant : texte proposé (modifiable), avertissement permanent, code du garde-fou.
// « Accepter » et « Rejeter » ne font que noter la décision : le texte n'est ni envoyé ni publié. L'application au contenu
// réel (réponse, message, traductions) se fait à la main dans l'écran concerné, avec le bouton « Proposer un brouillon ».
import { useState } from 'react';

import { infosLangue } from '@partage/i18n/langues.js';
import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { dateHeure } from '@partage/utils/format.js';

import Tiroir from '@/composants/Tiroir.jsx';
import { useTraduction } from '@/i18n/index.js';

import { traiterBrouillon } from '../api.js';
import { libelleGardeFou, messageErreurAssistant } from '../erreurs.js';
import styles from '../Assistant.module.css';

/** Contenu d'un brouillon sous forme de liste de champs : [{ cle, langue, texte }] (cle '' = texte unique). */
export function champsDuContenu(contenu) {
  if (typeof contenu === 'string') return [{ cle: '', langue: '', texte: contenu }];
  if (contenu && typeof contenu === 'object') {
    return Object.entries(contenu).map(([langue, texte]) => ({ cle: langue, langue, texte: typeof texte === 'string' ? texte : '' }));
  }
  return [];
}

export default function TiroirBrouillon({ brouillon, surFermeture, surMiseAJour }) {
  const { t } = useTraduction();
  const champs = champsDuContenu(brouillon.contenu);
  const [textes, setTextes] = useState(() => Object.fromEntries(champs.map((c) => [c.cle, c.texte])));
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState('');
  const [annonce, setAnnonce] = useState('');
  const propose = brouillon.etat === 'propose';
  const change = champs.some((c) => textes[c.cle] !== c.texte);

  async function decider(etat) {
    setEnvoi(etat);
    setErreur(null);
    setAnnonce('');
    try {
      const contenu = typeof brouillon.contenu === 'string' ? textes[''] : Object.fromEntries(champs.map((c) => [c.langue, textes[c.cle]]));
      const maj = await traiterBrouillon(brouillon.id, { etat, ...(etat === 'modifie' ? { contenu } : {}) });
      surMiseAJour({ ...brouillon, ...maj, id: brouillon.id, etat: maj?.etat ?? etat, ...(etat === 'modifie' ? { contenu: maj?.contenu ?? contenu } : {}) });
      setAnnonce(t('assistant.tiroir.enregistre'));
    } catch (e) {
      setErreur(messageErreurAssistant(e));
    } finally {
      setEnvoi('');
    }
  }

  return (
    <Tiroir ouvert large titre={t('assistant.tiroir.titre', { id: brouillon.id })}
      sousTitre={t(`assistant.types.${brouillon.type}`)} surFermeture={surFermeture}>
      <p className={styles.avertissement}>{t('assistant.avertissement')}</p>
      {brouillon.bloque && (
        <p className={styles.alerteGarde} role="alert">
          {t('assistant.tiroir.controle', { motif: libelleGardeFou(brouillon.bloque) })}
        </p>
      )}
      <section className={styles.section} aria-labelledby="brouillon-infos">
        <h3 id="brouillon-infos" className={styles.titreSection}>{t('assistant.tiroir.informations')}</h3>
        <dl className={styles.infos}>
          <div className={styles.info}><dt>{t('assistant.brouillons.colonnes.etat')}</dt><dd>{t(`assistant.etats.${brouillon.etat}`)}</dd></div>
          <div className={styles.info}><dt>{t('assistant.tiroir.cible')}</dt><dd>{brouillon.cible_type || '—'} · {brouillon.cible_id ?? '—'}</dd></div>
          {brouillon.langue && <div className={styles.info}><dt>{t('assistant.tiroir.langue')}</dt><dd>{infosLangue(brouillon.langue).nom}</dd></div>}
          <div className={styles.info}><dt>{t('assistant.tiroir.creePar')}</dt><dd>{brouillon.cree_par?.nom_complet || '—'}</dd></div>
          <div className={styles.info}><dt>{t('assistant.tiroir.creeLe')}</dt><dd>{dateHeure(brouillon.cree_le)}</dd></div>
          {brouillon.traite_le && (
            <div className={styles.info}>
              <dt>{t('assistant.tiroir.traitePar')}</dt>
              <dd>{brouillon.traite_par?.nom_complet || '—'} · {dateHeure(brouillon.traite_le)}</dd>
            </div>
          )}
        </dl>
      </section>

      <section className={styles.section} aria-labelledby="brouillon-texte">
        <h3 id="brouillon-texte" className={styles.titreSection}>{t('assistant.tiroir.contenu')}</h3>
        {champs.length === 0 && <p>{t('assistant.volet.vide')}</p>}
        {champs.map((c) => (
          <Champ key={c.cle || 'texte'} name={`contenu-${c.cle || 'texte'}`} multiligne rows={c.langue ? 4 : 9}
            libelle={c.langue ? t('assistant.tiroir.texteEn', { langue: infosLangue(c.langue).nom }) : t('assistant.tiroir.texte')}
            lang={c.langue ? infosLangue(c.langue).html : undefined} readOnly={!propose} value={textes[c.cle] ?? ''}
            onChange={(e) => setTextes((s) => ({ ...s, [c.cle]: e.target.value }))} />
        ))}
        <p className={styles.aideVolet}>{propose ? t('assistant.tiroir.aide') : t('assistant.tiroir.dejaTraite')}</p>
      </section>

      {erreur && <MessageErreur erreur={erreur} />}
      {propose && (
        <div className={styles.actions}>
          <Bouton chargement={envoi === 'accepte'} disabled={Boolean(envoi) || change} onClick={() => decider('accepte')}>
            {t('assistant.tiroir.accepter')}
          </Bouton>
          <Bouton variante="contour" chargement={envoi === 'modifie'} disabled={Boolean(envoi) || !change} onClick={() => decider('modifie')}>
            {t('assistant.tiroir.accepterModifie')}
          </Bouton>
          <Bouton variante="texte" chargement={envoi === 'rejete'} disabled={Boolean(envoi)} onClick={() => decider('rejete')}>
            {t('assistant.tiroir.rejeter')}
          </Bouton>
        </div>
      )}
      <p role="status" aria-live="polite" className={annonce ? styles.annonce : 'visuellement-cache'}>{annonce}</p>
    </Tiroir>
  );
}
