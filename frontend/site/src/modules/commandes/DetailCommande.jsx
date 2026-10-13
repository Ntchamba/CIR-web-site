// Détail d'une commande : étapes, projet, négociation, messagerie, paiement (à venir).
import BadgeStatut from '@/components/ui/BadgeStatut.jsx';
import Chargement from '@/components/ui/Chargement.jsx';
import MessageErreur from '@/components/ui/MessageErreur.jsx';
import useApi from '@/hooks/useApi.js';
import { date, surface } from '@shared/format.js';

import FilMessages from '../messagerie/FilMessages.jsx';
import BlocPaiement from '../paiement/BlocPaiement.jsx';
import * as commandes from './api.js';
import EtapesCommande from './EtapesCommande.jsx';
import Negociation from './Negociation.jsx';
import styles from './Commandes.module.css';

export default function DetailCommande({ numero, surChangement }) {
  const { donnees: c, chargement, erreur, recharger, modifier } = useApi((s) => commandes.detail(numero, s), [numero]);

  if (chargement && !c) return <Chargement />;
  if (erreur) return <MessageErreur erreur={erreur} reessayer={recharger} />;

  const mettreAJour = (nouvelle) => { modifier(() => nouvelle); surChangement?.(); };

  return (
    <article className={styles.detail} aria-labelledby="titre-commande">
      <header className={styles.detailEntete}>
        <div>
          <span className="etiquette">Commande {c.numero} · envoyée le {date(c.cree_le)}</span>
          <h2 id="titre-commande">
            {c.lignes.length ? c.lignes.map((l) => l.produit_nom).join(', ') : 'Design sur mesure'}
          </h2>
          <span className={styles.sousTitre}>
            {surface(c.surface_totale)} · {c.type_batiment_libelle} · {c.quartier}, {c.ville}
          </span>
        </div>
        <BadgeStatut statut={c.statut} libelle={c.statut_libelle} />
      </header>

      <EtapesCommande etapes={c.etapes} />

      {c.lignes.length > 0 && (
        <ul className={styles.lignes}>
          {c.lignes.map((l) => (
            <li key={l.id}>
              {l.vignette && <img src={l.vignette} alt="" width="56" height="56" loading="lazy" />}
              <span><strong>{l.produit_nom}</strong>{l.produit_reference && <> · <span className="mono">{l.produit_reference}</span></>}</span>
              <span className="mono">{surface(l.surface_m2)}</span>
            </li>
          ))}
        </ul>
      )}
      {c.message && <p className={styles.message}>« {c.message} »</p>}

      <Negociation commande={c} surMiseAJour={mettreAJour} />
      <BlocPaiement commande={c} />
      {c.conversation && <FilMessages conversationId={c.conversation} />}
    </article>
  );
}
