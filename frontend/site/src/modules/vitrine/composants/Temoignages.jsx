// BF-04 : témoignages publiés. Les mots du client restent dans sa langue (attribut lang sur le texte).
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { langueGeree, infosLangue } from '@partage/i18n/langues.js';
import { date } from '@partage/utils/format.js';

import VoirPlus from '@/composants/VoirPlus.jsx';
import { useTraduction } from '@/i18n/index.js';
import { estUsage } from '@/modules/catalogue/usages.js';

import { useTemoignages } from '../useVitrine.js';
import styles from '../Vitrine.module.css';

/** Attribut lang d'un texte écrit dans `code` (« zh » → « zh-Hans ») ; rien si la langue est inconnue. */
export function attributLang(code) {
  const geree = langueGeree(code);
  if (geree) return infosLangue(geree).html;
  return typeof code === 'string' && /^[a-z]{2,3}(-[A-Za-z0-9]+)*$/.test(code) ? code : undefined;
}

export function Etoiles({ note }) {
  const { t } = useTraduction();
  const n = Math.max(0, Math.min(5, Math.round(Number(note) || 0)));
  return (
    <span className={styles.etoiles} role="img" aria-label={t('vitrine.temoignages.note', { n })}>
      {'★'.repeat(n)}<span className={styles.etoilesVides}>{'★'.repeat(5 - n)}</span>
    </span>
  );
}

function CarteTemoignage({ temoignage: tm }) {
  const { t } = useTraduction();
  const details = [tm.ville, estUsage(tm.type_chantier) ? t(`usages.${tm.type_chantier}`) : null].filter(Boolean);
  return (
    <figure className={styles.temoignage}>
      <Etoiles note={tm.note} />
      <blockquote lang={attributLang(tm.langue)} className={styles.citation}>
        <p>{tm.texte}</p>
      </blockquote>
      <figcaption className={styles.auteur}>
        <strong>{tm.nom_affiche}</strong>
        {details.length > 0 && <span>{details.join(' · ')}</span>}
        {tm.date && <time dateTime={tm.date}>{date(tm.date)}</time>}
      </figcaption>
    </figure>
  );
}

export default function Temoignages() {
  const { t } = useTraduction();
  const liste = useTemoignages();
  return (
    <div>
      {liste.chargement && !liste.elements.length && <Chargement />}
      <MessageErreur erreur={liste.erreur} reessayer={liste.recharger} />
      {!liste.chargement && !liste.erreur && !liste.elements.length && (
        <EtatVide titre={t('vitrine.temoignages.vide.titre')} niveau={3}>{t('vitrine.temoignages.vide.texte')}</EtatVide>
      )}
      {liste.elements.length > 0 && (
        <ul className={styles.grilleTemoignages}>
          {liste.elements.map((tm) => <li key={tm.id}><CarteTemoignage temoignage={tm} /></li>)}
        </ul>
      )}
      <VoirPlus liste={liste} />
    </div>
  );
}
