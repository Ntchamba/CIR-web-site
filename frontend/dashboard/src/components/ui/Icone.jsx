// Icônes au trait du tableau de bord (SVG en ligne).
const TRACES = {
  accueil: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9z',
  catalogue: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  realisations: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01',
  commandes: 'M9 3h6v3H9zM7 4.5H5V21h14V4.5h-2M8 11h8M8 15h5',
  compte: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  menu: 'M4 7h16M4 12h16M4 17h16',
  fermer: 'M6 6l12 12M18 6L6 18',
  tel: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z',
  whatsapp: 'M12 3a9 9 0 0 0-7.8 13.5L3 21l4.7-1.2A9 9 0 1 0 12 3z',
  message: 'M4 5h16v11H9l-5 4V5z',
  fleche: 'M5 12h14M13 6l6 6-6 6',
  retour: 'M19 12H5M11 6l-6 6 6 6',
  coeur: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  etiquette: 'M3 12V4h8l10 10-8 8L3 12zM7.5 7.5h.01',
  palette: 'M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5 1-1.5 2-1.5h2a4 4 0 0 0 4-4c0-4.4-4-8-9-8zM7.5 11h.01M10 7.5h.01M14.5 7.5h.01',
  devis: 'M7 3h8l4 4v14H7V3zM14 3v5h5M10 12h6M10 16h6',
  calendrier: 'M4 6h16v14H4V6zM4 10h16M8 3v4M16 3v4',
  fiche: 'M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6',
  lecture: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM10 8.5l6 3.5-6 3.5v-7z',
  panier: 'M3 4h2l2.4 11h11.2L21 7H7M10 20h.01M17 20h.01',
  plus: 'M12 5v14M5 12h14',
  coche: 'M5 12l5 5 9-10',
  envoyer: 'M4 12l16-8-6 16-3-7-7-1z',
  carte: 'M12 21s-7-6-7-11a7 7 0 1 1 14 0c0 5-7 11-7 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  banque: 'M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18',
  sortie: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  tableau: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  clients: 'M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 20v-1a4 4 0 0 0-3-3.9M16 4.1a3.5 3.5 0 0 1 0 6.8',
  boite: 'M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10',
  site: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  recherche: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  cloche: 'M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2zM10 21h4',
  crayon: 'M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4',
  oeil: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  envoi: 'M12 16V4M7 9l5-5 5 5M4 16v4h16v-4',
  corbeille: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  etoile: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3z',
  boiteReception: 'M3 13h5l2 3h4l2-3h5M5 5h14l2 8v6H3v-6l2-8z',
};

export default function Icone({ nom, taille = 20, epaisseur = 1.8, ...props }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={epaisseur} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d={TRACES[nom] || ''} />
    </svg>
  );
}
