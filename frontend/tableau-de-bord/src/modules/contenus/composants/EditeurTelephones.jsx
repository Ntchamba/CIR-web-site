// Liste des numéros de téléphone affichés sur le site (ajout, retrait).
import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';

import { useTraduction } from '@/i18n/index.js';
import gestion from '@/composants/Gestion.module.css';

import styles from '../Contenus.module.css';

export default function EditeurTelephones({ telephones, surChangement, erreur }) {
  const { t } = useTraduction();
  const modifier = (i, valeur) => surChangement(telephones.map((n, j) => (j === i ? valeur : n)));
  return (
    <fieldset className={gestion.bloc}>
      <legend>{t('contenus.accueil.telephones')}</legend>
      {telephones.length === 0 && <p className={gestion.aide}>{t('contenus.accueil.aucunTelephone')}</p>}
      {telephones.map((numero, i) => {
        const libelle = t('contenus.accueil.telephoneN', { n: i + 1 });
        return (
          // eslint-disable-next-line react/no-array-index-key
          <div key={i} className={styles.telephone}>
            <Champ libelle={libelle} type="tel" inputMode="tel" name={`telephone-${i}`} value={numero}
              placeholder="+237 6XX XXX XXX" onChange={(e) => modifier(i, e.target.value)} />
            <button type="button" className={gestion.icone} aria-label={t('actions.retirerNom', { nom: libelle })}
              onClick={() => surChangement(telephones.filter((_, j) => j !== i))}>✕</button>
          </div>
        );
      })}
      {erreur && <p className={gestion.erreurChamp} role="alert">{erreur}</p>}
      <div>
        <Bouton variante="contour" taille="petit" onClick={() => surChangement([...telephones, ''])}>
          {t('contenus.accueil.ajouterTelephone')}
        </Bouton>
      </div>
    </fieldset>
  );
}
