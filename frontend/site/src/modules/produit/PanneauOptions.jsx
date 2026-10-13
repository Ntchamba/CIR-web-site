// Panneau de droite de la fiche produit : toutes les actions possibles sur ce produit.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Icone from '@/components/ui/Icone.jsx';
import useCoordonnees from '@/hooks/useCoordonnees.js';
import { prix } from '@shared/format.js';

import { lienWhatsApp } from '../accueil/api.js';
import PanneauAppel from '../appels/PanneauAppel.jsx';
import { useSelection } from '../selection/SelectionContext.jsx';
import styles from './Produit.module.css';

export default function PanneauOptions({ produit, onFermer }) {
  const naviguer = useNavigate();
  const { contient, ajouter, basculer } = useSelection();
  const { whatsapp } = useCoordonnees();
  const [appel, setAppel] = useState(false);
  const panneau = useRef(null);
  const fermer = useRef(onFermer);
  fermer.current = onFermer;

  useEffect(() => {
    panneau.current?.focus();
    const echap = (e) => e.key === 'Escape' && fermer.current();
    document.addEventListener('keydown', echap);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', echap); document.body.style.overflow = ''; };
  }, []);

  const contact = (objet, message) => naviguer('/#contact', { state: { objet, message, produit: produit.nom } });
  const commander = async (negocier) => {
    if (!contient(produit.slug)) await ajouter(produit.slug);
    naviguer(`/commandes/nouvelle${negocier ? '?negocier=1' : ''}`);
  };

  const actions = [
    { nom: 'Commander ce produit', icone: 'panier', faire: () => commander(false), principal: true },
    { nom: contient(produit.slug) ? 'Retirer de ma sélection' : 'Ajouter à ma sélection', icone: 'coeur',
      faire: () => basculer(produit.slug) },
    { nom: 'Négocier le prix', icone: 'etiquette', faire: () => commander(true) },
    { nom: "Envoyer un message à l'équipe", icone: 'message',
      faire: () => naviguer('/messagerie', { state: { sujet: `À propos de : ${produit.nom}` } }) },
    { nom: 'Écrire sur WhatsApp', icone: 'whatsapp',
      lien: lienWhatsApp(whatsapp, `Bonjour, je suis intéressé(e) par « ${produit.nom} ».`) },
    { nom: "Appeler l'équipe", icone: 'tel', faire: () => setAppel(true) },
    { nom: 'Demander un rendu particulier', icone: 'palette',
      faire: () => contact('sur_mesure', `Je souhaite un rendu particulier à partir de « ${produit.nom} » : `) },
    { nom: 'Demander un devis', icone: 'devis', faire: () => contact('devis', `Devis pour « ${produit.nom} », surface : `) },
    { nom: 'Demander une visite du chantier', icone: 'calendrier',
      faire: () => contact('rappel', `Je souhaite une visite de mon chantier pour « ${produit.nom} ».`) },
    { nom: 'Voir la fiche technique', icone: 'fiche',
      faire: () => { onFermer(); setTimeout(() => document.getElementById('fiche')?.scrollIntoView({ behavior: 'smooth' }), 50); } },
    { nom: 'Réalisations avec ce produit', icone: 'realisations', faire: () => naviguer('/realisations') },
    { nom: 'Voir la démo', icone: 'lecture', faire: () => naviguer('/realisations#demos') },
  ];

  return (
    <div className={styles.calque}>
      <button type="button" className={styles.fond} aria-label="Fermer le panneau" onClick={onFermer} />
      <aside id="panneau-options" ref={panneau} tabIndex={-1} className={styles.panneau} role="dialog"
        aria-modal="true" aria-labelledby="titre-options">
        <div className={styles.panneauEntete}>
          <div>
            <span className="etiquette">Options</span>
            <h2 id="titre-options">{produit.nom}</h2>
            <span className={styles.panneauPrix}>{prix(produit.prix, produit.unite_prix)}</span>
          </div>
          <button type="button" className={styles.fermer} onClick={onFermer} aria-label="Fermer">
            <Icone nom="fermer" />
          </button>
        </div>
        <ul className={styles.listeActions}>
          {actions.map((a) => (
            <li key={a.nom}>
              {a.lien
                ? <a href={a.lien} target="_blank" rel="noopener noreferrer" className={styles.action}>
                    <Icone nom={a.icone} /><span>{a.nom}</span></a>
                : <button type="button" onClick={a.faire}
                    className={`${styles.action} ${a.principal ? styles.actionPrincipale : ''}`}>
                    <Icone nom={a.icone} /><span>{a.nom}</span></button>}
            </li>
          ))}
        </ul>
      </aside>
      {appel && <PanneauAppel onFermer={() => setAppel(false)} />}
    </div>
  );
}
