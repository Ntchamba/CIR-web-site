// Devis envoyé au client : référence, état, total, validité (et « expiré »), lignes à la demande, impression.
// Lecture seule : le client répond par la négociation de la commande (lien en dessous).
import { useId, useRef, useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import Icone from '@partage/ui/Icone.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { date, fcfa } from '@partage/utils/format.js';
import { localeIntl } from '@partage/i18n/i18n.js';

import { imprimerElement } from '@/composants/imprimer.js';
import { useTraduction } from '@/i18n/index.js';

import { useDevisDetail } from '../useDevis.js';
import styles from '../Devis.module.css';

const decimal = (v) => new Intl.NumberFormat(localeIntl(), { maximumFractionDigits: 2 }).format(Number(v));
const rempli = (v) => v !== null && v !== undefined && v !== '';

function DetailLigne({ ligne }) {
  const { t } = useTraduction();
  const morceaux = [];
  if (rempli(ligne.surface_m2) && Number(ligne.surface_m2) > 0) morceaux.push(t('devis.apercu.surface', { valeur: decimal(ligne.surface_m2) }));
  if (rempli(ligne.quantite_kg)) morceaux.push(t('devis.apercu.quantite', { valeur: decimal(ligne.quantite_kg) }));
  if (rempli(ligne.prix_kg)) morceaux.push(t('devis.apercu.prixKg', { montant: fcfa(ligne.prix_kg) }));
  if (rempli(ligne.prix_m2)) morceaux.push(t('devis.apercu.prixM2', { montant: fcfa(ligne.prix_m2) }));
  return morceaux.length ? <span className={styles.detailLigne}>{morceaux.join(' · ')}</span> : null;
}

export default function ApercuDevis({ resume }) {
  const { t } = useTraduction();
  const [ouvert, setOuvert] = useState(false);
  const detail = useDevisDetail(resume.id, ouvert);
  const feuille = useRef(null);
  const idTitre = useId();
  const devis = detail.donnees;
  const lignes = devis?.lignes || [];

  return (
    <article ref={feuille} className={styles.devis} aria-labelledby={idTitre} id={`devis-${resume.id}`}>
      <header className={styles.enteteDevis}>
        <h3 id={idTitre}>{t('devis.apercu.titre', { reference: resume.reference })}</h3>
        <span className={styles.etat}>{t(`devis.etats.${resume.etat}`)}</span>
        {resume.expire && <span className={styles.expire}>{t('devis.apercu.expire')}</span>}
      </header>
      <dl className={styles.resume}>
        <div><dt>{t('devis.apercu.total')}</dt><dd className={styles.total}>{fcfa(resume.total)}</dd></div>
        {resume.valide_jusqu_au && (
          <div><dt>{t('devis.apercu.validite')}</dt><dd>{date(resume.valide_jusqu_au)}</dd></div>
        )}
        {resume.envoye_le && <div><dt>{t('devis.apercu.envoyeLe')}</dt><dd>{date(resume.envoye_le)}</dd></div>}
      </dl>

      {ouvert && detail.chargement && !devis && <Chargement />}
      {ouvert && detail.erreur && <MessageErreur erreur={detail.erreur} reessayer={detail.recharger} />}
      {ouvert && devis && (
        <>
          <table className={styles.tableau}>
            <caption className="visuellement-cache">{t('devis.apercu.lignes')}</caption>
            <thead>
              <tr><th scope="col">{t('devis.apercu.designation')}</th><th scope="col" className={styles.droite}>{t('devis.apercu.montant')}</th></tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.ordre ?? l.libelle}>
                  <td><span>{l.libelle}</span><DetailLigne ligne={l} /></td>
                  <td className={styles.droite}>{fcfa(l.montant)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><th scope="row">{t('devis.apercu.total')}</th><td className={styles.droite}>{fcfa(devis.total ?? resume.total)}</td></tr>
            </tfoot>
          </table>
          {devis.notes && <p className={styles.notes}>{devis.notes}</p>}
        </>
      )}

      <div className={`${styles.actions} masquer-impression`}>
        <Bouton variante="contour" taille="petit" aria-expanded={ouvert} onClick={() => setOuvert((o) => !o)}>
          {ouvert ? t('devis.apercu.masquer') : t('devis.apercu.voir')}
        </Bouton>
        {ouvert && devis && (
          <Bouton variante="contour" taille="petit" onClick={() => imprimerElement(feuille.current)}>
            <Icone nom="commandes" taille={16} />{t('devis.apercu.imprimer')}
          </Bouton>
        )}
        {resume.etat === 'envoye' && (
          <a href="#negociation" className={styles.lienNego}>{t('devis.apercu.repondre')}</a>
        )}
      </div>
    </article>
  );
}
