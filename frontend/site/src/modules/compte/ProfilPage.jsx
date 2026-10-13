// Mon compte : coordonnées et adresse (obligatoire pour commander), déconnexion.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Bouton from '@/components/ui/Bouton.jsx';
import Champ from '@/components/ui/Champ.jsx';
import MessageErreur from '@/components/ui/MessageErreur.jsx';
import usePageMeta from '@/hooks/usePageMeta.js';

import { useAuth } from './AuthContext.jsx';
import FormulaireAdresse, { ADRESSE_VIDE } from './FormulaireAdresse.jsx';
import styles from './Compte.module.css';

export default function ProfilPage() {
  usePageMeta('Mon compte');
  const { utilisateur, mettreAJour, seDeconnecter } = useAuth();
  const naviguer = useNavigate();
  const [profil, setProfil] = useState({ nom_complet: utilisateur.nom_complet, telephone: utilisateur.telephone });
  const [adresse, setAdresse] = useState(utilisateur.adresse || ADRESSE_VIDE);
  const [etat, setEtat] = useState({ envoi: false, erreur: null, ok: false });

  async function enregistrer(e) {
    e.preventDefault();
    setEtat({ envoi: true, erreur: null, ok: false });
    try {
      await mettreAJour({ ...profil, adresse });
      setEtat({ envoi: false, erreur: null, ok: true });
    } catch (erreur) {
      setEtat({ envoi: false, erreur, ok: false });
    }
  }

  return (
    <div className="conteneur section">
      <h1 className="titre-page" style={{ marginBottom: 32 }}>Mon compte</h1>
      <div className={styles.profil}>
        <section className={styles.carte}>
          <div className={styles.identite}>
            <span className={styles.initiales}>
              {utilisateur.nom_complet.split(' ').map((m) => m[0]).slice(0, 2).join('').toUpperCase()}
            </span>
            <div>
              <h2>{utilisateur.nom_complet}</h2>
              <span>{utilisateur.email}</span>
            </div>
          </div>
          <p className={utilisateur.a_une_adresse ? styles.ok : styles.manque}>
            {utilisateur.a_une_adresse ? 'Adresse renseignée : vous pouvez commander.'
              : 'Ajoutez votre adresse pour pouvoir commander.'}
          </p>
          <div className={styles.liens}>
            <Bouton vers="/commandes" variante="texte">Mes commandes</Bouton>
            <Bouton vers="/messagerie" variante="texte">Ma messagerie</Bouton>
            <Bouton variante="texte" onClick={async () => { await seDeconnecter(); naviguer('/'); }}>
              Se déconnecter
            </Bouton>
          </div>
        </section>

        <form className={styles.carte} onSubmit={enregistrer}>
          <h2>Coordonnées et adresse</h2>
          <Champ libelle="Nom complet" value={profil.nom_complet}
            onChange={(e) => setProfil({ ...profil, nom_complet: e.target.value })} />
          <Champ libelle="Téléphone" type="tel" value={profil.telephone}
            onChange={(e) => setProfil({ ...profil, telephone: e.target.value })} />
          <FormulaireAdresse valeur={adresse} onChange={setAdresse} />
          <MessageErreur erreur={etat.erreur} />
          {etat.ok && <p className={styles.ok} role="status">Modifications enregistrées.</p>}
          <Bouton type="submit" chargement={etat.envoi}>Enregistrer</Bouton>
        </form>
      </div>
    </div>
  );
}
