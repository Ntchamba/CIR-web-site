// « Ajouter à ma sélection » (carte et fiche produit). Visiteur : mène à la connexion, puis revient sur la page
// (?suite=). Compte de l'équipe : pas de bouton. Résultat annoncé (aria-live).
import { useContext, useState } from 'react';
import { Link, useLocation } from 'react-router';

import Bouton from '@partage/ui/Bouton.jsx';
import Icone from '@partage/ui/Icone.jsx';

import { useTraduction } from '@/i18n/index.js';
import { AuthContext } from '@/modules/compte/AuthContext.jsx';

import { useSelection } from '../SelectionContext.jsx';
import styles from '../Selection.module.css';

/**
 * `produit` : id du produit ; `design` : id du design choisi (facultatif) ; `nom` : pour le libellé accessible.
 * `lienSiAjoute` : une fois le produit dans la sélection, le bouton devient un lien vers elle (carte du catalogue) ;
 * la fiche produit le laisse actif pour pouvoir ajouter un autre design.
 */
export default function BoutonSelection({ produit, design = null, nom = '', lienSiAjoute = true, taille, variante = 'contour', apparence = null }) {
  const { t } = useTraduction();
  // Sans session (carte affichée hors du fournisseur de session) : pas de bouton.
  const { utilisateur, pret } = useContext(AuthContext) ?? { pret: false };
  const selection = useSelection();
  const { pathname, search } = useLocation();
  const [etat, setEtat] = useState({ envoi: false, ajoute: false, erreur: '' });

  if (!pret || utilisateur?.est_equipe || !produit) return null;

  const libelleAccessible = nom ? t('selection.bouton.ajouterNom', { nom }) : undefined;
  // Apparence des maquettes (fiche produit) : bouton blanc arrondi « ♡ Sélectionner ce produit » ; « panneau » : contour (téléphone).
  const maquette = apparence === 'fiche' || apparence === 'panneau';
  const classeMaquette = apparence === 'fiche' ? 'm-btn blanc' : 'm-btn m-btn-contour-arrondi';
  const contenu = maquette
    ? <>{apparence === 'fiche' && <span aria-hidden="true">♡</span>}{t('selection.bouton.selectionner')}</>
    : <><Icone nom="selection" taille={18} />{t('selection.bouton.ajouter')}</>;

  if (!utilisateur) {
    const suite = encodeURIComponent(`${pathname}${search}`);
    if (maquette) {
      return <Link to={`/connexion?suite=${suite}`} className={classeMaquette} aria-label={libelleAccessible}>{contenu}</Link>;
    }
    return (
      <Bouton as={Link} to={`/connexion?suite=${suite}`} variante={variante} taille={taille} aria-label={libelleAccessible}>
        {contenu}
      </Bouton>
    );
  }

  if (lienSiAjoute && selection.estSelectionne(produit)) {
    return (
      <Bouton as={Link} to="/selection" variante="texte" taille={taille} className={styles.dansSelection}>
        <Icone nom="coche" taille={18} />{t('selection.bouton.dedans')}
      </Bouton>
    );
  }

  async function ajouter() {
    setEtat({ envoi: true, ajoute: false, erreur: '' });
    try {
      await selection.ajouter(produit, design);
      setEtat({ envoi: false, ajoute: true, erreur: '' });
    } catch (erreur) {
      setEtat({ envoi: false, ajoute: false, erreur: erreur?.message || t('erreurs.defaut') });
    }
  }

  return (
    <div className={`${styles.boutonSelection} ${apparence === 'fiche' ? styles.surFond : ''}`}>
      {maquette ? (
        <button type="button" className={classeMaquette} onClick={ajouter} disabled={etat.envoi} aria-busy={etat.envoi || undefined}
          aria-label={libelleAccessible}>{contenu}</button>
      ) : (
        <Bouton variante={variante} taille={taille} onClick={ajouter} chargement={etat.envoi} aria-label={libelleAccessible}>
          {contenu}
        </Bouton>
      )}
      <p className={etat.erreur ? styles.erreur : styles.confirme} role="status" aria-live="polite">
        {etat.erreur}
        {etat.ajoute && (
          <>
            {t('selection.bouton.ajoute')}{' '}
            <Link to="/selection">{t('selection.bouton.voir')}</Link>
          </>
        )}
      </p>
    </div>
  );
}
