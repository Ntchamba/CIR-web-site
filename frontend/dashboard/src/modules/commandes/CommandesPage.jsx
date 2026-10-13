// BF-16 : gestion des commandes. Liste filtrable à gauche, détail et négociation à droite.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import Entete from '@/components/layout/Entete.jsx';
import Chargement from '@/components/ui/Chargement.jsx';
import Icone from '@/components/ui/Icone.jsx';
import { BadgeStatut, Erreur } from '@/components/ui/elements.jsx';
import useApi from '@/hooks/useApi.js';
import { api } from '@/lib/api.js';
import { depuis, surface } from '@shared/format.js';

import DetailCommande from './DetailCommande.jsx';

const FILTRES = [['toutes', 'Toutes'], ['nouvelle', 'Nouvelles'], ['negociation', 'En négociation'],
  ['contrat_signe', 'Contrat signé'], ['travaux', 'Travaux'], ['terminee', 'Terminées']];

export default function CommandesPage() {
  const { numero } = useParams();
  const [filtre, setFiltre] = useState('toutes');
  const [recherche, setRecherche] = useState('');
  const [terme, setTerme] = useState('');
  useEffect(() => { const t = setTimeout(() => setTerme(recherche.trim()), 300); return () => clearTimeout(t); }, [recherche]);

  const compteurs = useApi((s) => api.get('/admin/commandes/compteurs/', { signal: s }), []);
  const liste = useApi((s) => {
    const p = new URLSearchParams({ taille: '50' });
    if (filtre !== 'toutes') p.set('statut', filtre);
    if (terme) p.set('search', terme);
    return api.get(`/admin/commandes/?${p}`, { signal: s });
  }, [filtre, terme]);
  const commandes = liste.donnees?.results || [];
  const active = numero || commandes[0]?.numero;
  const rafraichir = () => { liste.recharger(); compteurs.recharger(); };

  return (
    <>
      <Entete titre="Commandes" intro="Suivez chaque commande, négociez le prix et mettez à jour son étape.">
        <label className="recherche">
          <span className="visuellement-cache">Rechercher une commande</span>
          <Icone nom="recherche" taille={18} />
          <input type="search" placeholder="N°, client, ville, produit…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </label>
      </Entete>
      <div className="coque-contenu">
        <div className="filtres" role="group" aria-label="Filtrer par étape">
          {FILTRES.map(([v, l]) => (
            <button key={v} type="button" className="filtre" aria-pressed={filtre === v} onClick={() => setFiltre(v)}>
              {l}<span className="nb">{compteurs.donnees?.[v] ?? ''}</span>
            </button>
          ))}
        </div>
        <Erreur erreur={liste.erreur} reessayer={liste.recharger} />
        <div className="rangee">
          <nav aria-label="Liste des commandes" style={{ flex: '1 1 320px', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {liste.chargement && !liste.donnees && <Chargement />}
            {liste.donnees && commandes.length === 0 && <p className="vide">Aucune commande.</p>}
            {commandes.map((c) => (
              <Link key={c.numero} to={`/commandes/${c.numero}`} className="carte"
                style={{ padding: 14, display: 'flex', gap: 12, alignItems: 'center', textDecoration: 'none', color: 'inherit',
                  borderColor: c.numero === active ? 'var(--bleu)' : undefined, borderWidth: c.numero === active ? 2 : 1 }}>
                {c.vignette ? <img className="vignette" src={c.vignette} alt="" /> : <span className="vignette" />}
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span className="mono">{c.numero}</span><span className="discret" style={{ fontSize: 12 }}>{depuis(c.cree_le)}</span>
                  </span>
                  <strong style={{ fontSize: 14 }}>{c.client_nom} <span className="discret" style={{ fontWeight: 400 }}>· {c.type_batiment_libelle}, {c.ville}</span></strong>
                  <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span className="discret" style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.produit_principal} · {surface(c.surface_totale)}
                    </span>
                    <BadgeStatut statut={c.statut} />
                  </span>
                  {c.non_lus > 0 && <span style={{ color: 'var(--corail)', fontSize: 12, fontWeight: 600 }}>{c.non_lus} message(s) non lu(s)</span>}
                </span>
              </Link>
            ))}
          </nav>
          <div style={{ flex: '999 1 560px', minWidth: 0 }}>
            {active ? <DetailCommande key={active} numero={active} surChangement={rafraichir} /> : null}
          </div>
        </div>
      </div>
    </>
  );
}
