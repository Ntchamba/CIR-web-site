// Mon compte : coordonnées et adresse (obligatoire pour commander), déconnexion.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { erreursChamps } from '@partage/api/client.js';
import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import usePageMeta from '@partage/utils/usePageMeta.js';

import { useTraduction } from '@/i18n/index.js';

import { adresseComplete, extraireAdresse, initialesDe } from './adresse.js';
import { useAuth } from './AuthContext.jsx';
import FormulaireAdresse from './FormulaireAdresse.jsx';
import { validerProfil } from './validation.js';
import styles from './Compte.module.css';

const depuisUtilisateur = (u) => ({
  nom_complet: u.nom_complet || '',
  telephone: u.telephone || '',
  ...extraireAdresse(u),
});

export default function ProfilPage() {
  const { t } = useTraduction();
  usePageMeta(t('compte.profil.titre'));
  const { utilisateur, mettreAJour, seDeconnecter } = useAuth();
  const naviguer = useNavigate();
  const [form, setForm] = useState(() => depuisUtilisateur(utilisateur));
  const [erreurs, setErreurs] = useState({});
  const [etat, setEtat] = useState({ envoi: false, erreur: null, ok: false });

  const changer = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const changerAdresse = (adresse) => setForm((f) => ({ ...f, ...adresse }));
  const initiales = initialesDe(utilisateur);
  const nomComplet = utilisateur.nom_complet || utilisateur.email;
  const peutCommander = adresseComplete(utilisateur);

  async function enregistrer(e) {
    e.preventDefault();
    const locales = validerProfil(form);
    setErreurs(locales);
    if (Object.keys(locales).length) {
      setEtat({ envoi: false, erreur: t('compte.profil.incomplet'), ok: false });
      return;
    }
    setEtat({ envoi: true, erreur: null, ok: false });
    try {
      const u = await mettreAJour(Object.fromEntries(Object.entries(form).map(([c, v]) => [c, v.trim()])));
      setForm(depuisUtilisateur(u));
      setEtat({ envoi: false, erreur: null, ok: true });
    } catch (erreur) {
      setErreurs(erreursChamps(erreur));
      setEtat({ envoi: false, erreur, ok: false });
    }
  }

  async function deconnecter() {
    await seDeconnecter();
    naviguer('/', { replace: true });
  }

  return (
    <div className="conteneur section">
      <h1 className={`titre-page ${styles.titreProfil}`}>{t('compte.profil.titre')}</h1>
      <div className={styles.profil}>
        <section className={styles.carte} aria-labelledby="identite">
          <div className={styles.identite}>
            <span className={styles.initiales} aria-hidden="true">{initiales}</span>
            <div>
              <h2 id="identite">{nomComplet}</h2>
              <span className={styles.email}>{utilisateur.email}</span>
            </div>
          </div>
          <p className={peutCommander ? styles.ok : styles.manque}>
            {peutCommander
              ? t('compte.profil.peutCommander')
              : t('compte.profil.adresseManquante')}
          </p>
          {peutCommander && utilisateur.adresse_formatee && (
            <p className={styles.adresseLigne}>{utilisateur.adresse_formatee}</p>
          )}
          <div className={styles.liens}>
            <Bouton as={Link} to="/commandes" variante="texte">{t('compte.profil.mesCommandes')}</Bouton>
            <Bouton variante="texte" onClick={deconnecter}>{t('compte.profil.seDeconnecter')}</Bouton>
          </div>
        </section>

        <form className={`${styles.carte} ${styles.champs}`} onSubmit={enregistrer} noValidate>
          <h2>{t('compte.profil.coordonneesEtAdresse')}</h2>
          <Champ libelle={t('compte.champs.nomComplet')} name="nom_complet" value={form.nom_complet} onChange={changer}
            erreur={erreurs.nom_complet} autoComplete="name" required />
          <Champ libelle={t('compte.champs.email')} name="email" type="email" value={utilisateur.email} readOnly
            aide={t('compte.aides.emailFixe')} />
          <Champ libelle={t('compte.champs.telephone')} name="telephone" type="tel" value={form.telephone} onChange={changer}
            erreur={erreurs.telephone} autoComplete="tel" />
          <FormulaireAdresse valeur={extraireAdresse(form)} onChange={changerAdresse} erreurs={erreurs} />
          <MessageErreur erreur={etat.erreur} />
          {etat.ok && <p className={styles.ok} role="status">{t('compte.profil.enregistre')}</p>}
          <Bouton type="submit" chargement={etat.envoi}>{t('compte.profil.enregistrer')}</Bouton>
        </form>
      </div>
    </div>
  );
}
