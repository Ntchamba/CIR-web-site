// Indicateur de chargement.
export default function Chargement({ plein, texte = 'Chargement…' }) {
  return (
    <div className={`chargement ${plein ? 'plein' : ''}`} role="status">
      <span className="roue" aria-hidden="true" />
      <span>{texte}</span>
    </div>
  );
}
