// BF-11, BF-13 : section Contact de la maquette (fond d'encre : texte et coordonnées à gauche, formulaire blanc à droite),
// en bas de l'accueil et sur /contact. Visiteur ou client ; champ piège `site_web` masqué ; préremplissage depuis le compte ;
// erreurs sous les champs. « Votre projet concerne » (maison, industrie, entreprise) est ajouté en tête du message.
import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router';

import { erreursChamps } from '@partage/api/client.js';
import Champ from '@partage/ui/Champ.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';

import { useTraduction } from '@/i18n/index.js';
import { useCoordonnees } from '@/layout/contenus.js';
import { useAuth } from '@/modules/compte/AuthContext.jsx';

import { envoyer } from '../api.js';
import { corpsContact, CRENEAUX, MESSAGE_MAX, MESSAGE_MIN, TYPES_CONTACT, validerContact } from '../regles.js';
import styles from '../Contact.module.css';

const PROJETS = ['maison', 'industrie', 'entreprise'];
const VIDE = { nom: '', email: '', telephone: '', type: 'question', creneau: 'peu_importe', message: '', site_web: '', projet: 'maison' };

/** `niveau` : niveau du titre (2 sur l'accueil, 1 sur la page Contact) ; `produit` : id du produit concerné (facultatif). */
export default function SectionContact({ produit = null, niveau = 2, className = '', id: ancre = 'contact', enfants = null }) {
  const { t } = useTraduction();
  const { utilisateur } = useAuth();
  const { telephones, whatsapp, adresse } = useCoordonnees();
  const id = useId();
  const Titre = `h${niveau}`;
  const [form, setForm] = useState(VIDE);
  const [erreurs, setErreurs] = useState({});
  const [etat, setEtat] = useState({ envoi: false, erreur: null, reference: '' });

  // Les coordonnées du compte remplissent les champs encore vides (une saisie du visiteur n'est jamais écrasée).
  useEffect(() => {
    if (!utilisateur) return;
    setForm((f) => ({
      ...f,
      nom: f.nom || utilisateur.nom_complet || '',
      email: f.email || utilisateur.email || '',
      telephone: f.telephone || utilisateur.telephone || '',
    }));
  }, [utilisateur]);

  const changer = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function soumettre(e) {
    e.preventDefault();
    const locales = validerContact(form, Boolean(utilisateur), Boolean(utilisateur?.telephone));
    setErreurs(locales);
    if (Object.keys(locales).length) {
      setEtat({ envoi: false, erreur: t('contact.erreurs.incomplet'), reference: '' });
      return;
    }
    setEtat({ envoi: true, erreur: null, reference: '' });
    try {
      const prefixe = form.projet ? t('contact.projetPrefixe', { projet: t(`contact.projets.${form.projet}`) }) : '';
      const reponse = await envoyer(corpsContact(form, produit, prefixe));
      setForm((f) => ({ ...f, message: '', site_web: '' }));
      setEtat({ envoi: false, erreur: null, reference: reponse?.reference || '-' });
    } catch (erreur) {
      setErreurs(erreursChamps(erreur));
      setEtat({ envoi: false, erreur: erreur?.statut === 429 ? t('contact.erreurs.quota') : erreur, reference: '' });
    }
  }

  return (
    <section id={ancre} className={`m-section nuit ${className}`} aria-labelledby={`${id}-titre`}>
      <div className="m-conteneur m-contact">
        <div className="p3d">
          <span className="m-surtitre" style={{ color: '#8fb8cc' }}>{t('contact.surtitre')}</span>
          <Titre id={`${id}-titre`} style={{ marginTop: 10 }}>{t('contact.titre')}</Titre>
          <p className="intro">{t('contact.intro')}</p>
          <dl className="m-coord">
            <div><dt>{t('contact.adresse')}</dt><dd>{adresse}</dd></div>
            <div>
              <dt>{t('contact.telephone')}</dt>
              <dd>{telephones.map((tel, i) => <span key={tel.lien}>{i > 0 && <br />}<a href={tel.lien}>{tel.affichage}</a></span>)}</dd>
            </div>
            <div><dt>{t('contact.whatsapp')}</dt><dd><a href={whatsapp.lien} target="_blank" rel="noopener noreferrer">{whatsapp.affichage}</a></dd></div>
          </dl>
          <p style={{ marginTop: 30 }}>
            <a className="m-btn bleu" href={whatsapp.lien} target="_blank" rel="noopener noreferrer">{t('contact.ecrireWhatsapp')}</a>
          </p>
          {enfants}
        </div>

        <form className="m-formulaire p3d-grand" onSubmit={soumettre} noValidate>
          <div role="status" aria-live="polite">
            {etat.reference && (
              <div className={styles.succes}>
                <strong>{t('contact.merci')}</strong>
                <p>
                  {etat.reference !== '-' && `${t('contact.reference', { reference: etat.reference })} `}
                  {t(form.type === 'rappel' ? 'contact.succesRappel' : 'contact.succesQuestion')}
                </p>
                {utilisateur && <Link to="/mes-demandes">{t('contact.voirMesDemandes')}</Link>}
              </div>
            )}
          </div>

          <div className="deux">
            <Champ libelle={t('compte.champs.nomComplet')} name="nom" value={form.nom} onChange={changer} erreur={erreurs.nom}
              autoComplete="name" required={!utilisateur} />
            <Champ libelle={t('contact.telephoneOuWhatsapp')} name="telephone" type="tel" value={form.telephone} onChange={changer}
              erreur={erreurs.telephone} autoComplete="tel" required={form.type === 'rappel' && !utilisateur?.telephone} />
          </div>
          <Champ libelle={t('compte.champs.email')} name="email" type="email" value={form.email} onChange={changer}
            erreur={erreurs.email} autoComplete="email" aide={utilisateur ? undefined : t('contact.aideCoordonnees')} />
          <Champ libelle={t('contact.projet')} name="projet" value={form.projet} onChange={changer}
            options={PROJETS.map((p) => [p, t(`contact.projets.${p}`)])} />

          <fieldset className={styles.choix}>
            <legend>{t('contact.type.legende')}</legend>
            {TYPES_CONTACT.map((v) => (
              <label key={v}>
                <input type="radio" name="type" value={v} checked={form.type === v} onChange={changer} />
                <span>{t(`contact.type.${v}`)}</span>
              </label>
            ))}
          </fieldset>
          {form.type === 'rappel' && (
            <Champ libelle={t('contact.creneau.libelle')} name="creneau" value={form.creneau} onChange={changer}
              erreur={erreurs.creneau} options={CRENEAUX.map((c) => [c, t(`contact.creneau.${c}`)])} />
          )}

          <Champ libelle={t('contact.message')} name="message" multiligne required maxLength={MESSAGE_MAX}
            value={form.message} onChange={changer} erreur={erreurs.message} placeholder={t('contact.messageExemple')}
            aide={t('contact.aideMessage', { n: form.message.trim().length, min: MESSAGE_MIN, max: MESSAGE_MAX })} />

          {/* Champ piège contre les robots : hors écran, ignoré des lecteurs d'écran et du clavier, laissé vide par un humain. */}
          <div className={styles.piege} aria-hidden="true">
            <label>
              {t('contact.piege')}
              <input type="text" name="site_web" value={form.site_web} onChange={changer} tabIndex={-1} autoComplete="off" />
            </label>
          </div>

          <div aria-live="polite"><MessageErreur erreur={etat.erreur} /></div>
          <button type="submit" className="m-btn plein" disabled={etat.envoi} aria-busy={etat.envoi || undefined}>{t('contact.envoyer')}</button>
        </form>
      </div>
    </section>
  );
}
