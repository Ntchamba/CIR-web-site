// En-tête d'une section des maquettes : surtitre en italique bleu (Lora), titre (h2), lien en capitales avec flèche à
// droite (ordinateur). Sur téléphone l'en-tête est centré et le lien passe sous la section (LienSection).
import { Link } from 'react-router';

import { useEcranTelephone } from '@/app/preferences.js';

export default function EnteteSection({ id, surtitre, titre, lien, texteLien, niveau = 2 }) {
  const telephone = useEcranTelephone();
  const Titre = `h${niveau}`;
  return (
    <div className="m-tete p3d">
      <div>
        {surtitre && <span className="m-italique">{surtitre}</span>}
        <Titre id={id}>{titre}</Titre>
      </div>
      {lien && !telephone && (
        <Link to={lien} className="m-lien-fleche">{texteLien} <span aria-hidden="true">→</span></Link>
      )}
    </div>
  );
}

/** Lien sous la section, au centre (téléphone) : « Voir tout le catalogue ». Rien sur ordinateur (le lien est dans l'en-tête). */
export function LienSection({ lien, texte }) {
  const telephone = useEcranTelephone();
  if (!telephone || !lien) return null;
  return <div className="m-lien-bas"><Link to={lien} className="m-lien-fleche">{texte}</Link></div>;
}
