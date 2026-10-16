// Icônes au trait, en SVG dans la page (aucune requête réseau). Décoratives : aria-hidden.
const TRACES = {
  accueil: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9z',
  catalogue: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  realisations: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01',
  commandes: 'M9 3h6v3H9zM7 4.5H5V21h14V4.5h-2M8 11h8M8 15h5',
  compte: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  menu: 'M4 7h16M4 12h16M4 17h16',
  fermer: 'M6 6l12 12M18 6L6 18',
  tel: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z',
  message: 'M4 5h16v11H9l-5 4V5z',
  fleche: 'M5 12h14M13 6l6 6-6 6',
  retour: 'M19 12H5M11 6l-6 6 6 6',
  coche: 'M5 12l5 5 9-10',
  carte: 'M12 21s-7-6-7-11a7 7 0 1 1 14 0c0 5-7 11-7 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  sortie: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
};

export const NOMS_ICONES = Object.keys(TRACES);

export default function Icone({ nom, taille = 20, epaisseur = 1.8, ...props }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={epaisseur} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"
      {...props}>
      <path d={TRACES[nom] || ''} />
    </svg>
  );
}
