// BF-11 : messagerie avec les clients (équipe). Liste des conversations à gauche, fil à droite ; sur téléphone, la liste
// puis le fil en plein écran avec un bouton de retour.
import { useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import usePageMeta from '@partage/utils/usePageMeta.js';

import { TAILLE_PAGE } from '@/composants/useListe.js';
import { useTraduction } from '@/i18n/index.js';
import { useDirect } from '@/layout/direct.js';
import BoutonBrouillonIA from '@/modules/assistant/composants/BoutonBrouillonIA.jsx';

import ContexteClient from './composants/ContexteClient.jsx';
import FilMessages from './composants/FilMessages.jsx';
import ListeConversations from './composants/ListeConversations.jsx';
import NouvelleConversation from './composants/NouvelleConversation.jsx';
import SaisieMessage from './composants/SaisieMessage.jsx';
import useFil from './useFil.js';
import useMessagerie from './useMessagerie.js';
import styles from './Messagerie.module.css';

function Conversation({ selection, selectionId, surRetour, surLu }) {
  const { t } = useTraduction();
  const direct = useDirect();
  const fil = useFil(selectionId);
  // Texte copié depuis un brouillon de l'assistant : placé dans la zone de saisie, jamais envoyé sans geste de l'équipe.
  const [insertion, setInsertion] = useState(null);
  const client = selection?.client || null;
  // Conversation absente de la liste affichée : le nom vient d'un message du client, s'il y en a un.
  const nomDuFil = client ? '' : fil.messages.find((m) => m.auteur_role === 'client' && m.auteur_nom)?.auteur_nom || '';
  return (
    <section className={styles.conversationOuverte} aria-label={t('messagerie.conversationAvec', { nom: client?.nom_complet || '' })}>
      <ContexteClient client={client} nom={nomDuFil} surRetour={surRetour} />
      <FilMessages conversationId={selectionId} fil={fil} surLu={(jusquA) => surLu(selectionId, jusquA)} />
      <div className={styles.barreBrouillon}>
        <BoutonBrouillonIA type="reponse_message" cibleId={selectionId} libelle={t('assistant.bouton.message')}
          libelleCopie={t('assistant.copier.saisie')}
          surCopie={([proposition]) => setInsertion((i) => ({ n: (i?.n || 0) + 1, texte: proposition.texte }))} />
      </div>
      <SaisieMessage key={selectionId} clientId={client?.id} surEnvoi={fil.envoyer} insertion={insertion}
        surEcrit={() => direct.etat === 'connecte' && direct.envoyer({ type: 'ecrit', conversation: selectionId })} />
    </section>
  );
}

export default function MessageriePage() {
  const { t } = useTraduction();
  usePageMeta(t('messagerie.titre'));
  const m = useMessagerie();
  const [nouvelle, setNouvelle] = useState(false);
  const pages = Math.max(1, Math.ceil(m.liste.total / TAILLE_PAGE));

  return (
    <div className={styles.page}>
      <div className={styles.enteteMessagerie}>
        <div>
          <h1 className="titre-page">{t('messagerie.titre')}</h1>
          <p className="sous-titre-page">{t('messagerie.sousTitre')}</p>
        </div>
        <Bouton variante="contour" aria-expanded={nouvelle} onClick={() => setNouvelle((o) => !o)}>
          {t('messagerie.nouvelle.bouton')}
        </Bouton>
      </div>

      {m.erreur && <MessageErreur erreur={m.erreur} />}
      {nouvelle && (
        <NouvelleConversation surFermeture={() => setNouvelle(false)}
          surChoix={async (client) => { await m.ouvrirClient(client); setNouvelle(false); }} />
      )}

      <div className={`${styles.disposition} ${m.selectionId ? styles.avecFil : ''}`}>
        <div className={styles.colonneListe}>
          <ListeConversations liste={m.liste} saisie={m.saisie} changerSaisie={m.changerSaisie} nonLus={m.nonLus}
            basculerNonLus={m.basculerNonLus} effacer={m.effacer} filtre={m.filtre} selectionId={m.selectionId}
            ouvrir={m.choisir} page={m.page} allerALaPage={m.allerALaPage} pages={pages} />
        </div>
        <div className={styles.colonneFil}>
          {m.selectionId ? (
            <Conversation key={m.selectionId} selection={m.selection} selectionId={m.selectionId} surRetour={m.fermer}
              surLu={m.lu} />
          ) : (
            <p className={styles.aucuneSelection}>{t('messagerie.choisir')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
