// Texte long saisi par l'équipe : un paragraphe par bloc séparé d'une ligne vide, retours à la ligne gardés.
// Le texte est affiché tel quel (jamais interprété comme du HTML).
export default function Paragraphes({ texte, className, lang }) {
  if (!texte) return null;
  const blocs = String(texte).split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className={className} lang={lang} style={{ whiteSpace: 'pre-line' }}>
      {blocs.map((bloc, i) => <p key={i}>{bloc}</p>)}
    </div>
  );
}
