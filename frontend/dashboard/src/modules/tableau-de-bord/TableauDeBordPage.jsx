// Accueil du tableau de bord : chiffres clés, commandes par mois, commandes à traiter, demandes.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import Entete from '@/components/layout/Entete.jsx';
import Chargement from '@/components/ui/Chargement.jsx';
import { BadgeStatut, Erreur, Kpi } from '@/components/ui/elements.jsx';
import useApi from '@/hooks/useApi.js';
import { api, resultats } from '@/lib/api.js';
import { useAuth } from '@/modules/auth/AuthContext.jsx';
import { depuis, montant, surface, TYPES_BATIMENT } from '@shared/format.js';

import GraphiqueMois from './GraphiqueMois.jsx';

const PERIODES = [['7j', '7 jours'], ['mois', 'Ce mois'], ['12m', '12 mois']];

export default function TableauDeBordPage() {
  const { utilisateur } = useAuth();
  const naviguer = useNavigate();
  const [periode, setPeriode] = useState('mois');
  const stats = useApi((s) => api.get(`/admin/statistiques/?periode=${periode}`, { signal: s }), [periode]);
  const aTraiter = useApi((s) => Promise.all([
    api.get('/admin/commandes/?statut=nouvelle&taille=6', { signal: s }).then(resultats),
    api.get('/admin/commandes/?statut=negociation&taille=6', { signal: s }).then(resultats),
  ]).then(([a, b]) => [...a, ...b].slice(0, 8)), []);
  const demandes = useApi((s) => api.get('/admin/contact/?traitee=false&taille=4', { signal: s }).then(resultats), []);
  const d = stats.donnees;

  return (
    <>
      <Entete titre={`Bonjour, ${utilisateur?.nom_complet?.split(' ')[0] || ''}`}
        intro="Voici l'activité de la plateforme." />
      <div className="coque-contenu">
        <div className="filtres" role="group" aria-label="Période">
          {PERIODES.map(([v, l]) => (
            <button key={v} type="button" className="filtre" aria-pressed={periode === v} onClick={() => setPeriode(v)}>{l}</button>
          ))}
        </div>
        <Erreur erreur={stats.erreur} reessayer={stats.recharger} />
        {!d ? <Chargement /> : (
          <>
            <div className="grille-kpi">
              <Kpi libelle="Commandes" valeur={d.commandes} note="sur la période" />
              <Kpi libelle="Négociations en cours" valeur={d.negociations} note="à suivre" />
              <Kpi libelle="Contrats signés" valeur={d.contrats_signes} note={montant(d.montant_signe)} />
              <Kpi libelle="Nouveaux clients" valeur={d.nouveaux_clients}
                note={Object.entries(d.nouveaux_clients_par_type).map(([t, n]) => `${TYPES_BATIMENT[t]} ${n}`).join(' · ') || '—'} />
              <Kpi libelle="Demandes sur mesure" valeur={d.demandes_sur_mesure} note="à traiter" />
            </div>

            <div className="rangee">
              <section className="carte" style={{ flex: '2 1 520px' }}>
                <div className="carte-titre"><h2>Commandes par mois</h2><span className="discret">12 derniers mois</span></div>
                <GraphiqueMois serie={d.par_mois} />
              </section>
              <section className="carte" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <h2>Par type de bâtiment</h2>
                {d.repartition.length === 0 && <p className="discret">Aucune commande sur la période.</p>}
                {d.repartition.map((r) => (
                  <div key={r.type} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{TYPES_BATIMENT[r.type]}</span><span className="mono">{r.pourcentage} %</span>
                    </span>
                    <span style={{ height: 10, borderRadius: 5, background: 'var(--filet-2)' }} title={`${r.n} commande(s)`}>
                      <span style={{ display: 'block', width: `${r.pourcentage}%`, height: 10, borderRadius: 5, background: 'var(--bleu)' }} />
                    </span>
                  </div>
                ))}
                <p className="discret">Surface commandée : <strong className="mono">{surface(d.surface_commandee)}</strong></p>
              </section>
            </div>
          </>
        )}

        <section className="carte" style={{ padding: '24px 0 8px' }}>
          <div className="carte-titre" style={{ padding: '0 24px' }}>
            <h2>Commandes à traiter</h2><Link to="/commandes">Toutes les commandes</Link>
          </div>
          <Erreur erreur={aTraiter.erreur} />
          <div className="tableau-boite">
            <table className="tableau" style={{ minWidth: 720 }}>
              <thead><tr><th>N°</th><th>Client</th><th>Produit</th><th>Surface</th><th>Statut</th><th>Reçue</th></tr></thead>
              <tbody>
                {(aTraiter.donnees || []).map((c) => (
                  <tr key={c.numero} className="cliquable" onClick={() => naviguer(`/commandes/${c.numero}`)}>
                    <td className="mono"><Link to={`/commandes/${c.numero}`}>{c.numero}</Link></td>
                    <td>{c.client_nom}<br /><span className="discret">{c.type_batiment_libelle} · {c.ville}</span></td>
                    <td><span className="cellule-produit">{c.vignette && <img className="vignette" src={c.vignette} alt="" />}{c.produit_principal}</span></td>
                    <td className="mono">{surface(c.surface_totale)}</td>
                    <td><BadgeStatut statut={c.statut} /></td>
                    <td className="discret">{depuis(c.cree_le)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {aTraiter.donnees?.length === 0 && <p className="vide">Rien à traiter pour l'instant.</p>}
          </div>
        </section>

        <div className="rangee">
          <section className="carte">
            <div className="carte-titre"><h2>Demandes de contact</h2><Link to="/demandes">Voir tout</Link></div>
            {(demandes.donnees || []).map((dm) => (
              <div key={dm.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--filet-2)' }}>
                <strong>{dm.nom}</strong> · <span className="discret">{dm.objet_libelle} · {depuis(dm.cree_le)}</span>
                <p className="discret" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dm.message}</p>
              </div>
            ))}
            {demandes.donnees?.length === 0 && <p className="discret">Aucune demande en attente.</p>}
          </section>
          <section className="carte">
            <h2 style={{ marginBottom: 10 }}>Produits les plus demandés</h2>
            {(d?.produits_populaires || []).map((p, i) => (
              <div key={p.slug} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--filet-2)' }}>
                <span className="mono discret">{i + 1}</span><span style={{ flex: 1 }}>{p.nom}</span><span className="mono">{p.n}</span>
              </div>
            ))}
            {d && d.produits_populaires.length === 0 && <p className="discret">Pas encore de commande sur la période.</p>}
          </section>
        </div>
      </div>
    </>
  );
}
