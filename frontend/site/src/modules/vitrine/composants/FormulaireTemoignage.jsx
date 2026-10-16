// BF-04 : un client connecté laisse un témoignage (publié après validation par l'équipe).
// Visiteur : lien vers la connexion, avec retour sur cette page (?suite=).
import { useState } from 'react';
import { Link, useLocation } from 'react-router';

import { erreursChamps } from '@partage/api/client.js';
import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';

import { useTraduction } from '@/i18n/index.js';
import { useAuth } from '@/modules/compte/AuthContext.jsx';
import { USAGES } from '@/modules/catalogue/usages.js';

import { envoyerTemoignage } from '../api.js';
import { TEXTE_MAX, TEXTE_MIN, validerTemoignage } from '../regles.js';
import { useMesTemoignages } from '../useVitrine.js';
import { attributLang } from './Temoignages.jsx';
import styles from '../Vitrine.module.css';

const VIDE = { texte: '', note: '', ville: '', type_chantier: '' };

function MesTemoignages({ etat }) {
  const { t } = useTraduction();
  const liste = Array.isArray(etat.donnees) ? etat.donnees : etat.donnees?.results || [];
  if (!liste.length) return null;
  return (
    <div className={styles.miens}>
      <h4>{t('vitrine.formulaire.miens')}</h4>
      <ul>
        {liste.map((tm) => (
          <li key={tm.id}>
            <span className={`${styles.statut} ${styles[`statut_${tm.statut}`] || ''}`}>
              {t(`vitrine.formulaire.statuts.${tm.statut}`)}
            </span>
            <span className={styles.extrait} lang={attributLang(tm.langue)}>{tm.texte}</span>
            {tm.statut === 'refuse' && tm.motif_refus && (
              <span className={styles.motif}>{t('vitrine.formulaire.motif', { motif: tm.motif_refus })}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function FormulaireTemoignage() {
  const { t } = useTraduction();
  const { utilisateur, pret } = useAuth();
  const { pathname, search } = useLocation();
  const mesTemoignages = useMesTemoignages(Boolean(utilisateur));
  const [form, setForm] = useState(VIDE);
  const [erreurs, setErreurs] = useState({});
  const [etat, setEtat] = useState({ envoi: false, erreur: null, envoye: false });

  if (!pret) return null;

  if (!utilisateur) {
    const suite = encodeURIComponent(`${pathname}${search}`);
    return (
      <div className={styles.formulaire}>
        <h3>{t('vitrine.formulaire.titre')}</h3>
        <p>{t('vitrine.formulaire.connexionRequise')}</p>
        <Bouton as={Link} to={`/connexion?suite=${suite}`} variante="contour">{t('vitrine.formulaire.seConnecter')}</Bouton>
      </div>
    );
  }

  const changer = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function envoyer(e) {
    e.preventDefault();
    const locales = validerTemoignage(form);
    setErreurs(locales);
    if (Object.keys(locales).length) {
      setEtat({ envoi: false, erreur: t('vitrine.formulaire.erreurs.incomplet'), envoye: false });
      return;
    }
    setEtat({ envoi: true, erreur: null, envoye: false });
    const donnees = { texte: form.texte.trim(), note: Number(form.note) };
    if (form.ville.trim()) donnees.ville = form.ville.trim();
    if (form.type_chantier) donnees.type_chantier = form.type_chantier;
    try {
      await envoyerTemoignage(donnees);
      setForm(VIDE);
      setErreurs({});
      setEtat({ envoi: false, erreur: null, envoye: true });
      mesTemoignages.recharger();
    } catch (erreur) {
      setErreurs(erreursChamps(erreur));
      setEtat({ envoi: false, erreur, envoye: false });
    }
  }

  const longueur = form.texte.trim().length;
  return (
    <div className={styles.formulaire}>
      <h3>{t('vitrine.formulaire.titre')}</h3>
      {etat.envoye && (
        <div className={styles.succes} role="status">
          <strong>{t('vitrine.formulaire.merci')}</strong>
          <p>{t('vitrine.formulaire.enAttente')}</p>
        </div>
      )}
      <form onSubmit={envoyer} noValidate className={styles.champs}>
        <fieldset className={styles.note} aria-describedby={erreurs.note ? 'note-erreur' : undefined}>
          <legend>{t('vitrine.formulaire.note')}<span className={styles.obligatoire} aria-hidden="true"> *</span></legend>
          <div className={styles.choixNote}>
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className={styles.etoileChoix}>
                <input type="radio" name="note" value={n} checked={Number(form.note) === n} onChange={changer}
                  className="visuellement-cache" />
                <span aria-hidden="true" className={Number(form.note) >= n ? styles.etoilePleine : ''}>★</span>
                <span className="visuellement-cache">{t('vitrine.temoignages.note', { n })}</span>
              </label>
            ))}
          </div>
          {erreurs.note && <span id="note-erreur" className={styles.erreurChamp}>{erreurs.note}</span>}
        </fieldset>
        <Champ libelle={t('vitrine.formulaire.texte')} name="texte" multiligne required value={form.texte}
          onChange={changer} erreur={erreurs.texte} maxLength={TEXTE_MAX}
          aide={t('vitrine.formulaire.aideTexte', { n: longueur, min: TEXTE_MIN, max: TEXTE_MAX })} />
        <div className={styles.deuxColonnes}>
          <Champ libelle={t('vitrine.formulaire.ville')} name="ville" value={form.ville} onChange={changer}
            erreur={erreurs.ville} placeholder={utilisateur.ville || ''} autoComplete="address-level2" />
          <Champ libelle={t('vitrine.formulaire.type')} name="type_chantier" value={form.type_chantier}
            onChange={changer} erreur={erreurs.type_chantier}
            options={[['', t('vitrine.formulaire.typeAucun')], ...USAGES.map((u) => [u, t(`usages.${u}`)])]} />
        </div>
        <MessageErreur erreur={etat.erreur} />
        <Bouton type="submit" chargement={etat.envoi}>{t('vitrine.formulaire.envoyer')}</Bouton>
      </form>
      <MesTemoignages etat={mesTemoignages} />
    </div>
  );
}
