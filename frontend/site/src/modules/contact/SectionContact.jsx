// BF-11 : formulaire de contact en bas de l'accueil (question, devis, design sur mesure, rappel).
// Peut être prérempli depuis une fiche produit (« Demander un devis », « Rendu particulier »…).
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

import Bouton from '@/components/ui/Bouton.jsx';
import Champ from '@/components/ui/Champ.jsx';
import MessageErreur from '@/components/ui/MessageErreur.jsx';
import useCoordonnees from '@/hooks/useCoordonnees.js';
import { api } from '@/lib/api.js';

import { lienWhatsApp } from '../accueil/api.js';
import { useAuth } from '../compte/AuthContext.jsx';
import styles from './Contact.module.css';

const OBJETS = [['question', 'Une question'], ['devis', 'Une demande de devis'], ['sur_mesure', 'Un design sur mesure'],
  ['rappel', 'Être rappelé']];
const TYPES = [['maison', 'Une maison'], ['industrie', 'Une industrie'], ['entreprise', 'Une entreprise']];
const VIDE = { nom: '', telephone: '', email: '', objet: 'question', type_batiment: 'maison', surface_m2: '', message: '' };

export default function SectionContact() {
  const { state } = useLocation();
  const { utilisateur } = useAuth();
  const c = useCoordonnees();
  const [form, setForm] = useState(VIDE);
  const [etat, setEtat] = useState({ envoi: false, erreur: null, envoye: false });

  useEffect(() => {
    setForm((f) => ({
      ...f,
      ...(utilisateur ? { nom: f.nom || utilisateur.nom_complet, telephone: f.telephone || utilisateur.telephone,
        email: f.email || utilisateur.email, type_batiment: utilisateur.type_client } : {}),
      ...(state?.objet ? { objet: state.objet } : {}),
      ...(state?.message ? { message: state.message } : {}),
    }));
  }, [state, utilisateur]);

  const changer = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function envoyer(e) {
    e.preventDefault();
    setEtat({ envoi: true, erreur: null, envoye: false });
    try {
      await api.post('/contact/', { ...form, surface_m2: form.surface_m2 || null });
      setForm({ ...VIDE, nom: form.nom, telephone: form.telephone, email: form.email });
      setEtat({ envoi: false, erreur: null, envoye: true });
    } catch (erreur) {
      setEtat({ envoi: false, erreur, envoye: false });
    }
  }

  return (
    <section id="contact" className={styles.contact} aria-labelledby="titre-contact">
      <div className={`conteneur ${styles.grille}`}>
        <div className={styles.texte}>
          <span className={styles.surtitre}>Contact</span>
          <h2 id="titre-contact">Parlons de votre sol</h2>
          <p>Une question, un devis, un rendu particulier ? Écrivez-nous : l'équipe du CIR vous répond rapidement.</p>
          <ul className={styles.coordonnees}>
            <li><span className="etiquette">Téléphone</span>{c.telephone}</li>
            <li><span className="etiquette">WhatsApp</span>
              <a href={lienWhatsApp(c.whatsapp)} target="_blank" rel="noopener noreferrer">{c.whatsapp}</a></li>
            <li><span className="etiquette">Adresse</span>{c.adresse}</li>
          </ul>
        </div>

        <form className={styles.formulaire} onSubmit={envoyer}>
          <div className={styles.deux}>
            <Champ libelle="Nom" name="nom" value={form.nom} onChange={changer} autoComplete="name" required />
            <Champ libelle="Téléphone" name="telephone" type="tel" value={form.telephone} onChange={changer}
              autoComplete="tel" />
          </div>
          <Champ libelle="E-mail" name="email" type="email" value={form.email} onChange={changer} autoComplete="email"
            aide="Téléphone ou e-mail : au moins l'un des deux, pour vous répondre." />
          <div className={styles.deux}>
            <Champ libelle="Objet" name="objet" value={form.objet} onChange={changer} options={OBJETS} />
            <Champ libelle="Pour" name="type_batiment" value={form.type_batiment} onChange={changer} options={TYPES} />
          </div>
          <Champ libelle="Surface approximative (m²)" name="surface_m2" inputMode="decimal" value={form.surface_m2}
            onChange={changer} />
          <Champ libelle="Votre message" name="message" multiligne rows={4} value={form.message} onChange={changer}
            required />
          <MessageErreur erreur={etat.erreur} />
          {etat.envoye && <p className={styles.merci} role="status">Merci, votre message est bien arrivé. L'équipe vous recontacte.</p>}
          <Bouton type="submit" chargement={etat.envoi}>Envoyer le message</Bouton>
        </form>
      </div>
    </section>
  );
}
