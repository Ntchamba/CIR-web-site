// BF-07 : modèles d'e-mails (super-administrateur). Un événement et une langue à la fois : le texte par défaut
// reste visible, le sujet et l'introduction se modifient (variables autorisées indiquées), aperçu, rétablir.
import { useEffect, useMemo, useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { LANGUES } from '@partage/i18n/langues.js';

import ConfirmerAction from '@/composants/ConfirmerAction.jsx';
import useChargement from '@/composants/useChargement.js';
import gestion from '@/composants/Gestion.module.css';
import { erreursChamps } from '@/app/api.js';
import { existe, useTraduction } from '@/i18n/index.js';

import { apercuModele, enregistrerModele, listerModeles, retablirModele } from './api.js';
import { LIMITES, normaliserModeles, VARIABLES, variablesInconnues } from './modeles.js';
import styles from './Notifications.module.css';

export default function ModelesEmailsPage() {
  const { t } = useTraduction();
  const { donnees, setDonnees, chargement, erreur, recharger } = useChargement((signal) => listerModeles({ signal }), []);
  const evenements = useMemo(() => normaliserModeles(donnees), [donnees]);
  const [evenement, setEvenement] = useState('');
  const [langue, setLangue] = useState('fr');
  const [sujet, setSujet] = useState('');
  const [introduction, setIntroduction] = useState('');
  const [erreurs, setErreurs] = useState({});
  const [message, setMessage] = useState('');
  const [echec, setEchec] = useState(null);
  const [apercu, setApercu] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  const courant = evenements.find((e) => e.evenement === (evenement || evenements[0]?.evenement));
  const cle = courant?.evenement || '';
  const fiche = courant?.langues[langue] || { defaut: { sujet: '', introduction: '' }, modele: null };
  const enregistre = fiche.modele;

  // Le brouillon repart du modèle enregistré, sinon du texte par défaut, à chaque changement d'événement ou de langue.
  useEffect(() => {
    setSujet((enregistre || fiche.defaut)?.sujet || '');
    setIntroduction((enregistre || fiche.defaut)?.introduction || '');
    setErreurs({});
    setMessage('');
    setEchec(null);
    setApercu(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle, langue]);

  const libelleEvenement = (code) => (existe(`notifications.evenements.${code}`) ? t(`notifications.evenements.${code}`) : code);
  const inconnues = [...new Set([...variablesInconnues(sujet), ...variablesInconnues(introduction)])];

  async function enregistrer(e) {
    e.preventDefault();
    setMessage('');
    setEchec(null);
    if (inconnues.length) {
      setErreurs({ introduction: t('notifications.modeles.variableInconnue', { variables: inconnues.map((v) => `{${v}}`).join(', ') }) });
      return;
    }
    setEnvoi(true);
    try {
      const modele = await enregistrerModele(cle, langue, { sujet: sujet.trim(), introduction: introduction.trim() });
      majLocale({ sujet: modele?.sujet ?? sujet.trim(), introduction: modele?.introduction ?? introduction.trim() });
      setErreurs({});
      setMessage(t('notifications.modeles.enregistre'));
    } catch (err) {
      const champs = erreursChamps(err);
      if (Object.keys(champs).length) setErreurs(champs); else setEchec(err);
    } finally {
      setEnvoi(false);
    }
  }

  // Met à jour la copie locale sans relire toute la liste.
  function majLocale(modele) {
    setDonnees((d) => {
      const liste = Array.isArray(d) ? d : d?.results || [];
      const maj = liste.map((e) => {
        if (e.evenement !== cle) return e;
        const brut = e.langues ?? e.par_langue ?? {};
        if (Array.isArray(brut)) {
          return { ...e, langues: brut.map((l) => (l.langue === langue ? { ...l, modele } : l)) };
        }
        return { ...e, langues: { ...brut, [langue]: { ...brut[langue], modele } } };
      });
      return Array.isArray(d) ? maj : { ...d, results: maj };
    });
  }

  async function retablir() {
    await retablirModele(cle, langue);
    majLocale(null);
    setSujet(fiche.defaut?.sujet || '');
    setIntroduction(fiche.defaut?.introduction || '');
    setErreurs({});
    setMessage(t('notifications.modeles.retabli'));
    setApercu(null);
  }

  async function voirApercu() {
    setEchec(null);
    setErreurs({});
    try {
      setApercu(await apercuModele({ evenement: cle, langue, sujet: sujet.trim(), introduction: introduction.trim() }));
    } catch (err) {
      const champs = erreursChamps(err);
      if (Object.keys(champs).length) setErreurs(champs); else setEchec(err);
    }
  }

  if (chargement) return <Chargement texte={t('notifications.modeles.chargement')} />;
  if (erreur) return <MessageErreur erreur={erreur} reessayer={recharger} />;
  if (evenements.length === 0) return <EtatVide titre={t('notifications.modeles.aucun')} />;

  return (
    <div className={styles.modeles}>
      <p className={gestion.aide}>{t('notifications.modeles.intro')}</p>
      <div className={`carte ${gestion.filtres}`}>
        <Champ libelle={t('notifications.modeles.evenement')} name="evenement" value={cle}
          options={evenements.map((e) => [e.evenement, libelleEvenement(e.evenement)])}
          onChange={(e) => setEvenement(e.target.value)} />
        <Champ libelle={t('notifications.modeles.langue')} name="langue" value={langue}
          options={LANGUES.map((l) => [l.code, l.nom])} onChange={(e) => setLangue(e.target.value)} />
      </div>

      <section className={`carte ${styles.defaut}`} aria-labelledby="modele-defaut">
        <h2 id="modele-defaut" className={styles.titreCarte}>{t('notifications.modeles.defaut')}</h2>
        <dl className={styles.apercuTexte}>
          <dt>{t('notifications.modeles.sujet')}</dt>
          <dd lang={langue}>{fiche.defaut?.sujet || '—'}</dd>
          <dt>{t('notifications.modeles.introduction')}</dt>
          <dd lang={langue}>{fiche.defaut?.introduction || '—'}</dd>
        </dl>
        <p className={gestion.aide}>
          {enregistre ? t('notifications.modeles.personnalise') : t('notifications.modeles.nonPersonnalise')}
        </p>
      </section>

      <form className={`carte ${gestion.formulaire}`} onSubmit={enregistrer} noValidate
        aria-label={t('notifications.modeles.formulaire')}>
        <Champ libelle={t('notifications.modeles.sujet')} name="sujet" value={sujet} maxLength={LIMITES.sujet}
          lang={langue} erreur={erreurs.sujet} aide={t('notifications.modeles.compteur', { n: sujet.length, max: LIMITES.sujet })}
          onChange={(e) => setSujet(e.target.value)} />
        <Champ libelle={t('notifications.modeles.introduction')} name="introduction" multiligne rows={5} lang={langue}
          value={introduction} maxLength={LIMITES.introduction} erreur={erreurs.introduction}
          aide={t('notifications.modeles.compteur', { n: introduction.length, max: LIMITES.introduction })}
          onChange={(e) => setIntroduction(e.target.value)} />
        <p className={gestion.aide}>
          {t('notifications.modeles.variables', { liste: VARIABLES.map((v) => `{${v}}`).join(', ') })}
        </p>
        <div className={gestion.actionsFormulaire}>
          <Bouton type="submit" chargement={envoi}>{t('actions.enregistrer')}</Bouton>
          <Bouton variante="contour" onClick={voirApercu}>{t('notifications.modeles.apercu')}</Bouton>
          {enregistre && (
            <ConfirmerAction libelle={t('notifications.modeles.retablir')} question={t('notifications.modeles.confirmerRetablir')}
              libelleConfirmer={t('notifications.modeles.retablir')} surConfirmation={retablir} />
          )}
        </div>
        <div aria-live="polite">{message && <p className={gestion.succes}>{message}</p>}</div>
        {echec && <MessageErreur erreur={echec} />}
      </form>

      {apercu && (
        <section className={`carte ${styles.apercu}`} aria-labelledby="modele-apercu">
          <h2 id="modele-apercu" className={styles.titreCarte}>{t('notifications.modeles.apercu')}</h2>
          <p className={gestion.aide}>{t('notifications.modeles.apercuAide')}</p>
          <p><strong>{t('notifications.modeles.sujet')} :</strong> <span lang={langue}>{apercu.sujet}</span></p>
          {/* HTML de l'e-mail : isolé dans un cadre sans aucun droit (pas de script, pas de lien actif). */}
          <iframe title={t('notifications.modeles.apercuCadre')} sandbox="" srcDoc={apercu.corps_html || ''} className={styles.cadre} />
        </section>
      )}
    </div>
  );
}
