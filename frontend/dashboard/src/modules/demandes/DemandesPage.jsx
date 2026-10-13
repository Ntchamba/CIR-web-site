// BF-11 : messages du formulaire de contact (questions, devis, design sur mesure, demandes de rappel).
import { useState } from 'react';

import Entete from '@/components/layout/Entete.jsx';
import Chargement from '@/components/ui/Chargement.jsx';
import Icone from '@/components/ui/Icone.jsx';
import { Erreur } from '@/components/ui/elements.jsx';
import useApi from '@/hooks/useApi.js';
import { api } from '@/lib/api.js';
import { date, heure, surface } from '@shared/format.js';

const OBJETS = [['', 'Toutes'], ['sur_mesure', 'Design sur mesure'], ['devis', 'Devis'], ['rappel', 'Être rappelé'], ['question', 'Questions']];

export default function DemandesPage() {
  const [objet, setObjet] = useState('');
  const [traitees, setTraitees] = useState(false);
  const liste = useApi((s) => api.get(`/admin/contact/?taille=100&traitee=${traitees}${objet ? `&objet=${objet}` : ''}`, { signal: s }), [objet, traitees]);
  const [erreur, setErreur] = useState(null);

  const marquer = async (d) => {
    try { await api.patch(`/admin/contact/${d.id}/`, { traitee: !d.traitee }); liste.recharger(); } catch (e) { setErreur(e); }
  };

  return (
    <>
      <Entete titre="Demandes de contact" intro="Messages envoyés depuis le formulaire de l'accueil et les fiches produits." />
      <div className="coque-contenu">
        <div className="filtres">
          {OBJETS.map(([v, l]) => <button key={v || 'toutes'} type="button" className="filtre" aria-pressed={objet === v} onClick={() => setObjet(v)}>{l}</button>)}
          <button type="button" className="filtre" aria-pressed={traitees} onClick={() => setTraitees((t) => !t)}>
            {traitees ? 'Voir les demandes à traiter' : 'Voir les demandes traitées'}
          </button>
        </div>
        <Erreur erreur={liste.erreur || erreur} reessayer={liste.recharger} />
        {!liste.donnees ? <Chargement /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {liste.donnees.results.length === 0 && <p className="vide">Aucune demande {traitees ? 'traitée' : 'en attente'}.</p>}
            {liste.donnees.results.map((d) => {
              const tel = (d.telephone || '').replace(/\D/g, '');
              return (
                <article key={d.id} className="carte" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}>
                    <strong style={{ fontSize: 17 }}>{d.nom} <span className="badge negociation" style={{ marginLeft: 6 }}>{d.objet_libelle}</span></strong>
                    <span className="discret">{date(d.cree_le)} à {heure(d.cree_le)}</span>
                  </div>
                  <span className="discret">{d.type_batiment_libelle}{d.surface_m2 ? ` · ${surface(d.surface_m2)}` : ''} · {d.telephone || '—'} · {d.email || '—'}</span>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{d.message}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {tel && <a className="bouton secondaire petit" href={`https://wa.me/${tel}`} target="_blank" rel="noopener noreferrer"><Icone nom="whatsapp" taille={16} />WhatsApp</a>}
                    {d.email && <a className="bouton secondaire petit" href={`mailto:${d.email}`}><Icone nom="message" taille={16} />E-mail</a>}
                    <button type="button" className={`bouton petit ${d.traitee ? 'secondaire' : ''}`} onClick={() => marquer(d)}>
                      {d.traitee ? 'Remettre à traiter' : 'Marquer comme traitée'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
