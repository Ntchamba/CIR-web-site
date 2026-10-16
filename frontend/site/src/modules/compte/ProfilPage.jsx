// Mon compte : coordonnées et adresse (obligatoire pour commander), déconnexion.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { erreursChamps } from '@partage/api/client.js';
import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import usePageMeta from '@partage/utils/usePageMeta.js';

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
  usePageMeta('Mon compte');
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
      setEtat({ envoi: false, erreur: 'Certaines informations manquent. Vérifiez le formulaire.', ok: false });
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
      <h1 className={`titre-page ${styles.titreProfil}`}>Mon compte</h1>
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
              ? 'Adresse renseignée : vous pouvez commander.'
              : 'Ajoutez votre adresse complète pour pouvoir commander.'}
          </p>
          {peutCommander && utilisateur.adresse_formatee && (
            <p className={styles.adresseLigne}>{utilisateur.adresse_formatee}</p>
          )}
          <div className={styles.liens}>
            <Bouton as={Link} to="/commandes" variante="texte">Mes commandes</Bouton>
            <Bouton variante="texte" onClick={deconnecter}>Se déconnecter</Bouton>
          </div>
        </section>

        <form className={`${styles.carte} ${styles.champs}`} onSubmit={enregistrer} noValidate>
          <h2>Coordonnées et adresse</h2>
          <Champ libelle="Nom complet" name="nom_complet" value={form.nom_complet} onChange={changer}
            erreur={erreurs.nom_complet} autoComplete="name" required />
          <Champ libelle="E-mail" name="email" type="email" value={utilisateur.email} readOnly
            aide="Pour changer d'adresse e-mail, contactez notre équipe." />
          <Champ libelle="Téléphone" name="telephone" type="tel" value={form.telephone} onChange={changer}
            erreur={erreurs.telephone} autoComplete="tel" />
          <FormulaireAdresse valeur={extraireAdresse(form)} onChange={changerAdresse} erreurs={erreurs} />
          <MessageErreur erreur={etat.erreur} />
          {etat.ok && <p className={styles.ok} role="status">Modifications enregistrées.</p>}
          <Bouton type="submit" chargement={etat.envoi}>Enregistrer</Bouton>
        </form>
      </div>
    </div>
  );
}
