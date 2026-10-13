// Photos de la sphère de l'accueil : ajout, retrait, produit vers lequel mène chaque photo.
import { useRef, useState } from 'react';

import Chargement from '@/components/ui/Chargement.jsx';
import Icone from '@/components/ui/Icone.jsx';
import { Erreur } from '@/components/ui/elements.jsx';
import useApi from '@/hooks/useApi.js';
import { api, resultats } from '@/lib/api.js';

export default function SectionSphere() {
  const photos = useApi((s) => api.get('/admin/contenus/sphere/', { signal: s }), []);
  const produits = useApi((s) => api.get('/admin/catalogue/produits/?taille=100', { signal: s }).then(resultats), []);
  const [erreur, setErreur] = useState(null);
  const fichier = useRef(null);

  async function ajouter(e) {
    const liste = [...e.target.files];
    e.target.value = '';
    try {
      for (const f of liste) {
        const d = new FormData();
        d.append('image', f);
        d.append('ordre', String((photos.donnees?.length || 0) + 1));
        await api.envoyerFichiers('/admin/contenus/sphere/', d);
      }
      photos.recharger();
    } catch (err) { setErreur(err); }
  }

  const retirer = async (id) => {
    try { await api.supprimer(`/admin/contenus/sphere/${id}/`); photos.modifier((l) => l.filter((p) => p.id !== id)); }
    catch (err) { setErreur(err); }
  };
  const lier = async (id, produit) => {
    try { const maj = await api.patch(`/admin/contenus/sphere/${id}/`, { produit: produit || null }); photos.modifier((l) => l.map((p) => (p.id === id ? maj : p))); }
    catch (err) { setErreur(err); }
  };

  return (
    <section className="carte" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="carte-titre" style={{ marginBottom: 0 }}><h2>Photos de la sphère</h2><span className="etiquette">{photos.donnees?.length || 0} photos</span></div>
      <p className="discret">Chaque photo mène au produit choisi quand on clique dessus. Sans produit : vers le catalogue.</p>
      <Erreur erreur={photos.erreur || erreur} />
      {!photos.donnees ? <Chargement /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
          {photos.donnees.map((p) => (
            <figure key={p.id} style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 4, position: 'relative' }}>
              <img src={p.image} alt="" style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: 10 }} />
              <button type="button" className="bouton-icone" aria-label="Retirer la photo" onClick={() => retirer(p.id)}
                style={{ position: 'absolute', top: 4, right: 4, width: 28, height: 28 }}><Icone nom="corbeille" taille={13} /></button>
              <select aria-label="Produit lié" value={p.produit || ''} onChange={(e) => lier(p.id, e.target.value)}
                style={{ fontSize: 12, minHeight: 32, borderRadius: 8, border: '1px solid var(--filet)' }}>
                <option value="">Catalogue</option>
                {(produits.donnees || []).map((pr) => <option key={pr.id} value={pr.id}>{pr.nom}</option>)}
              </select>
            </figure>
          ))}
          <button type="button" onClick={() => fichier.current?.click()}
            style={{ aspectRatio: '1 / 1', border: '1.5px dashed var(--champ)', borderRadius: 10, background: 'var(--fond)', color: 'var(--encre-2)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12 }}>
            <Icone nom="plus" />Ajouter
          </button>
          <input ref={fichier} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={ajouter} />
        </div>
      )}
    </section>
  );
}
