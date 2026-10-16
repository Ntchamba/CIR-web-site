// BF-02 : chantiers du CIR, filtrables par type (?type= dans l'adresse), « Voir plus ».
import { useSearchParams } from 'react-router';

import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';

import VoirPlus from '@/composants/VoirPlus.jsx';
import { useTraduction } from '@/i18n/index.js';
import { estUsage, USAGES } from '@/modules/catalogue/usages.js';

import { useRealisations } from '../useVitrine.js';
import styles from '../Vitrine.module.css';
import CarteRealisation from './CarteRealisation.jsx';

export default function Realisations() {
  const { t } = useTraduction();
  const [parametres, setParametres] = useSearchParams();
  const brut = parametres.get('type') || '';
  const type = estUsage(brut) ? brut : '';
  const liste = useRealisations(type);

  function choisir(code) {
    setParametres((actuels) => {
      const suivants = new URLSearchParams(actuels);
      if (code) suivants.set('type', code);
      else suivants.delete('type');
      return suivants;
    }, { replace: true, preventScrollReset: true });
  }

  return (
    <section id="chantiers" className={styles.section} aria-labelledby="titre-chantiers">
      <h2 id="titre-chantiers" className={styles.titreSection}>{t('vitrine.realisations.titre')}</h2>
      <div role="group" aria-label={t('vitrine.realisations.filtre')} className={styles.puces}>
        {['', ...USAGES].map((code) => (
          <button key={code || 'tous'} type="button" className={styles.puce} aria-pressed={type === code}
            onClick={() => choisir(code)}>
            {code ? t(`usages.${code}`) : t('vitrine.realisations.tous')}
          </button>
        ))}
      </div>
      {liste.chargement && !liste.elements.length && <Chargement />}
      <MessageErreur erreur={liste.erreur} reessayer={liste.recharger} />
      {!liste.chargement && !liste.erreur && !liste.elements.length && (
        <EtatVide titre={t('vitrine.realisations.vide.titre')} niveau={3}>
          {type ? t('vitrine.realisations.vide.texteType') : t('vitrine.realisations.vide.texte')}
        </EtatVide>
      )}
      {liste.elements.length > 0 && (
        <ul className={styles.grilleRealisations}>
          {liste.elements.map((r) => <li key={r.id}><CarteRealisation realisation={r} /></li>)}
        </ul>
      )}
      <VoirPlus liste={liste} />
    </section>
  );
}
