// BF-17 : comptes clients, adresse de chantier et historique des commandes.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import Entete from '@/components/layout/Entete.jsx';
import Chargement from '@/components/ui/Chargement.jsx';
import Icone from '@/components/ui/Icone.jsx';
import { BadgeStatut, Erreur, Interrupteur } from '@/components/ui/elements.jsx';
import useApi from '@/hooks/useApi.js';
import { api, resultats } from '@/lib/api.js';
import { date, surface, TYPES_BATIMENT } from '@shared/format.js';

const TYPES = [['', 'Tous'], ['maison', 'Maison'], ['industrie', 'Industrie'], ['entreprise', 'Entreprise']];

export default function ClientsPage() {
  const { id } = useParams();
  const naviguer = useNavigate();
  const [type, setType] = useState('');
  const [recherche, setRecherche] = useState('');
  const [terme, setTerme] = useState('');
  useEffect(() => { const t = setTimeout(() => setTerme(recherche.trim()), 300); return () => clearTimeout(t); }, [recherche]);
  const liste = useApi((s) => {
    const p = new URLSearchParams({ taille: '100' });
    if (type) p.set('type_client', type);
    if (terme) p.set('search', terme);
    return api.get(`/admin/comptes/clients/?${p}`, { signal: s });
  }, [type, terme]);
  const clients = liste.donnees?.results || [];
  const actif = id ? Number(id) : null;

  return (
    <>
      <Entete titre="Clients" intro="Comptes clients, adresses de chantier et historique des commandes.">
        <label className="recherche">
          <span className="visuellement-cache">Rechercher un client</span>
          <Icone nom="recherche" taille={18} />
          <input type="search" placeholder="Nom, e-mail, téléphone, ville…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </label>
      </Entete>
      <div className="coque-contenu">
        <div className="filtres" role="group" aria-label="Type de client">
          {TYPES.map(([v, l]) => <button key={v || 'tous'} type="button" className="filtre" aria-pressed={type === v} onClick={() => setType(v)}>{l}</button>)}
          <span className="discret" style={{ alignSelf: 'center' }}>{liste.donnees ? `${liste.donnees.count} client(s)` : ''}</span>
        </div>
        <Erreur erreur={liste.erreur} reessayer={liste.recharger} />
        <div className="rangee">
          <section className="carte" style={{ flex: '999 1 560px', padding: '8px 0' }}>
            {liste.chargement && !liste.donnees ? <Chargement /> : (
              <div className="tableau-boite">
                <table className="tableau" style={{ minWidth: 640 }}>
                  <thead><tr><th>Client</th><th>Type</th><th>Ville</th><th>Commandes</th><th>Compte</th></tr></thead>
                  <tbody>
                    {clients.map((c) => (
                      <tr key={c.id} className={`cliquable ${c.id === actif ? 'choisie' : ''}`} onClick={() => naviguer(`/clients/${c.id}`)}>
                        <td>
                          <span className="cellule-produit">
                            <span className="avatar" style={{ background: 'var(--fond-2)', color: 'var(--bleu)' }}>{c.initiales}</span>
                            <span><Link to={`/clients/${c.id}`}><strong>{c.nom_complet}</strong></Link><br /><span className="discret">{c.telephone || c.email}</span></span>
                          </span>
                        </td>
                        <td>{TYPES_BATIMENT[c.type_client]}</td>
                        <td>{c.ville || '—'}</td>
                        <td className="mono">{c.nb_commandes}</td>
                        <td>
                          {!c.is_active ? <span className="discret">Désactivé</span>
                            : c.a_une_adresse ? <span style={{ color: '#1f6b43', fontWeight: 600 }}>Actif</span>
                              : <span style={{ color: '#a8361b', fontWeight: 600 }}>Sans adresse</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {clients.length === 0 && <p className="vide">Aucun client.</p>}
              </div>
            )}
          </section>
          {actif && <FicheClient key={actif} id={actif} surChangement={liste.recharger} />}
        </div>
      </div>
    </>
  );
}

function FicheClient({ id, surChangement }) {
  const fiche = useApi((s) => api.get(`/admin/comptes/clients/${id}/`, { signal: s }), [id]);
  const commandes = useApi((s) => api.get(`/admin/commandes/?client=${id}&taille=20`, { signal: s }).then(resultats), [id]);
  const c = fiche.donnees;
  if (fiche.erreur) return <Erreur erreur={fiche.erreur} />;
  if (!c) return <Chargement />;
  const telephone = (c.telephone || '').replace(/\D/g, '');

  const activer = async (actifVoulu) => {
    const maj = await api.patch(`/admin/comptes/clients/${id}/`, { is_active: actifVoulu });
    fiche.modifier(() => maj);
    surChangement();
  };

  return (
    <aside className="carte" aria-label="Fiche client" style={{ flex: '0 1 360px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span className="avatar" style={{ width: 56, height: 56, borderRadius: 28, fontSize: 18 }}>{c.initiales}</span>
        <span><strong style={{ fontFamily: 'var(--police-titre)', fontSize: 21, fontWeight: 500 }}>{c.nom_complet}</strong><br />
          <span className="discret">{TYPES_BATIMENT[c.type_client]} · client depuis le {date(c.date_joined)}</span></span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14 }}>
        <span>{c.telephone || 'Téléphone non renseigné'}</span>
        <span>{c.email}</span>
        <span className="discret">{c.adresse ? `${c.adresse.rue_repere}, ${c.adresse.quartier}, ${c.adresse.ville}` : 'Adresse non renseignée'}</span>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div className="kpi" style={{ flex: 1, padding: 14 }}><span className="valeur" style={{ fontSize: 26 }}>{c.nb_commandes}</span><span className="note">commandes</span></div>
        <div className="kpi" style={{ flex: 1, padding: 14 }}><span className="valeur" style={{ fontSize: 26 }}>{surface(c.surface_totale)}</span><span className="note">commandés</span></div>
      </div>
      <div>
        <span className="etiquette">Historique</span>
        {(commandes.donnees || []).map((o) => (
          <Link key={o.numero} to={`/commandes/${o.numero}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--filet-2)', color: 'inherit', textDecoration: 'none' }}>
            <span><span className="mono">{o.numero}</span><br /><span className="discret">{o.produit_principal}</span></span>
            <BadgeStatut statut={o.statut} />
          </Link>
        ))}
        {commandes.donnees?.length === 0 && <p className="discret">Aucune commande.</p>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {telephone && <a className="bouton secondaire petit" href={`https://wa.me/${telephone}`} target="_blank" rel="noopener noreferrer"><Icone nom="whatsapp" taille={16} />WhatsApp</a>}
        <Link className="bouton secondaire petit" to="/messagerie"><Icone nom="message" taille={16} />Messagerie</Link>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingTop: 12, borderTop: '1px solid var(--filet)' }}>
        <span><strong style={{ fontWeight: 500 }}>Compte actif</strong><br /><span className="discret" style={{ fontSize: 13 }}>Désactivé : le client ne peut plus se connecter.</span></span>
        <Interrupteur actif={c.is_active} libelle="Compte actif" onChange={activer} />
      </div>
    </aside>
  );
}
