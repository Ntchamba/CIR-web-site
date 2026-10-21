// Carte d'un produit (maquettes) : grande image carrée sans cadre, nom centré en Lora, prix dessous (« Prix sur devis »
// sans prix). Toute la carte est un lien vers la fiche ; l'image grandit jusqu'à la fiche (View Transitions).
import { Link } from 'react-router';

import { prix } from '@partage/utils/format.js';

import ImageMedia from '@/composants/ImageMedia.jsx';
import { nommerVignette, produitVu } from '@/composants/transitionProduit.js';

export default function CarteProduit({ produit, niveauTitre = 3 }) {
  const Titre = `h${niveauTitre}`;
  // Retour depuis la fiche : la vignette du produit quitté porte le nom de transition (trajet inverse).
  const nom = produitVu() === produit.slug ? { viewTransitionName: 'produit-image' } : undefined;
  return (
    <Link to={`/catalogue/${produit.slug}`} state={{ apercu: produit }} className="m-carte-produit"
      onClick={(e) => nommerVignette(e, produit.slug)}>
      <div className="img">
        {produit.image?.url
          ? <ImageMedia image={produit.image} alt="" largeur={640} hauteur={640} style={nom} />
          : <span className="ref-neutre" aria-hidden="true">{produit.reference || produit.nom?.slice(0, 2)}</span>}
      </div>
      <Titre>{produit.nom}</Titre>
      <p>{prix(produit.prix, produit.unite_prix)}</p>
    </Link>
  );
}
