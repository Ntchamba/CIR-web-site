// BF-01 : catalogue des produits, filtrable par type de bâtiment, famille et recherche.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import Bandeau from '@/components/layout/Bandeau.jsx';
import Bouton from '@/components/ui/Bouton.jsx';
import Chargement from '@/components/ui/Chargement.jsx';
import EtatVide from '@/components/ui/EtatVide.jsx';
import MessageErreur from '@/components/ui/MessageErreur.jsx';
import useApi from '@/hooks/useApi.js';
import usePageMeta from '@/hooks/usePageMeta.js';

import * as catalogue from './api.js';
import CarteProduit from './CarteProduit.jsx';
import Filtres from './Filtres.jsx';
import styles from './Catalogue.module.css';

export default function CataloguePage() {
  usePageMeta('Catalogue', 'Sols autolissants, terrazzo, finitions antidérapantes et anti-UV : le catalogue du CIR.');
  const [parametres, setParametres] = useSearchParams();
  const filtres = { usage: parametres.get('usage') || '', famille: parametres.get('famille') || '',
    recherche: parametres.get('q') || '' };
  const cle = `${filtres.usage}|${filtres.famille}|${filtres.recherche}`;
  const [pagination, setPagination] = useState({ cle, page: 1 });
  const page = pagination.cle === cle ? pagination.page : 1;
  const [liste, setListe] = useState([]);

  const familles = useApi((signal) => catalogue.familles(signal), []);
  const resultat = useApi((signal) => catalogue.produits({ ...filtres, page }, signal), [cle, page]);

  useEffect(() => {
    if (!resultat.donnees) return;
    setListe((avant) => (page === 1 ? resultat.donnees.results : [...avant, ...resultat.donnees.results]));
  }, [resultat.donnees]); // eslint-disable-line react-hooks/exhaustive-deps

  const changer = (cle, valeur) => {
    const p = new URLSearchParams(parametres);
    if (valeur) p.set(cle, valeur); else p.delete(cle);
    setParametres(p, { replace: true });
  };

  return (
    <>
      <Bandeau titre="Catalogue" sousTitre="Des sols durables, des sols uniques" />
      <div className={`conteneur ${styles.mise}`}>
        <Filtres familles={familles.donnees || []} valeurs={filtres} onChange={changer} />
        <section className={styles.resultats} aria-live="polite">
          <MessageErreur erreur={resultat.erreur} reessayer={resultat.recharger} />
          {resultat.chargement && page === 1 && <Chargement />}
          {!resultat.chargement && !resultat.erreur && liste.length === 0 && (
            <EtatVide titre="Aucun produit ne correspond"
              action={<Bouton variante="contour" onClick={() => setParametres({})}>Voir tout le catalogue</Bouton>}>
              Essayez un autre type de bâtiment ou une autre famille.
            </EtatVide>
          )}
          <div className="grille-vignettes">
            {liste.map((p, i) => <CarteProduit key={p.id} produit={p} prioritaire={i < 3} />)}
          </div>
          {resultat.donnees?.next && (
            <div className={styles.plus}>
              <Bouton variante="contour" chargement={resultat.chargement} onClick={() => setPagination({ cle, page: page + 1 })}>
                Voir plus de produits
              </Bouton>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
