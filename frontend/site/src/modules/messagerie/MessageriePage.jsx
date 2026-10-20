// BF-11 : messagerie du client (/messages). Une conversation avec l'équipe, en direct, avec pièces jointes.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

import usePageMeta from '@partage/utils/usePageMeta.js';

import { useTraduction } from '@/i18n/index.js';
import BoutonAppel from '@/modules/appels/composants/BoutonAppel.jsx';

import Composeur from './composants/Composeur.jsx';
import FilMessages from './composants/FilMessages.jsx';
import useConversation from './useConversation.js';
import useNonLus from './useNonLus.js';
import styles from './Messagerie.module.css';

function usePageVisible() {
  const [visible, setVisible] = useState(() => document.visibilityState !== 'hidden');
  useEffect(() => {
    const maj = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', maj);
    return () => document.removeEventListener('visibilitychange', maj);
  }, []);
  return visible;
}

export default function MessageriePage() {
  const { t } = useTraduction();
  const [parametres] = useSearchParams();
  const visible = usePageVisible();
  const [auBas, setAuBas] = useState(true);
  const nonLus = useNonLus();
  const conversation = useConversation({ lectureActive: visible && auBas });

  // Titre de l'onglet avec le nombre de messages non lus (utile quand l'onglet est en arrière-plan).
  const titre = t('messagerie.titre');
  usePageMeta(nonLus > 0 ? t('messagerie.titreNonLus', { n: nonLus, titre }) : titre);

  return (
    <div className={`conteneur ${styles.page}`}>
      <div className={styles.entete}>
        <div>
          <h1 className="titre-page">{titre}</h1>
          <p className={styles.intro}>{t('messagerie.intro')}</p>
          {nonLus > 0 && <p className={styles.nonLus} role="status">{t('messagerie.nonLus', { n: nonLus })}</p>}
        </div>
        <BoutonAppel />
      </div>
      <FilMessages
        messages={conversation.messages}
        aPlus={conversation.aPlus}
        chargement={conversation.chargement}
        chargementAvant={conversation.chargementAvant}
        erreur={conversation.erreur}
        equipeEcrit={conversation.equipeEcrit}
        onChargerAvant={conversation.chargerAvant}
        onRecharger={conversation.recharger}
        onReessayer={conversation.reessayer}
        onRetirer={conversation.retirer}
        onAuBas={setAuBas}
      />
      <Composeur onEnvoyer={conversation.envoyer} onEcriture={conversation.signalerEcriture}
        commandeInitiale={parametres.get('commande') || ''} />
    </div>
  );
}
