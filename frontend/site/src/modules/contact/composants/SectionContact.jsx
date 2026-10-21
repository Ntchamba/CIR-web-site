// BF-11, BF-13 : formulaire de contact (question ou demande de rappel), en bas de l'accueil et sur /contact.
// Visiteur ou client ; champ piège `site_web` masqué ; préremplissage depuis le compte ; erreurs sous les champs.
import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router';

import { erreursChamps } from '@partage/api/client.js';
import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';

import { useTraduction } from '@/i18n/index.js';
import { useCoordonnees } from '@/layout/contenus.js';
import { useAuth } from '@/modules/compte/AuthContext.jsx';

import { envoyer } from '../api.js';
import { corpsContact, CRENEAUX, MESSAGE_MAX, MESSAGE_MIN, TYPES_CONTACT, validerContact } from '../regles.js';
import styles from '../Contact.module.css';

const VIDE = { nom: '', email: '', telephone: '', type: 'question', creneau: 'peu_importe', message: '', site_web: '' };

/** `produit` : id du produit concerné (facultatif) ; `niveau` : niveau du titre (2 par défaut). */
export default function SectionContact({ produit = null, niveau = 2, className = '', salle = false }) {
  const { t } = useTraduction();
  const { telephones, whatsapp, adresse } = useCoordonnees();
  const { utilisateur } = useAuth();
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
      const reponse = await envoyer(corpsContact(form, produit));
      setForm((f) => ({ ...f, message: '', site_web: '' }));
      setEtat({ envoi: false, erreur: null, reference: reponse?.reference || '-' });
    } catch (erreur) {
      setErreurs(erreursChamps(erreur));
      setEtat({ envoi: false, erreur: erreur?.statut === 429 ? t('contact.erreurs.quota') : erreur, reference: '' });
    }
  }

  return (
    <section id={salle ? 'contact' : undefined} className={`${styles.section} ${salle ? `salle salle-nuit ${styles.nuit}` : ''} ${className}`}
      aria-labelledby={`${id}-titre`}>
      <div className={`conteneur ${styles.contenu}`}>
        <div className={`${styles.texte} ${salle ? 'p3d' : ''}`}>
          <Titre id={`${id}-titre`}>{t('contact.titre')}</Titre>
          <p>{t('contact.intro')}</p>
          {salle && (
            <div className={styles.coordonnees}>
              {adresse && <span>{adresse}</span>}
              {telephones.map((tel) => <a key={tel.lien} href={tel.lien}>{t('pied.telephone', { numero: tel.affichage })}</a>)}
              <a href={whatsapp.lien} target="_blank" rel="noopener noreferrer">{t('pied.whatsapp', { numero: whatsapp.affichage })}</a>
            </div>
          )}
        </div>

        <form className={`${styles.formulaire} ${salle ? 'p3d-grand' : ''}`} onSubmit={soumettre} noValidate>
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

          <fieldset className={styles.choix}>
            <legend>{t('contact.type.legende')}</legend>
            {TYPES_CONTACT.map((v) => (
              <label key={v}>
                <input type="radio" name="type" value={v} checked={form.type === v} onChange={changer} />
                <span>{t(`contact.type.${v}`)}</span>
              </label>
            ))}
          </fieldset>

          <div className={styles.deuxColonnes}>
            <Champ libelle={t('compte.champs.nomComplet')} name="nom" value={form.nom} onChange={changer} erreur={erreurs.nom}
              autoComplete="name" required={!utilisateur} />
            <Champ libelle={t('compte.champs.telephone')} name="telephone" type="tel" value={form.telephone} onChange={changer}
              erreur={erreurs.telephone} autoComplete="tel" required={form.type === 'rappel' && !utilisateur?.telephone}
              placeholder={t('compte.exemples.telephone')} />
          </div>
          <Champ libelle={t('compte.champs.email')} name="email" type="email" value={form.email} onChange={changer}
            erreur={erreurs.email} autoComplete="email" aide={utilisateur ? undefined : t('contact.aideCoordonnees')} />

          {form.type === 'rappel' && (
            <Champ libelle={t('contact.creneau.libelle')} name="creneau" value={form.creneau} onChange={changer}
              erreur={erreurs.creneau} options={CRENEAUX.map((c) => [c, t(`contact.creneau.${c}`)])} />
          )}

          <Champ libelle={t('contact.message')} name="message" multiligne required maxLength={MESSAGE_MAX}
            value={form.message} onChange={changer} erreur={erreurs.message}
            aide={t('contact.aideMessage', { n: form.message.trim().length, min: MESSAGE_MIN, max: MESSAGE_MAX })} />

          {/* Champ piège contre les robots : hors écran, ignoré des lecteurs d'écran et du clavier, laissé vide par un humain. */}
          <div className={styles.piege} aria-hidden="true">
            <label>
              {t('contact.piege')}
              <input type="text" name="site_web" value={form.site_web} onChange={changer} tabIndex={-1} autoComplete="off" />
            </label>
          </div>

          <div aria-live="polite"><MessageErreur erreur={etat.erreur} /></div>
          <Bouton type="submit" chargement={etat.envoi}>{t('contact.envoyer')}</Bouton>
        </form>
      </div>
    </section>
  );
}
