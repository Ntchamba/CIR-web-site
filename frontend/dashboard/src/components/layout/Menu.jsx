// Menu latéral : pilotage, modules à venir, compte de l'administrateur.
import { NavLink, useNavigate } from 'react-router-dom';

import { URL_SITE } from '@/lib/api.js';
import { useAuth } from '@/modules/auth/AuthContext.jsx';
import useNonLus from '@/modules/messagerie/useNonLus.js';

import Icone from '../ui/Icone.jsx';

const PILOTAGE = [
  { vers: '/', libelle: 'Tableau de bord', icone: 'tableau', fin: true },
  { vers: '/commandes', libelle: 'Commandes', icone: 'commandes' },
  { vers: '/messagerie', libelle: 'Messagerie', icone: 'message', badge: 'messages' },
  { vers: '/demandes', libelle: 'Demandes de contact', icone: 'boiteReception' },
  { vers: '/catalogue', libelle: 'Catalogue', icone: 'boite' },
  { vers: '/clients', libelle: 'Clients', icone: 'clients' },
  { vers: '/contenus', libelle: 'Contenus du site', icone: 'realisations' },
];
const A_VENIR = [
  { vers: '/paiements', libelle: 'Paiements', icone: 'banque' },
  { vers: '/appels', libelle: 'Appels', icone: 'tel' },
];

const classe = ({ isActive }) => `menu-lien ${isActive ? 'active' : ''}`;

export default function Menu() {
  const { utilisateur, seDeconnecter } = useAuth();
  const nonLus = useNonLus();
  const naviguer = useNavigate();
  const initiales = (utilisateur?.nom_complet || 'CIR').split(' ').map((m) => m[0]).slice(0, 2).join('').toUpperCase();

  return (
    <nav className="menu" aria-label="Menu d'administration">
      <NavLink to="/" className="menu-logo">
        <img src="/media/marque/logo-cir.webp" alt="" width="42" height="42" />
        <span><strong>CIR</strong><span>Administration</span></span>
      </NavLink>

      <span className="menu-section">Pilotage</span>
      {PILOTAGE.map((l) => (
        <NavLink key={l.vers} to={l.vers} end={l.fin} className={classe}>
          <Icone nom={l.icone} taille={19} />
          <span className="libelle">{l.libelle}</span>
          {l.badge === 'messages' && nonLus > 0 && <span className="pastille">{nonLus}</span>}
        </NavLink>
      ))}

      <span className="menu-section">À venir</span>
      {A_VENIR.map((l) => (
        <NavLink key={l.vers} to={l.vers} className={classe}>
          <Icone nom={l.icone} taille={19} />
          <span className="libelle">{l.libelle}</span>
          <span className="bientot">bientôt</span>
        </NavLink>
      ))}

      <span className="menu-section">Raccourcis</span>
      <a className="menu-lien" href={URL_SITE} target="_blank" rel="noopener noreferrer">
        <Icone nom="site" taille={19} /><span className="libelle">Voir le site public</span>
      </a>

      <div className="menu-pied">
        <div className="menu-moi">
          <span className="avatar">{initiales}</span>
          <span>{utilisateur?.nom_complet}<small>{utilisateur?.is_superuser ? 'Super-administrateur' : 'Administrateur'}</small></span>
        </div>
        <button type="button" className="menu-sortie" onClick={async () => { await seDeconnecter(); naviguer('/connexion'); }}>
          <Icone nom="sortie" taille={19} />Se déconnecter
        </button>
      </div>
    </nav>
  );
}
