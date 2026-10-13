// BF-13 : mes commandes (liste à gauche, détail à droite), avec négociation et messagerie.
import { Link, useParams } from 'react-router-dom';

import Bandeau from '@/components/layout/Bandeau.jsx';
import BadgeStatut from '@/components/ui/BadgeStatut.jsx';
import Bouton from '@/components/ui/Bouton.jsx';
import Chargement from '@/components/ui/Chargement.jsx';
import EtatVide from '@/components/ui/EtatVide.jsx';
import MessageErreur from '@/components/ui/MessageErreur.jsx';
import useApi from '@/hooks/useApi.js';
import usePageMeta from '@/hooks/usePageMeta.js';
import { depuis, surface } from '@shared/format.js';

import * as commandes from './api.js';
import DetailCommande from './DetailCommande.jsx';
import styles from './Commandes.module.css';

export default function CommandesPage() {
  usePageMeta('Mes commandes');
  const { numero } = useParams();
  const liste = useApi((s) => commandes.liste(s), []);
  const toutes = liste.donnees || [];
  const active = numero || toutes[0]?.numero;

  return (
    <>
      <Bandeau titre="Mes commandes"
        sousTitre="Suivez l'avancement de vos travaux et négociez votre revêtement avec l'équipe." />
      <div className={`conteneur ${styles.page}`}>
        <MessageErreur erreur={liste.erreur} reessayer={liste.recharger} />
        {liste.chargement && !liste.donnees && <Chargement />}
        {liste.donnees && toutes.length === 0 && (
          <EtatVide titre="Pas encore de commande"
            action={<Bouton vers="/catalogue">Choisir dans le catalogue</Bouton>}>
            Sélectionnez un ou plusieurs designs dans le catalogue, puis passez commande.
          </EtatVide>
        )}
        {toutes.length > 0 && (
          <div className={styles.mise}>
            <nav className={styles.liste} aria-label="Mes commandes">
              {toutes.map((c) => (
                <Link key={c.numero} to={`/commandes/${c.numero}`} aria-current={c.numero === active ? 'true' : undefined}
                  className={`${styles.carte} ${c.numero === active ? styles.carteActive : ''}`}>
                  {c.vignette ? <img src={c.vignette} alt="" width="64" height="64" loading="lazy" />
                    : <span className={styles.sansImage} aria-hidden="true" />}
                  <span className={styles.carteTexte}>
                    <span className={styles.carteNumero}>Commande {c.numero}</span>
                    <span className={styles.carteInfo}>{c.produit_principal} · {surface(c.surface_totale)}</span>
                    <span className={styles.carteInfo}>{depuis(c.cree_le)} · {c.type_batiment_libelle}</span>
                    <span className={styles.carteBas}>
                      <BadgeStatut statut={c.statut} />
                      {c.non_lus > 0 && <span className={styles.pastille}>{c.non_lus} message{c.non_lus > 1 ? 's' : ''}</span>}
                    </span>
                  </span>
                </Link>
              ))}
              <Bouton vers="/commandes/nouvelle" variante="texte">Nouvelle commande →</Bouton>
            </nav>
            {active && <DetailCommande key={active} numero={active} surChangement={liste.recharger} />}
          </div>
        )}
      </div>
    </>
  );
}
