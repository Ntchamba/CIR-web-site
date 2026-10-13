// BF-04 / BF-15 : témoignages envoyés par les clients, à publier ou refuser.
import { useState } from 'react';

import Chargement from '@/components/ui/Chargement.jsx';
import { Erreur } from '@/components/ui/elements.jsx';
import useApi from '@/hooks/useApi.js';
import { api } from '@/lib/api.js';
import { depuis, TYPES_BATIMENT } from '@shared/format.js';

const FILTRES = [['en_attente', 'À valider'], ['publie', 'Publiés'], ['refuse', 'Refusés']];

export default function SectionTemoignages() {
  const [statut, setStatut] = useState('en_attente');
  const liste = useApi((s) => api.get(`/admin/vitrine/temoignages/?statut=${statut}&taille=50`, { signal: s }), [statut]);
  const [erreur, setErreur] = useState(null);

  const decider = async (id, action) => {
    try { await api.post(`/admin/vitrine/temoignages/${id}/${action}/`); liste.recharger(); } catch (e) { setErreur(e); }
  };

  return (
    <section className="carte" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2>Témoignages</h2>
      <div className="filtres">
        {FILTRES.map(([v, l]) => <button key={v} type="button" className="filtre" aria-pressed={statut === v} onClick={() => setStatut(v)}>{l}</button>)}
      </div>
      <Erreur erreur={liste.erreur || erreur} />
      {!liste.donnees ? <Chargement /> : liste.donnees.results.map((t) => (
        <div key={t.id} style={{ padding: 16, borderRadius: 12, background: 'var(--fond)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="discret"><strong style={{ color: 'var(--encre)' }}>{t.nom_client}</strong> · {TYPES_BATIMENT[t.type_batiment]}{t.ville ? ` · ${t.ville}` : ''} · {depuis(t.cree_le)}</span>
          <em style={{ fontFamily: 'var(--police-titre)', fontSize: 16 }}>« {t.texte} »</em>
          <span style={{ display: 'flex', gap: 8 }}>
            {t.statut !== 'publie' && <button type="button" className="bouton petit" onClick={() => decider(t.id, 'publier')}>Publier</button>}
            {t.statut !== 'refuse' && <button type="button" className="bouton secondaire petit" onClick={() => decider(t.id, 'refuser')}>{t.statut === 'publie' ? 'Retirer' : 'Refuser'}</button>}
          </span>
        </div>
      ))}
      {liste.donnees?.results.length === 0 && <p className="discret">Rien dans cette liste.</p>}
      <p className="discret" style={{ fontSize: 13 }}>Un témoignage n'apparaît sur le site qu'après validation.</p>
    </section>
  );
}
