// Création ou modification d'une famille du catalogue : nom et description traduits, ordre d'affichage.
import { useId, useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';

import { t as traduire, useTraduction } from '@/i18n/index.js';
import { repartirErreur } from '@/composants/envoi.js';
import OngletsLangues from '@/composants/OngletsLangues.jsx';
import Tiroir from '@/composants/Tiroir.jsx';
import gestion from '@/composants/Gestion.module.css';

import { creerFamille, modifierFamille } from '../api.js';

export function validerFamille(form) {
  return form.nom.trim() ? {} : { nom: traduire('catalogue.familles.nomManquant') };
}

/** `famille` : famille à modifier, ou null pour une création. */
export default function TiroirFamille({ famille, surFermeture, surEnregistrement }) {
  const { t } = useTraduction();
  const idForm = useId();
  const [form, setForm] = useState({
    nom: famille?.nom || '', description: famille?.description || '', ordre: String(famille?.ordre ?? 0),
    traductions: famille?.traductions || {},
  });
  const [erreurs, setErreurs] = useState({});
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  async function envoyer(e) {
    e.preventDefault();
    const locales = validerFamille(form);
    setErreurs(locales);
    setErreur(null);
    if (Object.keys(locales).length) return;
    setEnvoi(true);
    const donnees = {
      nom: form.nom.trim(), description: form.description.trim(), ordre: Number.parseInt(form.ordre, 10) || 0,
      traductions: form.traductions,
    };
    try {
      const resultat = famille ? await modifierFamille(famille.id, donnees) : await creerFamille(donnees);
      surEnregistrement(resultat);
    } catch (err) {
      const { champs, generale } = repartirErreur(err, ['nom', 'description', 'ordre', 'traductions']);
      setErreurs(champs);
      setErreur(generale);
      setEnvoi(false);
    }
  }

  const titre = famille ? t('catalogue.familles.titreModifier', { nom: famille.nom }) : t('catalogue.familles.titreNouvelle');
  return (
    <Tiroir ouvert titre={titre} surFermeture={surFermeture}
      pied={(
        <>
          <Bouton type="submit" form={idForm} chargement={envoi}>{t('actions.enregistrer')}</Bouton>
          <Bouton variante="texte" onClick={surFermeture}>{t('actions.annuler')}</Bouton>
        </>
      )}>
      <form id={idForm} className={gestion.formulaire} onSubmit={envoyer} noValidate aria-label={titre}>
        <OngletsLangues valeurs={form} traductions={form.traductions} erreurs={erreurs}
          surChangement={(champ, valeur) => setForm((f) => ({ ...f, [champ]: valeur }))}
          surTraductions={(traductions) => setForm((f) => ({ ...f, traductions }))}
          champs={[
            { nom: 'nom', libelle: t('catalogue.familles.nom'), required: true },
            { nom: 'description', libelle: t('catalogue.familles.description'), multiligne: true },
          ]} />
        <Champ libelle={t('catalogue.familles.ordre')} name="ordre" type="number" min="0" value={form.ordre}
          aide={t('catalogue.familles.aideOrdre')} erreur={erreurs.ordre}
          onChange={(e) => setForm((f) => ({ ...f, ordre: e.target.value }))} />
        <MessageErreur erreur={erreur} />
      </form>
    </Tiroir>
  );
}
