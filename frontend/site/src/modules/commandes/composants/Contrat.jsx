// Résumé du contrat d'une commande signée (lecture seule, fourni par le serveur) avec feuille d'impression.
import { useRef } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import Icone from '@partage/ui/Icone.jsx';
import { date, dateHeure, fcfa } from '@partage/utils/format.js';

import { imprimerElement } from '@/composants/imprimer.js';
import { useTraduction } from '@/i18n/index.js';

import styles from '../Commandes.module.css';

/** Adresse du contrat : texte ou objet {ville, quartier, rue_ou_repere}. */
const texteAdresse = (a) => (typeof a === 'string' ? a : [a?.rue_ou_repere, a?.quartier, a?.ville].filter(Boolean).join(', '));

/** Ligne du contrat : texte ou objet (nom du produit et du design, tels qu'enregistrés). */
function texteLigne(l) {
  if (typeof l === 'string') return l;
  const produit = l?.produit_nom || l?.nom || l?.produit?.nom || l?.libelle || '';
  const design = l?.design_nom || l?.design?.nom || '';
  return [l?.produit_reference, produit, design].filter(Boolean).join(' · ');
}

export default function Contrat({ contrat }) {
  const { t } = useTraduction();
  const feuille = useRef(null);
  if (!contrat) return null;
  const lignes = Array.isArray(contrat.lignes) ? contrat.lignes : [];
  return (
    <section aria-labelledby="titre-contrat" className={styles.bloc}>
      <div className={styles.enteteBloc}>
        <h2 id="titre-contrat">{t('commandes.contrat.titre')}</h2>
        <Bouton variante="contour" taille="petit" onClick={() => imprimerElement(feuille.current)} className="masquer-impression">
          <Icone nom="commandes" taille={16} />{t('commandes.contrat.imprimer')}
        </Bouton>
      </div>
      <article ref={feuille} className={styles.feuille}>
        <h3>{t('commandes.contrat.reference', { reference: contrat.reference })}</h3>
        <dl className={styles.chiffres}>
          <div><dt>{t('commandes.contrat.signeLe')}</dt><dd>{dateHeure(contrat.signe_le)}</dd></div>
          <div>
            <dt>{t('commandes.contrat.accepteePar')}</dt>
            <dd>{t(`commandes.contrat.par.${contrat.accepte_par === 'equipe' ? 'equipe' : 'client'}`)}</dd>
          </div>
          <div>
            <dt>{t('commandes.contrat.client')}</dt>
            <dd>{[contrat.client?.nom_complet, contrat.client?.email, contrat.client?.telephone].filter(Boolean).join(' · ')}</dd>
          </div>
          <div><dt>{t('commandes.contrat.adresse')}</dt><dd>{texteAdresse(contrat.adresse)}</dd></div>
          <div><dt>{t('commandes.contrat.montant')}</dt><dd>{fcfa(contrat.montant)}</dd></div>
          {contrat.prix_m2 !== null && contrat.prix_m2 !== undefined && (
            <div><dt>{t('commandes.proposition.prixM2')}</dt><dd>{t('commandes.negociation.parM2', { montant: fcfa(contrat.prix_m2) })}</dd></div>
          )}
          {contrat.delai_jours ? (
            <div><dt>{t('commandes.proposition.delai')}</dt><dd>{t('commandes.negociation.jours', { n: contrat.delai_jours })}</dd></div>
          ) : null}
        </dl>
        {lignes.length > 0 && (
          <>
            <h4>{t('commandes.contrat.produits')}</h4>
            <ul>{lignes.map((l, i) => <li key={i}>{texteLigne(l)}</li>)}</ul>
          </>
        )}
        <p className={styles.meta}>{t('commandes.contrat.edite', { date: date(contrat.signe_le) })}</p>
      </article>
    </section>
  );
}
