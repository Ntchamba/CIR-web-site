// BF-08 : se connecter ou créer un compte (avec l'adresse, nécessaire pour commander).
import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';

import Bouton from '@/components/ui/Bouton.jsx';
import Champ from '@/components/ui/Champ.jsx';
import MessageErreur from '@/components/ui/MessageErreur.jsx';
import usePageMeta from '@/hooks/usePageMeta.js';

import { useAuth } from './AuthContext.jsx';
import FormulaireAdresse, { ADRESSE_VIDE } from './FormulaireAdresse.jsx';
import styles from './Compte.module.css';

const TYPES = [['maison', 'Une maison'], ['industrie', 'Une industrie'], ['entreprise', 'Une entreprise']];

export default function ComptePage() {
  usePageMeta('Se connecter ou créer un compte');
  const { utilisateur, pret, seConnecter, sInscrire } = useAuth();
  const [parametres] = useSearchParams();
  const suite = parametres.get('suite') || '/commandes';
  const naviguer = useNavigate();
  const [onglet, setOnglet] = useState(parametres.get('onglet') === 'inscription' ? 'inscription' : 'connexion');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [form, setForm] = useState({ email: '', password: '', nom_complet: '', telephone: '', type_client: 'maison' });
  const [adresse, setAdresse] = useState(ADRESSE_VIDE);

  if (pret && utilisateur) return <Navigate to={suite} replace />;

  const changer = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function envoyer(e) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      if (onglet === 'connexion') {
        await seConnecter(form.email, form.password);
      } else {
        const adresseRemplie = adresse.ville && adresse.quartier && adresse.rue_repere;
        await sInscrire({ ...form, ...(adresseRemplie ? { adresse } : {}) });
      }
      naviguer(suite, { replace: true });
    } catch (err) {
      setErreur(err);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className={styles.page}>
      <aside className={styles.visuel}>
        <img src="/media/accueil/bandeau-maison-800.webp" alt="" width="800" height="450" />
        <div className={styles.visuelTexte}>
          <p className={styles.citation}>Votre sol, révélé<span>.</span></p>
          <p>Créez votre compte pour sélectionner vos designs, commander et suivre vos travaux.</p>
        </div>
      </aside>

      <div className={styles.formulaire}>
        <div className={styles.onglets} role="tablist" aria-label="Connexion ou inscription">
          <button type="button" role="tab" aria-selected={onglet === 'connexion'}
            className={onglet === 'connexion' ? styles.ongletActif : ''} onClick={() => setOnglet('connexion')}>
            Se connecter
          </button>
          <button type="button" role="tab" aria-selected={onglet === 'inscription'}
            className={onglet === 'inscription' ? styles.ongletActif : ''} onClick={() => setOnglet('inscription')}>
            Créer un compte
          </button>
        </div>

        <form onSubmit={envoyer} className={styles.champs} noValidate>
          {onglet === 'inscription' && (
            <>
              <Champ libelle="Nom complet" name="nom_complet" value={form.nom_complet} onChange={changer}
                autoComplete="name" required />
              <Champ libelle="Téléphone" name="telephone" type="tel" value={form.telephone} onChange={changer}
                autoComplete="tel" placeholder="+237 6XX XX XX XX" />
              <Champ libelle="Votre projet concerne" name="type_client" value={form.type_client} onChange={changer}
                options={TYPES} />
            </>
          )}
          <Champ libelle="E-mail" name="email" type="email" value={form.email} onChange={changer}
            autoComplete="email" required />
          <Champ libelle="Mot de passe" name="password" type="password" value={form.password} onChange={changer}
            autoComplete={onglet === 'connexion' ? 'current-password' : 'new-password'} required
            aide={onglet === 'inscription' ? '8 caractères au moins, pas uniquement des chiffres.' : undefined} />

          {onglet === 'inscription' && (
            <fieldset className={styles.adresse}>
              <legend>Adresse, nécessaire pour commander</legend>
              <p className={styles.aide}>Vous pourrez aussi la donner plus tard, avant votre première commande.</p>
              <FormulaireAdresse valeur={adresse} onChange={setAdresse} />
            </fieldset>
          )}

          <MessageErreur erreur={erreur} />
          <Bouton type="submit" chargement={envoi} className={styles.envoyer}>
            {onglet === 'connexion' ? 'Se connecter' : 'Créer mon compte'}
          </Bouton>
        </form>
      </div>
    </div>
  );
}
