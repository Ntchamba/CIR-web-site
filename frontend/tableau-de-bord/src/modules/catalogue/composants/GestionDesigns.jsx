// Designs d'un produit (coloris, motifs) : nom traduit, couleur (#RRGGBB) et image facultatives.
// Ajout, modification et suppression partent tout de suite au serveur.
import { useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';

import { t as traduire, useTraduction } from '@/i18n/index.js';
import BoutonSupprimer from '@/composants/BoutonSupprimer.jsx';
import ChampImage from '@/composants/ChampImage.jsx';
import { repartirErreur } from '@/composants/envoi.js';
import OngletsLangues, { PastilleTraductions } from '@/composants/OngletsLangues.jsx';
import gestion from '@/composants/Gestion.module.css';

import { ajouterDesign, modifierDesign, supprimerDesign } from '../api.js';
import styles from '../Catalogue.module.css';

const COULEUR = /^#[0-9a-fA-F]{6}$/;
const CHAMPS = ['nom', 'couleur', 'image', 'traductions'];
const adresse = (image) => (typeof image === 'string' ? image : image?.url) || '';

/** Contrôle avant l'envoi : nom obligatoire, couleur au format #RRGGBB si elle est saisie. */
export function validerDesign(form) {
  const erreurs = {};
  if (!form.nom.trim()) erreurs.nom = traduire('catalogue.designs.nomManquant');
  if (form.couleur.trim() && !COULEUR.test(form.couleur.trim())) erreurs.couleur = traduire('catalogue.designs.couleurInvalide');
  return erreurs;
}

function FormulaireDesign({ design, produitId, surEnregistre, surAnnuler }) {
  const { t } = useTraduction();
  const [form, setForm] = useState({
    nom: design?.nom || '', couleur: design?.couleur || '', traductions: design?.traductions || {}, fichier: undefined,
  });
  const [erreurs, setErreurs] = useState({});
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  async function enregistrer() {
    const locales = validerDesign(form);
    setErreurs(locales);
    setErreur(null);
    if (Object.keys(locales).length) return;
    setEnvoi(true);
    const donnees = { nom: form.nom.trim(), couleur: form.couleur.trim(), traductions: form.traductions, fichier: form.fichier };
    try {
      const resultat = design ? await modifierDesign(design.id, donnees) : await ajouterDesign(produitId, donnees);
      surEnregistre(resultat);
      if (!design) setForm({ nom: '', couleur: '', traductions: {}, fichier: undefined });
    } catch (e) {
      const { champs, generale } = repartirErreur(e, CHAMPS);
      setErreurs(champs);
      setErreur(generale);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className={design ? styles.editionMedia : styles.ajoutMedia}>
      {!design && <h3 className={styles.titreAjout}>{t('catalogue.designs.ajouter')}</h3>}
      <OngletsLangues champs={[{ nom: 'nom', libelle: t('catalogue.designs.nom'), required: true }]}
        valeurs={form} traductions={form.traductions} erreurs={erreurs}
        surChangement={(champ, valeur) => setForm((f) => ({ ...f, [champ]: valeur }))}
        surTraductions={(traductions) => setForm((f) => ({ ...f, traductions }))} />
      <div className={styles.couleur}>
        <Champ libelle={t('catalogue.designs.couleur')} name="couleur" value={form.couleur} placeholder="#1177A8"
          aide={t('catalogue.designs.aideCouleur')} erreur={erreurs.couleur} maxLength={7}
          onChange={(e) => setForm((f) => ({ ...f, couleur: e.target.value }))} />
        <input type="color" aria-label={t('catalogue.designs.nuancier')}
          value={COULEUR.test(form.couleur) ? form.couleur : '#ffffff'}
          onChange={(e) => setForm((f) => ({ ...f, couleur: e.target.value.toUpperCase() }))} />
      </div>
      {/* fichier : File (nouveau), null (image retirée : envoi de image: null), undefined (inchangée) */}
      <ChampImage libelle={t('catalogue.designs.image')} image={form.fichier === null ? null : design?.image}
        fichier={form.fichier || null} erreur={erreurs.image}
        surChoix={(fichier) => setForm((f) => ({ ...f, fichier: fichier || undefined }))}
        surRetrait={design ? () => setForm((f) => ({ ...f, fichier: null })) : undefined} />
      <MessageErreur erreur={erreur} />
      <div className={gestion.actionsFormulaire}>
        <Bouton taille="petit" chargement={envoi} onClick={enregistrer}>
          {design ? t('actions.enregistrer') : t('catalogue.designs.envoyer')}
        </Bouton>
        {surAnnuler && <Bouton taille="petit" variante="texte" onClick={surAnnuler}>{t('actions.annuler')}</Bouton>}
      </div>
    </div>
  );
}

export default function GestionDesigns({ produitId, designs, surChangement }) {
  const { t } = useTraduction();
  const liste = [...(designs || [])].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
  const [edition, setEdition] = useState(null);

  async function supprimer(id) {
    await supprimerDesign(id);
    surChangement(liste.filter((d) => d.id !== id));
  }

  return (
    <fieldset className={gestion.bloc}>
      <legend>{t('catalogue.designs.titre')}</legend>
      <p className={gestion.aide}>{t('catalogue.designs.aide')}</p>
      {liste.length === 0 ? (
        <p className={gestion.aide}>{t('catalogue.designs.vide')}</p>
      ) : (
        <ul className={gestion.lignes}>
          {liste.map((design) => (
            <li key={design.id} className={styles.media}>
              {adresse(design.image) ? <img src={adresse(design.image)} alt="" className={styles.miniature} />
                : <span className={styles.nuance} style={{ background: design.couleur || 'var(--fond-2)' }} aria-hidden="true" />}
              <div className={styles.infosMedia}>
                <strong>{design.nom}</strong>
                {design.couleur && <span className={gestion.secondaire}>{design.couleur}</span>}
                <PastilleTraductions langues={design.langues_incompletes} />
              </div>
              <div className={gestion.boutonsLigne}>
                <Bouton taille="petit" variante="contour" onClick={() => setEdition(design.id)}
                  aria-label={t('actions.modifierNom', { nom: design.nom })}>{t('actions.modifier')}</Bouton>
                <BoutonSupprimer nom={design.nom} surConfirmation={() => supprimer(design.id)} />
              </div>
              {edition === design.id && (
                <FormulaireDesign design={design} surAnnuler={() => setEdition(null)}
                  surEnregistre={(maj) => { surChangement(liste.map((d) => (d.id === maj.id ? maj : d))); setEdition(null); }} />
              )}
            </li>
          ))}
        </ul>
      )}
      <FormulaireDesign produitId={produitId} surEnregistre={(nouveau) => surChangement([...liste, nouveau])} />
    </fieldset>
  );
}
