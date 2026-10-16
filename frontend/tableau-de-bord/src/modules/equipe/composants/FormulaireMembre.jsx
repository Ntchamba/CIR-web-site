// Formulaire d'ajout d'un membre de l'équipe. Les erreurs du serveur s'affichent sous chaque champ.
import { useState } from 'react';

import { erreursChamps } from '@partage/api/client.js';
import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';

import { OPTIONS_ROLES_EQUIPE, ROLES } from '@/modules/connexion/roles.js';

import styles from '../Equipe.module.css';

const VIDE = { nom_complet: '', email: '', telephone: '', role: ROLES.MEMBRE, mot_de_passe: '' };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Contrôles de saisie avant l'envoi (le serveur vérifie aussi la solidité du mot de passe). */
export function validerMembre(form) {
  const erreurs = {};
  if (!form.nom_complet.trim()) erreurs.nom_complet = 'Indiquez le nom complet.';
  if (!form.email.trim()) erreurs.email = "Indiquez l'e-mail.";
  else if (!EMAIL.test(form.email.trim())) erreurs.email = "Cet e-mail n'est pas valide.";
  if (form.mot_de_passe.length < 8) erreurs.mot_de_passe = 'Au moins 8 caractères.';
  return erreurs;
}

export default function FormulaireMembre({ ajouter, annuler, surAjout }) {
  const [form, setForm] = useState(VIDE);
  const [erreurs, setErreurs] = useState({});
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  const changer = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function envoyer(e) {
    e.preventDefault();
    const locales = validerMembre(form);
    setErreurs(locales);
    setErreur(null);
    if (Object.keys(locales).length) return;
    setEnvoi(true);
    try {
      const membre = await ajouter({
        ...form,
        nom_complet: form.nom_complet.trim(),
        email: form.email.trim().toLowerCase(),
        telephone: form.telephone.trim(),
      });
      setForm(VIDE);
      surAjout?.(membre);
    } catch (err) {
      const champs = erreursChamps(err);
      setErreurs(champs);
      // Message général si l'erreur ne concerne aucun champ du formulaire (droits, réseau, serveur…).
      if (!Object.keys(champs).some((cle) => cle in VIDE)) setErreur(err);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form className={`carte ${styles.formulaire}`} onSubmit={envoyer} noValidate aria-labelledby="titre-ajout">
      <h2 id="titre-ajout" className={styles.titreFormulaire}>Ajouter un membre</h2>
      <div className={styles.grille}>
        <Champ libelle="Nom complet" name="nom_complet" value={form.nom_complet} onChange={changer}
          erreur={erreurs.nom_complet} autoComplete="off" required />
        <Champ libelle="E-mail" name="email" type="email" value={form.email} onChange={changer}
          erreur={erreurs.email} autoComplete="off" inputMode="email" required />
        <Champ libelle="Téléphone" name="telephone" type="tel" value={form.telephone} onChange={changer}
          erreur={erreurs.telephone} autoComplete="off" inputMode="tel" />
        <Champ libelle="Rôle" name="role" value={form.role} onChange={changer} erreur={erreurs.role}
          options={OPTIONS_ROLES_EQUIPE} />
        <Champ libelle="Mot de passe provisoire" name="mot_de_passe" type="password" value={form.mot_de_passe}
          onChange={changer} erreur={erreurs.mot_de_passe} autoComplete="new-password"
          aide="Au moins 8 caractères. À transmettre au membre, qui pourra le changer." required />
      </div>
      <MessageErreur erreur={erreur} />
      <div className={styles.actionsFormulaire}>
        <Bouton type="submit" chargement={envoi}>Ajouter le membre</Bouton>
        <Bouton variante="texte" onClick={annuler}>Annuler</Bouton>
      </div>
    </form>
  );
}
