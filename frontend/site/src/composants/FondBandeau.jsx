// Fond propre du bandeau des pages intérieures (comme la maquette) : bande du salon, deux tailles, dimensions réservées.
// Masqué sur téléphone par la CSS (la maquette téléphone n'a pas de bandeau photo).
export default function FondBandeau() {
  return (
    <img className="m-bandeau-fond" src="/media/accueil/bandeau-maison-1280.webp"
      srcSet="/media/accueil/bandeau-maison-800.webp 800w, /media/accueil/bandeau-maison-1280.webp 1280w"
      sizes="100vw" width="1280" height="412" alt="" decoding="async" fetchPriority="high" />
  );
}
