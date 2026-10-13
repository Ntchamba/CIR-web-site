// Histogramme des commandes des 12 derniers mois (SVG, une seule série : pas de légende).
// Le mois en cours est en corail ; chaque barre affiche sa valeur au survol.
export default function GraphiqueMois({ serie }) {
  const x0 = 44; const x1 = 636; const y0 = 206; const haut = 26;
  const max = Math.max(4, ...serie.map((m) => m.commandes));
  const pas = Math.ceil(max / 4);
  const plafond = pas * 4;
  const echelle = (y0 - haut) / plafond;
  const largeur = (x1 - x0) / serie.length;
  const barre = 26;

  return (
    <svg viewBox="0 0 650 236" width="100%" role="img"
      aria-label={`Commandes par mois : ${serie.map((m) => `${m.mois} ${m.commandes}`).join(', ')}`}>
      {[1, 2, 3, 4].map((k) => {
        const y = y0 - k * pas * echelle;
        return (
          <g key={k}>
            <line x1={x0} x2={x1} y1={y} y2={y} stroke="#e6edf1" />
            <text x={x0 - 10} y={y + 4} textAnchor="end" fontSize="11" fill="#7c919c" fontFamily="DM Mono, monospace">{k * pas}</text>
          </g>
        );
      })}
      <line x1={x0} x2={x1} y1={y0} y2={y0} stroke="#b7c7d0" />
      {serie.map((m, i) => {
        const x = x0 + i * largeur + (largeur - barre) / 2;
        const h = m.commandes * echelle;
        const y = y0 - h;
        const dernier = i === serie.length - 1;
        const r = Math.min(4, h);
        return (
          <g key={`${m.annee}-${m.mois}`}>
            {h > 0 && (
              <path d={`M${x} ${y0}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + barre - r}Q${x + barre} ${y} ${x + barre} ${y + r}V${y0}Z`}
                fill={dernier ? '#ff6d4c' : '#1177a8'}>
                <title>{`${m.mois} ${m.annee} : ${m.commandes} commande(s)`}</title>
              </path>
            )}
            <rect x={x - 6} y={haut} width={barre + 12} height={y0 - haut} fill="transparent">
              <title>{`${m.mois} ${m.annee} : ${m.commandes} commande(s)`}</title>
            </rect>
            <text x={x + barre / 2} y={y0 + 20} textAnchor="middle" fontSize="12" fill="#2f4a57" fontFamily="DM Mono, monospace">{m.mois}</text>
            {dernier && <text x={x + barre / 2} y={y - 8} textAnchor="middle" fontSize="13" fontWeight="600" fill="#0e2a38">{m.commandes}</text>}
          </g>
        );
      })}
    </svg>
  );
}
