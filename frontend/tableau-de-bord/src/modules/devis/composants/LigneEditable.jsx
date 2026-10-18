// Une ligne de devis dans l'éditeur : type (matériau, surface, forfait), produit, valeurs saisies.
// La quantité et le montant affichés viennent de l'aperçu du serveur ; les erreurs s'affichent sous les champs.
import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import { fcfa } from '@partage/utils/format.js';

import { useTraduction } from '@/i18n/index.js';

import { prixCatalogue, TYPES_LIGNE, kilos } from '../lignes.js';
import styles from '../Devis.module.css';

export default function LigneEditable({
  ligne, index, total, erreurs = {}, calcule, produits = [], surChangement, surRetrait, surDeplacement,
}) {
  const { t } = useTraduction();
  const type = ligne.type_ligne;
  const produit = produits.find((p) => String(p.id) === ligne.produit);
  const prix = prixCatalogue(produit, type);
  const champ = (nom, extra = {}) => ({
    name: nom, value: ligne[nom], erreur: erreurs[nom], inputMode: 'decimal',
    onChange: (e) => surChangement({ [nom]: e.target.value }),
    libelle: t(`devis.editeur.champs.${nom}`), ...extra,
  });
  const nomLigne = t('devis.editeur.ligneN', { n: index + 1 });
  const autres = Object.entries(erreurs).filter(([nom]) => !['libelle', 'produit', 'type_ligne', 'surface_m2', 'dosage_kg_m2', 'prix_kg', 'prix_m2', 'montant_forfait'].includes(nom));

  return (
    <fieldset className={styles.ligne}>
      <legend>{nomLigne}</legend>
      <div className={styles.grille}>
        <Champ libelle={t('devis.editeur.type')} name="type_ligne" value={type} erreur={erreurs.type_ligne}
          options={TYPES_LIGNE.map((c) => [c, t(`devis.editeur.types.${c}`)])}
          onChange={(e) => surChangement({ type_ligne: e.target.value })} />
        <Champ libelle={t('devis.editeur.libelle')} name="libelle" value={ligne.libelle} erreur={erreurs.libelle}
          maxLength={160} aide={t('devis.editeur.aideLibelle')} onChange={(e) => surChangement({ libelle: e.target.value })} />
        <Champ libelle={t('devis.editeur.produit')} name="produit" value={ligne.produit} erreur={erreurs.produit}
          options={[['', t('devis.editeur.aucunProduit')], ...produits.map((p) => [String(p.id), p.reference ? `${p.nom} (${p.reference})` : p.nom])]}
          onChange={(e) => surChangement({ produit: e.target.value })}
          aide={ligne.produit && !prix && type !== 'forfait' ? t('devis.editeur.pasDePrixCatalogue') : undefined} />
      </div>
      <div className={styles.grille}>
        {type !== 'forfait' && <Champ {...champ('surface_m2')} />}
        {type === 'materiau' && <Champ {...champ('dosage_kg_m2')} />}
        {type === 'materiau' && (
          <Champ {...champ('prix_kg')} aide={prix?.champ === 'prix_kg' ? t('devis.editeur.prixCatalogue') : undefined} />
        )}
        {type === 'surface' && (
          <Champ {...champ('prix_m2')} aide={prix?.champ === 'prix_m2' ? t('devis.editeur.prixCatalogue') : undefined} />
        )}
        {type === 'forfait' && <Champ {...champ('montant_forfait')} />}
      </div>
      {autres.length > 0 && (
        <ul className={styles.erreursLigne} role="alert">
          {autres.map(([nom, message]) => <li key={nom}>{message}</li>)}
        </ul>
      )}
      <dl className={styles.resultat} aria-live="polite">
        {type === 'materiau' && (
          <div><dt>{t('devis.editeur.quantite')}</dt><dd>{kilos(calcule?.quantite_kg)}</dd></div>
        )}
        <div><dt>{t('devis.editeur.montant')}</dt><dd>{fcfa(calcule?.montant)}</dd></div>
      </dl>
      <div className={styles.boutonsLigne}>
        <Bouton variante="contour" taille="petit" disabled={index === 0} onClick={() => surDeplacement(-1)}
          aria-label={t('devis.editeur.monter', { n: index + 1 })}>↑</Bouton>
        <Bouton variante="contour" taille="petit" disabled={index === total - 1} onClick={() => surDeplacement(1)}
          aria-label={t('devis.editeur.descendre', { n: index + 1 })}>↓</Bouton>
        <Bouton variante="texte" taille="petit" onClick={surRetrait} aria-label={t('devis.editeur.retirer', { n: index + 1 })}>
          {t('devis.editeur.retirerLigne')}
        </Bouton>
      </div>
    </fieldset>
  );
}
