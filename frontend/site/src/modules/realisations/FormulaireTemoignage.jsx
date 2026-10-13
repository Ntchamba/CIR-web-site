// BF-04 : un client connecté peut laisser un témoignage (publié après validation par l'équipe).
import { useState } from 'react';

import Bouton from '@/components/ui/Bouton.jsx';
import Champ from '@/components/ui/Champ.jsx';
import MessageErreur from '@/components/ui/MessageErreur.jsx';

import { useAuth } from '../compte/AuthContext.jsx';
import * as vitrine from './api.js';
import styles from './Realisations.module.css';

export default function FormulaireTemoignage() {
  const { utilisateur } = useAuth();
  const [texte, setTexte] = useState('');
  const [ville, setVille] = useState('');
  const [etat, setEtat] = useState({ envoi: false, erreur: null, merci: false });
  if (!utilisateur) return null;

  async function envoyer(e) {
    e.preventDefault();
    setEtat({ envoi: true, erreur: null, merci: false });
    try {
      await vitrine.proposerTemoignage({ nom_client: utilisateur.nom_complet, type_batiment: utilisateur.type_client,
        ville: ville || utilisateur.adresse?.ville || '', texte, note: 5 });
      setTexte('');
      setEtat({ envoi: false, erreur: null, merci: true });
    } catch (erreur) {
      setEtat({ envoi: false, erreur, merci: false });
    }
  }

  return (
    <section className="section" aria-labelledby="titre-avis">
      <form className={`conteneur ${styles.avis}`} onSubmit={envoyer}>
        <h2 id="titre-avis">Votre avis compte</h2>
        <p>Racontez votre expérience : l'équipe le publiera après relecture.</p>
        <Champ libelle="Votre témoignage" multiligne rows={4} value={texte} onChange={(e) => setTexte(e.target.value)}
          required maxLength={800} />
        <Champ libelle="Ville (facultatif)" value={ville} onChange={(e) => setVille(e.target.value)} />
        <MessageErreur erreur={etat.erreur} />
        {etat.merci && <p role="status">Merci ! Votre témoignage sera publié après relecture.</p>}
        <Bouton type="submit" chargement={etat.envoi} disabled={!texte.trim()}>Envoyer mon témoignage</Bouton>
      </form>
    </section>
  );
}
