// Détail d'une commande côté équipe : client, projet, étapes, négociation, note interne, messagerie.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import Chargement from '@/components/ui/Chargement.jsx';
import Icone from '@/components/ui/Icone.jsx';
import { BadgeStatut, Champ, Erreur } from '@/components/ui/elements.jsx';
import useApi from '@/hooks/useApi.js';
import { api } from '@/lib/api.js';
import { date, montant, prix, surface } from '@shared/format.js';

import FilMessages from '../messagerie/FilMessages.jsx';

const STATUTS = [['nouvelle', 'Nouvelle'], ['negociation', 'En négociation'], ['contrat_signe', 'Contrat signé'],
  ['travaux', 'Travaux en cours'], ['terminee', 'Terminée'], ['annulee', 'Annulée']];

export default function DetailCommande({ numero, surChangement }) {
  const { donnees: c, erreur, recharger, modifier } = useApi((s) => api.get(`/admin/commandes/${numero}/`, { signal: s }), [numero]);
  const [proposition, setProposition] = useState({ prix_m2: '', montant_total: '', delai_jours: '', message: '' });
  const [note, setNote] = useState('');
  const [envoi, setEnvoi] = useState(null);
  const [erreurAction, setErreurAction] = useState(null);
  const [info, setInfo] = useState('');
  useEffect(() => { if (c) setNote(c.note_interne || ''); }, [c?.numero]); // eslint-disable-line react-hooks/exhaustive-deps

  if (erreur) return <Erreur erreur={erreur} reessayer={recharger} />;
  if (!c) return <Chargement />;

  async function agir(nom, requete, message) {
    setEnvoi(nom); setErreurAction(null); setInfo('');
    try { const maj = await requete(); modifier(() => maj); setInfo(message); surChangement?.(); return true; }
    catch (e) { setErreurAction(e); return false; }
    finally { setEnvoi(null); }
  }

  const proposer = (e) => {
    e.preventDefault();
    const corps = Object.fromEntries(Object.entries(proposition).map(([k, v]) => [k, v === '' ? null : v]));
    agir('proposer', () => api.post(`/admin/commandes/${numero}/propositions/`, corps), 'Proposition envoyée au client.')
      .then((ok) => ok && setProposition({ prix_m2: '', montant_total: '', delai_jours: '', message: '' }));
  };
  const total = proposition.prix_m2 && Number(c.surface_totale) ? Number(proposition.prix_m2) * Number(c.surface_totale) : null;
  const telClient = (c.client.telephone || '').replace(/\D/g, '');

  return (
    <article className="carte" style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: 28 }}>
      <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <span className="etiquette">Commande</span>
          <h2 style={{ fontSize: 28, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
            <span className="mono" style={{ fontSize: 24 }}>{c.numero}</span><BadgeStatut statut={c.statut} />
          </h2>
          <span className="discret">Reçue le {date(c.cree_le)} · {c.type_batiment_libelle} · {c.ville}</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button type="button" className="bouton secondaire" disabled title="Module d'appel : bientôt disponible">
            <Icone nom="tel" taille={17} />Appeler (bientôt)
          </button>
          {telClient && <a className="bouton secondaire" href={`https://wa.me/${telClient}?text=${encodeURIComponent(`Bonjour, au sujet de votre commande ${c.numero} :`)}`}
            target="_blank" rel="noopener noreferrer"><Icone nom="whatsapp" taille={17} />WhatsApp</a>}
        </div>
      </header>

      <ol className="etapes" aria-label="Avancement">
        {c.etapes.map((e) => (
          <li key={e.code} className={e.faite ? 'faite' : e.en_cours ? 'en-cours' : ''} aria-current={e.en_cours ? 'step' : undefined}>
            <span className="trait" /><span>{e.libelle}</span>
          </li>
        ))}
      </ol>

      <div className="rangee">
        <section style={{ background: 'var(--fond)', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="etiquette">Client</span>
          <strong style={{ fontFamily: 'var(--police-titre)', fontSize: 19, fontWeight: 500 }}>{c.client.nom_complet}</strong>
          <span>{c.client.telephone || '—'}<br />{c.client.email}</span>
          <span className="discret">Chantier : {c.rue_repere}, {c.quartier}, {c.ville}</span>
          <Link to={`/clients/${c.client.id}`}>Voir la fiche client</Link>
        </section>
        <section style={{ background: 'var(--fond)', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="etiquette">Projet</span>
          {c.lignes.map((l) => (
            <div key={l.id} className="cellule-produit">
              {l.vignette && <img className="vignette" src={l.vignette} alt="" />}
              <span><strong>{l.produit_nom}</strong><br /><span className="mono discret">{surface(l.surface_m2)}{l.produit_reference ? ` · ${l.produit_reference}` : ''}</span></span>
            </div>
          ))}
          {c.sur_mesure && <span className="badge negociation">Rendu sur mesure demandé</span>}
          <span className="discret">Date souhaitée : {c.date_souhaitee ? date(c.date_souhaitee) : '—'} · Surface totale : {surface(c.surface_totale)}</span>
          {c.message && <em>« {c.message} »</em>}
        </section>
      </div>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h3 style={{ fontSize: 20 }}>Négociation</h3>
        {c.propositions.length === 0 && <p className="discret">Aucune proposition pour l'instant.</p>}
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {c.propositions.map((p) => (
            <li key={p.id} className={p.de_l_equipe ? 'msg-equipe' : 'msg-client'} style={{ maxWidth: '80%', alignSelf: p.de_l_equipe ? 'flex-end' : 'flex-start' }}>
              <span style={{ fontSize: 12, opacity: 0.8 }}>{p.de_l_equipe ? `Équipe (${p.auteur_nom})` : 'Client'} · {date(p.cree_le)} · {p.etat_libelle}</span><br />
              {(p.prix_m2 || p.montant_total) && <span className="mono" style={{ fontSize: 14 }}>
                {p.prix_m2 ? prix(p.prix_m2, 'm2') : ''}{p.montant_total ? ` · Total ${montant(p.montant_total)}` : ''}{p.delai_jours ? ` · ${p.delai_jours} j` : ''}
              </span>}
              {p.message && <><br /><span>{p.message}</span></>}
            </li>
          ))}
        </ol>
        {c.montant_convenu && <p><strong>Montant convenu : {montant(c.montant_convenu)}</strong></p>}

        {!['terminee', 'annulee'].includes(c.statut) && (
          <form onSubmit={proposer} style={{ border: '1px solid var(--filet)', borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="champs-ligne">
              <Champ libelle="Prix proposé (FCFA / m²)" inputMode="numeric" value={proposition.prix_m2}
                onChange={(e) => setProposition({ ...proposition, prix_m2: e.target.value.replace(/\D/g, '') })} />
              <Champ libelle="Montant total (FCFA)" inputMode="numeric" value={proposition.montant_total}
                placeholder={total ? String(total) : 'calculé si vide'}
                onChange={(e) => setProposition({ ...proposition, montant_total: e.target.value.replace(/\D/g, '') })} />
              <Champ libelle="Délai (jours)" inputMode="numeric" value={proposition.delai_jours}
                onChange={(e) => setProposition({ ...proposition, delai_jours: e.target.value.replace(/\D/g, '') })} />
            </div>
            <Champ libelle="Message au client" multiligne rows={2} value={proposition.message}
              placeholder="Visible par le client dans « Mes commandes »"
              onChange={(e) => setProposition({ ...proposition, message: e.target.value })} />
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <span className="discret">{total ? `Total estimé : ${montant(total)}` : ''}</span>
              <button type="submit" className="bouton" disabled={envoi === 'proposer'}>Envoyer la proposition</button>
            </div>
          </form>
        )}
      </section>

      <section className="rangee" style={{ alignItems: 'flex-end' }}>
        <Champ libelle="Étape de la commande" options={STATUTS} value={c.statut}
          onChange={(e) => agir('statut', () => api.patch(`/admin/commandes/${numero}/`, { statut: e.target.value }), 'Étape mise à jour : le client est prévenu dans la messagerie.')} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Champ libelle="Note interne (jamais visible par le client)" multiligne rows={2} value={note}
            onChange={(e) => setNote(e.target.value)} style={{ background: '#fffbef', borderColor: '#e8d9a8' }} />
          <button type="button" className="bouton secondaire petit" style={{ alignSelf: 'flex-start' }} disabled={envoi === 'note'}
            onClick={() => agir('note', () => api.patch(`/admin/commandes/${numero}/`, { note_interne: note }), 'Note enregistrée.')}>
            Enregistrer la note
          </button>
        </div>
      </section>
      <Erreur erreur={erreurAction} />
      {info && <p className="succes" role="status">{info}</p>}

      <div className="bientot-bloc" style={{ padding: 18 }}>
        <span className="bientot-pastille">Bientôt disponible</span>
        <strong>Paiement par compte bancaire</strong>
        <span className="discret">Le suivi des paiements de cette commande apparaîtra ici.</span>
      </div>

      {c.conversation && <FilMessages conversationId={c.conversation} titre={`Messagerie avec ${c.client.nom_complet}`} />}
    </article>
  );
}
