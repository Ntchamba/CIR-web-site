// Icônes du menu : celles de @partage/ui/Icone, plus quelques tracés propres au tableau de bord.
import Icone, { NOMS_ICONES } from '@partage/ui/Icone.jsx';

const TRACES = {
  clients: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7M18 14a6 6 0 0 1 4 7',
  equipe: 'M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6l7-3zM9 12l2 2 4-4',
  devis: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5',
  actualites: 'M4 5h13v14H6a2 2 0 0 1-2-2V5zM17 9h3v8a2 2 0 0 1-4 0M7 9h7M7 13h7',
  contenus: 'M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4',
  contact: 'M4 6h16v12H4zM4 7l8 6 8-6',
  paiements: 'M3 6h18v12H3zM3 10h18M7 15h4',
  statistiques: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  notifications: 'M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2zM10 21h4',
  assistant: 'M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM19 16l.8 2.2 2.2.8-2.2.8L19 22l-.8-2.2-2.2-.8 2.2-.8z',
};

export default function IconeMenu({ nom, taille = 20, epaisseur = 1.8 }) {
  if (NOMS_ICONES.includes(nom)) return <Icone nom={nom} taille={taille} epaisseur={epaisseur} />;
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={epaisseur} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={TRACES[nom] || ''} />
    </svg>
  );
}
