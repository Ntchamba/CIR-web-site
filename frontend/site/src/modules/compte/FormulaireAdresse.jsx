// Champs de l'adresse du client (ville, quartier, rue ou repère), tous obligatoires pour commander.
import Champ from '@partage/ui/Champ.jsx';

import { useTraduction } from '@/i18n/index.js';

export default function FormulaireAdresse({ valeur, onChange, erreurs = {}, desactive = false }) {
  const { t } = useTraduction();
  const changer = (e) => onChange({ ...valeur, [e.target.name]: e.target.value });
  return (
    <>
      <Champ libelle={t('compte.champs.ville')} name="ville" value={valeur.ville} onChange={changer} erreur={erreurs.ville}
        autoComplete="address-level2" placeholder={t('compte.exemples.ville')} required disabled={desactive} />
      <Champ libelle={t('compte.champs.quartier')} name="quartier" value={valeur.quartier} onChange={changer} erreur={erreurs.quartier}
        autoComplete="address-level3" placeholder={t('compte.exemples.quartier')} required disabled={desactive} />
      <Champ libelle={t('compte.champs.rueOuRepere')} name="rue_ou_repere" value={valeur.rue_ou_repere} onChange={changer}
        erreur={erreurs.rue_ou_repere} autoComplete="street-address" placeholder={t('compte.exemples.rueOuRepere')}
        aide={t('compte.aides.rueOuRepere')} required disabled={desactive} />
    </>
  );
}
