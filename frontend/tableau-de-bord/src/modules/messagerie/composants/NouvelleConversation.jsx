// « Nouvelle conversation » : recherche d'un client puis ouverture (ou reprise) de sa conversation.
import { useEffect, useId, useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';

import { resultats } from '@/app/api.js';
import { useTraduction } from '@/i18n/index.js';
import { listerClients } from '@/modules/clients/api.js';

import styles from '../Messagerie.module.css';

export default function NouvelleConversation({ surChoix, surFermeture }) {
  const { t } = useTraduction();
  const [recherche, setRecherche] = useState('');
  const [clients, setClients] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [occupe, setOccupe] = useState(null);
  const id = useId();

  useEffect(() => {
    const controleur = new AbortController();
    const minuteur = setTimeout(() => {
      listerClients({ recherche }, { signal: controleur.signal })
        .then((r) => { setClients(resultats(r)); setErreur(null); })
        .catch((e) => { if (e?.name !== 'AbortError') setErreur(e); });
    }, recherche ? 300 : 0);
    return () => { clearTimeout(minuteur); controleur.abort(); };
  }, [recherche]);

  async function choisir(client) {
    setOccupe(client.id);
    try { await surChoix(client); } catch (e) { setErreur(e); } finally { setOccupe(null); }
  }

  return (
    <section className={`carte ${styles.nouvelle}`} aria-labelledby={`${id}-titre`}>
      <div className={styles.enteteNouvelle}>
        <h2 id={`${id}-titre`} className={styles.titreCarte}>{t('messagerie.nouvelle.titre')}</h2>
        <Bouton variante="texte" onClick={surFermeture}>{t('actions.fermer')}</Bouton>
      </div>
      <Champ libelle={t('messagerie.nouvelle.rechercher')} name="client" type="search" value={recherche} autoComplete="off"
        autoFocus onChange={(e) => setRecherche(e.target.value)} />
      {erreur && <MessageErreur erreur={erreur} />}
      {clients && clients.length === 0 && <p>{t('messagerie.nouvelle.aucun')}</p>}
      {clients && clients.length > 0 && (
        <ul className={styles.choixClients} aria-label={t('messagerie.nouvelle.resultats')}>
          {clients.map((c) => (
            <li key={c.id}>
              <Bouton variante="contour" chargement={occupe === c.id} onClick={() => choisir(c)}
                aria-label={t('messagerie.nouvelle.ecrireA', { nom: c.nom_complet || c.email })}>
                <span>{c.nom_complet || c.email}</span>
              </Bouton>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
