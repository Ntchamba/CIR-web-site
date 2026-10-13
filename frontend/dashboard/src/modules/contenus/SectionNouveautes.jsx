// BF-07 / BF-15 : nouveautés affichées sur l'accueil.
import { useState } from 'react';

import Chargement from '@/components/ui/Chargement.jsx';
import Icone from '@/components/ui/Icone.jsx';
import { Champ, Erreur, Interrupteur } from '@/components/ui/elements.jsx';
import useApi from '@/hooks/useApi.js';
import { api, resultats } from '@/lib/api.js';
import { date } from '@shared/format.js';

export default function SectionNouveautes() {
  const liste = useApi((s) => api.get('/admin/nouveautes/?taille=50', { signal: s }), []);
  const produits = useApi((s) => api.get('/admin/catalogue/produits/?taille=100', { signal: s }).then(resultats), []);
  const [form, setForm] = useState({ titre: '', texte: '', produit: '' });
  const [erreur, setErreur] = useState(null);

  async function ajouter(e) {
    e.preventDefault();
    try { await api.post('/admin/nouveautes/', { ...form, produit: form.produit || null }); setForm({ titre: '', texte: '', produit: '' }); liste.recharger(); }
    catch (err) { setErreur(err); }
  }
  const basculer = async (n) => {
    try { await api.patch(`/admin/nouveautes/${n.id}/`, { publie: !n.publie }); liste.recharger(); } catch (err) { setErreur(err); }
  };
  const supprimer = async (n) => {
    try { await api.supprimer(`/admin/nouveautes/${n.id}/`); liste.recharger(); } catch (err) { setErreur(err); }
  };

  return (
    <section className="carte" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2>Nouveautés</h2>
      <Erreur erreur={liste.erreur || erreur} />
      {!liste.donnees ? <Chargement /> : liste.donnees.results.map((n) => (
        <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--filet-2)' }}>
          <span style={{ flex: 1 }}><strong>{n.titre}</strong><br /><span className="discret">{date(n.publie_le)}</span></span>
          <Interrupteur actif={n.publie} libelle={`Publier ${n.titre}`} onChange={() => basculer(n)} />
          <button type="button" className="bouton-icone" aria-label={`Supprimer ${n.titre}`} onClick={() => supprimer(n)}><Icone nom="corbeille" taille={15} /></button>
        </div>
      ))}
      {liste.donnees?.results.length === 0 && <p className="discret">Aucune nouveauté publiée.</p>}
      <form onSubmit={ajouter} style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8 }}>
        <Champ libelle="Nouvelle annonce" placeholder="Ex. : nouvelle finition métallisée" value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} />
        <Champ libelle="Texte" multiligne rows={2} value={form.texte} onChange={(e) => setForm({ ...form, texte: e.target.value })} />
        <Champ libelle="Produit lié (facultatif)" options={[['', '—'], ...(produits.donnees || []).map((p) => [p.id, p.nom])]}
          value={form.produit} onChange={(e) => setForm({ ...form, produit: e.target.value })} />
        <button type="submit" className="bouton petit" style={{ alignSelf: 'flex-start' }} disabled={!form.titre}>Publier la nouveauté</button>
      </form>
    </section>
  );
}
