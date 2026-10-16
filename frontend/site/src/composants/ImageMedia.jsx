// Image venant de l'API ({url, alt}) : dimensions réservées (pas de saut de mise en page), chargement
// progressif. `prioritaire` : image visible dès l'ouverture (chargée tout de suite).
export default function ImageMedia({ image, largeur, hauteur, alt, prioritaire = false, className, ...props }) {
  if (!image?.url) return null;
  return (
    <img src={image.url} alt={alt ?? image.alt ?? ''} width={largeur} height={hauteur} className={className}
      loading={prioritaire ? 'eager' : 'lazy'} decoding="async" fetchPriority={prioritaire ? 'high' : undefined}
      {...props} />
  );
}
