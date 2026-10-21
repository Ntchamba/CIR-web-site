// « Ils nous ont fait confiance / Témoignages » (maquettes) : deux témoignages publiés après modération. Rien n'est affiché
// sans témoignage publié (jamais de témoignage inventé).
import EnteteSection from '@/composants/EnteteSection.jsx';
import { useTraduction } from '@/i18n/index.js';
import { estUsage } from '@/modules/catalogue/usages.js';
import { useTemoignages } from '@/modules/vitrine/useVitrine.js';

export default function Temoignages({ section = 'blanche' }) {
  const { t } = useTraduction();
  const liste = useTemoignages();
  const choisis = liste.elements.slice(0, 2);
  if (!choisis.length) return null;
  return (
    <section className={`m-section ${section}`} aria-labelledby="titre-temoignages-accueil">
      <div className="m-conteneur">
        <EnteteSection id="titre-temoignages-accueil" surtitre={t('accueil.temoignages.surtitre')} titre={t('accueil.temoignages.titre')} />
        <ul className="m-grille-2 m-temoins">
          {choisis.map((x) => (
            <li key={x.id} className="p3d">
              <blockquote>
                « {x.texte} »
                <cite>{[x.nom_affiche, estUsage(x.type_chantier) ? t(`usages.${x.type_chantier}`) : null, x.ville].filter(Boolean).join(' · ')}</cite>
              </blockquote>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
