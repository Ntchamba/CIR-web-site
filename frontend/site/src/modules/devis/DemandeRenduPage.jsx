// BF-11 : demande de rendu (/devis/demande). Le client décrit son chantier, joint jusqu'à 5 photos et, s'il le
// souhaite, un produit de référence ; l'équipe répond dans « Mes demandes ».
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { erreursChamps } from '@partage/api/client.js';
import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import usePageMeta from '@partage/utils/usePageMeta.js';

import { useTraduction } from '@/i18n/index.js';
import { nombreOuVide, TYPES_BATIMENT } from '@/modules/commandes/regles.js';

import { creerDemande } from './api.js';
import ApercusImages from './composants/ApercusImages.jsx';
import { useMesCommandes, useProduitsCatalogue } from './useDevis.js';
import styles from './Devis.module.css';

export const DESCRIPTION_MIN = 20;
export const DESCRIPTION_MAX = 1500;

export default function DemandeRenduPage() {
  const { t } = useTraduction();
  usePageMeta(t('devis.demande.titre'), t('devis.demande.description'));
  const naviguer = useNavigate();
  const [parametres] = useSearchParams();
  const produits = useProduitsCatalogue();
  const commandes = useMesCommandes();
  const [form, setForm] = useState({
    description: '', type_batiment: '', surface_m2: '', produit: '', commande: parametres.get('commande') || '',
  });
  const [images, setImages] = useState([]);
  const [erreurs, setErreurs] = useState({});
  const [etat, setEtat] = useState({ envoi: false, erreur: null });
  const changer = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  function valider() {
    const e = {};
    const longueur = form.description.trim().length;
    if (longueur < DESCRIPTION_MIN) e.description = t('devis.demande.erreurs.descriptionCourte', { min: DESCRIPTION_MIN });
    else if (longueur > DESCRIPTION_MAX) e.description = t('devis.demande.erreurs.descriptionLongue', { max: DESCRIPTION_MAX });
    if (!TYPES_BATIMENT.includes(form.type_batiment)) e.type_batiment = t('commandes.nouvelle.erreurs.type');
    const s = nombreOuVide(form.surface_m2);
    if (Number.isNaN(s) || s === 0) e.surface_m2 = t('commandes.nouvelle.erreurs.surface');
    return e;
  }

  async function envoyer(e) {
    e.preventDefault();
    const locales = valider();
    setErreurs(locales);
    if (Object.keys(locales).length) {
      setEtat({ envoi: false, erreur: t('devis.demande.erreurs.incomplet') });
      return;
    }
    const donnees = new FormData();
    donnees.append('description', form.description.trim());
    donnees.append('type_batiment', form.type_batiment);
    if (form.surface_m2 !== '') donnees.append('surface_m2', String(nombreOuVide(form.surface_m2)));
    if (form.produit) donnees.append('produit', form.produit);
    if (form.commande) donnees.append('commande', form.commande);
    images.forEach((f) => donnees.append('images', f));

    setEtat({ envoi: true, erreur: null });
    try {
      const demande = await creerDemande(donnees);
      naviguer('/mes-demandes', { state: { demandeEnvoyee: demande?.reference || '' } });
    } catch (erreur) {
      setErreurs(erreursChamps(erreur));
      setEtat({ envoi: false, erreur: erreur?.statut === 429 ? t('devis.demande.erreurs.quota') : erreur });
    }
  }

  return (
    <div className="conteneur section">
      <h1 className="titre-page">{t('devis.demande.titre')}</h1>
      <p className={styles.intro}>{t('devis.demande.intro')}</p>
      <form onSubmit={envoyer} noValidate className={styles.formDemande}>
        <Champ libelle={t('devis.demande.descriptionChamp')} name="description" multiligne required maxLength={DESCRIPTION_MAX}
          value={form.description} onChange={changer} erreur={erreurs.description}
          aide={t('devis.demande.descriptionAide', { n: form.description.trim().length, min: DESCRIPTION_MIN, max: DESCRIPTION_MAX })} />
        <div className={styles.deuxColonnes}>
          <Champ libelle={t('commandes.nouvelle.type')} name="type_batiment" required value={form.type_batiment}
            onChange={changer} erreur={erreurs.type_batiment}
            options={[['', t('commandes.nouvelle.typeChoisir')], ...TYPES_BATIMENT.map((b) => [b, t(`commandes.types.${b}`)])]} />
          <Champ libelle={t('commandes.nouvelle.surface')} name="surface_m2" type="number" inputMode="decimal" min="0" step="0.01"
            value={form.surface_m2} onChange={changer} erreur={erreurs.surface_m2} />
        </div>
        <div className={styles.deuxColonnes}>
          <Champ libelle={t('devis.demande.produit')} name="produit" value={form.produit} onChange={changer} erreur={erreurs.produit}
            options={[['', t('devis.demande.aucun')], ...produits.map((p) => [String(p.id), [p.reference, p.nom].filter(Boolean).join(' · ')])]} />
          {commandes.length > 0 && (
            <Champ libelle={t('devis.demande.commande')} name="commande" value={form.commande} onChange={changer} erreur={erreurs.commande}
              options={[['', t('devis.demande.aucune')], ...commandes.map((c) => [String(c.id), c.reference])]} />
          )}
        </div>
        <ApercusImages fichiers={images} onChange={setImages} erreur={erreurs.images} />
        <div aria-live="polite"><MessageErreur erreur={etat.erreur} /></div>
        <div className={styles.rangee}>
          <Bouton type="submit" chargement={etat.envoi}>{t('devis.demande.envoyer')}</Bouton>
        </div>
      </form>
    </div>
  );
}
