// Bouton réutilisable « Proposer un brouillon » (réponse à une demande de contact, réponse de messagerie, traductions).
// Le brouillon s'affiche dans un volet à relire et à corriger. Il n'est JAMAIS inséré, envoyé ni publié tout seul :
// « Copier… » est un geste volontaire qui appelle `surCopie`, et l'enregistrement reste l'action habituelle de l'écran.
// Le bouton est masqué si le service n'est pas configuré (`statut/` : configure: false).
//
//   <BoutonBrouillonIA type="reponse_contact" cibleId={demande.id} libelle="…" libelleCopie="…"
//     surCopie={([{ texte }]) => setReponse(texte)} />
//   <BoutonBrouillonIA type="traduction" contexte="produit" textes={[{ nom: 'nom', libelle: 'Nom', texte: 'Résine' }]}
//     surCopie={(propositions) => …}  />  // propositions : [{ nom, langue, texte }]
import { useEffect, useId, useRef, useState } from 'react';

import { infosLangue } from '@partage/i18n/langues.js';
import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';

import { useTraduction } from '@/i18n/index.js';

import { creerBrouillon, traiterBrouillon } from '../api.js';
import { libelleGardeFou, messageErreurAssistant } from '../erreurs.js';
import { useAssistantDisponible } from '../useAssistant.js';
import styles from '../Assistant.module.css';

const MAX_SOURCES = 6;

/** Propositions lisibles d'un brouillon : texte seul, ou une entrée par langue pour une traduction. */
function propositionsDe(brouillon, source) {
  const { contenu } = brouillon;
  if (typeof contenu === 'string') return contenu.trim() ? [{ cle: `b${brouillon.id}`, brouillon, nom: source?.nom || '', langue: '', texte: contenu }] : [];
  if (contenu && typeof contenu === 'object') {
    return Object.entries(contenu)
      // Le français est la langue de référence : jamais proposé comme traduction.
      .filter(([langue, texte]) => langue !== 'fr' && typeof texte === 'string' && texte.trim())
      .map(([langue, texte]) => ({ cle: `b${brouillon.id}-${langue}`, brouillon, nom: source?.nom || '', source, langue, texte }));
  }
  return [];
}

export default function BoutonBrouillonIA({ type, cibleId, textes = [], contexte, libelle, libelleCopie, surCopie }) {
  const { t } = useTraduction();
  const disponible = useAssistantDisponible();
  const idVolet = useId();
  const [phase, setPhase] = useState('repos'); // repos | chargement | pret
  const [erreur, setErreur] = useState(null);
  const [brouillons, setBrouillons] = useState([]); // [{ brouillon, source }]
  const [edits, setEdits] = useState({});
  const [traites, setTraites] = useState({}); // id de brouillon -> état déjà envoyé au serveur
  const [annonce, setAnnonce] = useState('');
  const controleur = useRef(null);

  useEffect(() => () => controleur.current?.abort(), []);

  if (!disponible) return null;

  const sources = type === 'traduction'
    ? textes.filter((s) => String(s.texte || '').trim()).slice(0, MAX_SOURCES)
    : [];
  const sansTexte = type === 'traduction' && sources.length === 0;

  async function proposer() {
    controleur.current?.abort();
    const c = new AbortController();
    controleur.current = c;
    setPhase('chargement');
    setErreur(null);
    setAnnonce(t('assistant.volet.redaction'));
    setEdits({});
    setTraites({});
    try {
      const obtenus = [];
      if (type === 'traduction') {
        for (const source of sources) {
          const b = await creerBrouillon({ type, texte: source.texte, ...(contexte ? { contexte } : {}) }, { signal: c.signal });
          obtenus.push({ brouillon: b, source });
        }
      } else {
        obtenus.push({ brouillon: await creerBrouillon({ type, cible_id: cibleId }, { signal: c.signal }), source: null });
      }
      if (c.signal.aborted) return;
      setBrouillons(obtenus);
      setPhase('pret');
      setAnnonce(t('assistant.volet.pret'));
    } catch (e) {
      if (c.signal.aborted || e?.name === 'AbortError') return;
      setErreur(messageErreurAssistant(e));
      setPhase('repos');
      setAnnonce('');
    }
  }

  function fermer() {
    controleur.current?.abort();
    setPhase('repos');
    setErreur(null);
    setAnnonce('');
  }

  const propositions = brouillons.flatMap(({ brouillon, source }) => propositionsDe(brouillon, source));
  const courant = (p) => edits[p.cle] ?? p.texte;

  /** Enregistre l'état du brouillon auprès du serveur (sans toucher au contenu réel) ; une erreur n'empêche pas la copie. */
  async function marquer(brouillon, etat) {
    if (traites[brouillon.id]) return;
    setTraites((s) => ({ ...s, [brouillon.id]: etat }));
    try {
      const doncontenu = etat === 'modifie';
      let contenu;
      if (doncontenu) {
        const siens = propositions.filter((p) => p.brouillon.id === brouillon.id);
        contenu = typeof brouillon.contenu === 'string' ? courant(siens[0]) : Object.fromEntries(siens.map((p) => [p.langue, courant(p)]));
      }
      await traiterBrouillon(brouillon.id, { etat, ...(doncontenu ? { contenu } : {}) });
    } catch {
      /* le texte est déjà copié : le suivi du brouillon reste « proposé » */
    }
  }

  function copier(liste) {
    surCopie?.(liste.map((p) => ({ nom: p.nom, langue: p.langue, texte: courant(p) })));
    const touches = [...new Map(liste.map((p) => [p.brouillon.id, p.brouillon])).values()];
    touches.forEach((b) => {
      const modifie = propositions.some((p) => p.brouillon.id === b.id && courant(p) !== p.texte);
      marquer(b, modifie ? 'modifie' : 'accepte');
    });
    setAnnonce(t('assistant.volet.copie'));
  }

  async function rejeter() {
    await Promise.all(brouillons.map(({ brouillon }) => marquer(brouillon, 'rejete')));
    fermer();
    setAnnonce(t('assistant.volet.rejete'));
  }

  const codes = [...new Set(brouillons.map(({ brouillon }) => brouillon.bloque).filter(Boolean))];
  const ouvert = phase === 'pret';

  return (
    <div className={styles.zoneBouton}>
      <Bouton variante="contour" chargement={phase === 'chargement'} disabled={sansTexte}
        aria-expanded={ouvert} aria-controls={ouvert ? idVolet : undefined}
        aria-describedby={sansTexte ? `${idVolet}-vide` : undefined} onClick={proposer}>
        {libelle}
      </Bouton>
      {sansTexte && <span id={`${idVolet}-vide`} className={styles.aideBouton}>{t('assistant.bouton.francaisVide')}</span>}
      <p role="status" aria-live="polite" className={annonce ? styles.annonceBouton : 'visuellement-cache'}>{annonce}</p>
      {erreur && <p className={styles.erreurBouton} role="alert">{erreur}</p>}

      {ouvert && (
        <section id={idVolet} className={`carte ${styles.volet}`} aria-labelledby={`${idVolet}-titre`}>
          <h4 id={`${idVolet}-titre`} className={styles.titreVolet}>{t('assistant.volet.titre')}</h4>
          <p className={styles.avertissement}>{t('assistant.avertissement')}</p>
          <p className={styles.aideVolet}>{t('assistant.volet.aide')}</p>
          {codes.map((code) => (
            <p key={code} className={styles.alerteGarde} role="alert">{t('assistant.volet.controle', { motif: libelleGardeFou(code) })}</p>
          ))}
          {propositions.length === 0 && <p>{t('assistant.volet.vide')}</p>}
          {propositions.map((p) => {
            const intitule = [p.source?.libelle, p.langue && infosLangue(p.langue).nom].filter(Boolean).join(' · ')
              || t('assistant.volet.textePropose');
            return (
              <div key={p.cle} className={styles.proposition}>
                <Champ libelle={intitule} name={`brouillon-${p.cle}`} multiligne rows={p.langue ? 3 : 7} value={courant(p)}
                  lang={p.langue ? infosLangue(p.langue).html : undefined}
                  onChange={(e) => setEdits((s) => ({ ...s, [p.cle]: e.target.value }))} />
                <div>
                  <Bouton variante="contour" taille="petit" onClick={() => copier([p])}
                    aria-label={intitule && p.langue ? `${libelleCopie} : ${intitule}` : undefined}>
                    {libelleCopie}
                  </Bouton>
                </div>
              </div>
            );
          })}
          <div className={styles.actionsVolet}>
            {propositions.length > 1 && (
              <Bouton onClick={() => copier(propositions)}>{t('assistant.volet.toutCopier')}</Bouton>
            )}
            <Bouton variante="texte" onClick={rejeter}>{t('assistant.volet.rejeter')}</Bouton>
            <Bouton variante="texte" onClick={fermer}>{t('assistant.volet.fermer')}</Bouton>
          </div>
        </section>
      )}
    </div>
  );
}
