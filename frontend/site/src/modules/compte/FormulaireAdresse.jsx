// Champs de l'adresse du client (ville, quartier, rue ou repère), tous obligatoires pour commander.
import Champ from '@partage/ui/Champ.jsx';

export default function FormulaireAdresse({ valeur, onChange, erreurs = {}, desactive = false }) {
  const changer = (e) => onChange({ ...valeur, [e.target.name]: e.target.value });
  return (
    <>
      <Champ libelle="Ville" name="ville" value={valeur.ville} onChange={changer} erreur={erreurs.ville}
        autoComplete="address-level2" placeholder="Douala" required disabled={desactive} />
      <Champ libelle="Quartier" name="quartier" value={valeur.quartier} onChange={changer} erreur={erreurs.quartier}
        autoComplete="address-level3" placeholder="Bonapriso" required disabled={desactive} />
      <Champ libelle="Rue ou repère" name="rue_ou_repere" value={valeur.rue_ou_repere} onChange={changer}
        erreur={erreurs.rue_ou_repere} autoComplete="street-address" placeholder="Près de la pharmacie du carrefour"
        aide="Un repère connu aide notre équipe à vous trouver." required disabled={desactive} />
    </>
  );
}
