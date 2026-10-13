// BF-02 : réalisations publiées sur le site (photos avant / après), ajout et publication.
import { useState } from 'react';

import Chargement from '@/components/ui/Chargement.jsx';
import Icone from '@/components/ui/Icone.jsx';
import Tiroir from '@/components/ui/Tiroir.jsx';
import { Champ, Erreur, Interrupteur } from '@/components/ui/elements.jsx';
import useApi from '@/hooks/useApi.js';
import { api } from '@/lib/api.js';

const TYPES = [['maison', 'Maison'], ['industrie', 'Industrie'], ['entreprise', 'Entreprise'], ['exterieur', 'Extérieur']];

export default function SectionRealisations() {
  const liste = useApi((s) => api.get('/admin/vitrine/realisations/?taille=100', { signal: s }), []);
  const [tiroir, setTiroir] = useState(false);
  const [erreur, setErreur] = useState(null);

  const publier = async (r) => {
    try { const maj = await api.patch(`/admin/vitrine/realisations/${r.id}/`, { publie: !r.publie });
      liste.modifier((d) => ({ ...d, results: d.results.map((x) => (x.id === maj.id ? maj : x)) })); }
    catch (e) { setErreur(e); }
  };
  const supprimer = async (r) => {
    if (!window.confirm(`Supprimer la réalisation « ${r.titre} » ?`)) return;
    try { await api.supprimer(`/admin/vitrine/realisations/${r.id}/`); liste.recharger(); } catch (e) { setErreur(e); }
  };

  return (
    <section className="carte">
      <div className="carte-titre">
        <h2>Réalisations</h2>
        <button type="button" className="bouton petit" onClick={() => setTiroir(true)}><Icone nom="plus" taille={16} />Nouvelle réalisation</button>
      </div>
      <Erreur erreur={liste.erreur || erreur} />
      {!liste.donnees ? <Chargement /> : (
        <div className="tableau-boite">
          <table className="tableau" style={{ minWidth: 640 }}>
            <thead><tr><th>Chantier</th><th>Type</th><th>Ville</th><th>Avant / après</th><th>Publiée</th><th><span className="visuellement-cache">Actions</span></th></tr></thead>
            <tbody>
              {liste.donnees.results.map((r) => (
                <tr key={r.id}>
                  <td><span className="cellule-produit"><img className="vignette" src={r.image} alt="" style={{ width: 72 }} /><strong>{r.titre}</strong></span></td>
                  <td>{r.type_chantier_libelle}</td>
                  <td>{r.ville || '—'}</td>
                  <td className="discret">{r.image_avant ? 'Oui' : '—'}</td>
                  <td><Interrupteur actif={r.publie} libelle={`Publier ${r.titre}`} onChange={() => publier(r)} /></td>
                  <td style={{ textAlign: 'right' }}><button type="button" className="bouton-icone" aria-label={`Supprimer ${r.titre}`} onClick={() => supprimer(r)}><Icone nom="corbeille" taille={15} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tiroir && <TiroirRealisation onFermer={() => setTiroir(false)} onEnregistre={liste.recharger} />}
    </section>
  );
}

function TiroirRealisation({ onFermer, onEnregistre }) {
  const [form, setForm] = useState({ titre: '', type_chantier: 'maison', ville: '', description: '' });
  const [photos, setPhotos] = useState({ image: null, image_avant: null });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);

  async function enregistrer() {
    setEnvoi(true); setErreur(null);
    const d = new FormData();
    Object.entries(form).forEach(([k, v]) => d.append(k, v));
    if (photos.image) d.append('image', photos.image);
    if (photos.image_avant) d.append('image_avant', photos.image_avant);
    try { await api.envoyerFichiers('/admin/vitrine/realisations/', d); onEnregistre(); onFermer(); }
    catch (e) { setErreur(e); }
    finally { setEnvoi(false); }
  }

  return (
    <Tiroir titre="Nouvelle réalisation" onFermer={onFermer} pied={<>
      <button type="button" className="bouton secondaire" onClick={onFermer}>Annuler</button>
      <button type="button" className="bouton" disabled={envoi || !form.titre || !photos.image} onClick={enregistrer}>{envoi ? 'Envoi…' : 'Publier'}</button>
    </>}>
      <Champ libelle="Titre du chantier" value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} />
      <div className="champs-ligne">
        <Champ libelle="Type" options={TYPES} value={form.type_chantier} onChange={(e) => setForm({ ...form, type_chantier: e.target.value })} />
        <Champ libelle="Ville" value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} />
      </div>
      <Champ libelle="Description" multiligne rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      <Champ libelle="Photo après travaux (obligatoire)" type="file" accept="image/*" onChange={(e) => setPhotos({ ...photos, image: e.target.files[0] })} />
      <Champ libelle="Photo avant travaux (facultatif)" type="file" accept="image/*" onChange={(e) => setPhotos({ ...photos, image_avant: e.target.files[0] })} />
      <Erreur erreur={erreur} />
    </Tiroir>
  );
}
