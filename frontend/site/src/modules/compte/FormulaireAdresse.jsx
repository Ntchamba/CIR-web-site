// Champs de l'adresse du client (ville, quartier, rue ou repère).
import Champ from '@/components/ui/Champ.jsx';

export const ADRESSE_VIDE = { pays: 'Cameroun', ville: '', quartier: '', rue_repere: '', complement: '' };

export default function FormulaireAdresse({ valeur, onChange }) {
  const changer = (e) => onChange({ ...valeur, [e.target.name]: e.target.value });
  return (
    <>
      <Champ libelle="Ville" name="ville" value={valeur.ville} onChange={changer} autoComplete="address-level2"
        placeholder="Douala" />
      <Champ libelle="Quartier" name="quartier" value={valeur.quartier} onChange={changer} placeholder="Bonapriso" />
      <Champ libelle="Rue ou repère" name="rue_repere" value={valeur.rue_repere} onChange={changer}
        autoComplete="street-address" placeholder="Près de la pharmacie…" />
      <Champ libelle="Complément (facultatif)" name="complement" value={valeur.complement || ''} onChange={changer} />
    </>
  );
}
