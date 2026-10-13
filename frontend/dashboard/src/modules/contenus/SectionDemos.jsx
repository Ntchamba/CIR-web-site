// BF-03 / BF-15 : démonstrations vidéo affichées sur la page Réalisations (fichier vidéo ou lien YouTube).
import { useState } from 'react';

import Chargement from '@/components/ui/Chargement.jsx';
import Icone from '@/components/ui/Icone.jsx';
import { Champ, Erreur, Interrupteur } from '@/components/ui/elements.jsx';
import useApi from '@/hooks/useApi.js';
import { api, resultats } from '@/lib/api.js';

const VIDE = { titre: '', duree: '', lien: '' };

export default function SectionDemos() {
  const liste = useApi((s) => api.get('/admin/vitrine/demos/', { signal: s }).then(resultats), []);
  const [form, setForm] = useState(VIDE);
  const [fichiers, setFichiers] = useState({ video: null, miniature: null });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);

  async function ajouter(e) {
    e.preventDefault();
    setEnvoi(true); setErreur(null);
    const donnees = new FormData();
    donnees.append('publie', 'true'); // un formulaire multipart sans la case la mettrait à faux
    Object.entries(form).forEach(([cle, valeur]) => valeur && donnees.append(cle, valeur));
    Object.entries(fichiers).forEach(([cle, fichier]) => fichier && donnees.append(cle, fichier));
    try {
      await api.envoyerFichiers('/admin/vitrine/demos/', donnees);
      setForm(VIDE); setFichiers({ video: null, miniature: null }); e.target.reset(); liste.recharger();
    } catch (err) { setErreur(err); }
    finally { setEnvoi(false); }
  }
  const basculer = async (d) => {
    try { await api.patch(`/admin/vitrine/demos/${d.id}/`, { publie: !d.publie }); liste.recharger(); } catch (err) { setErreur(err); }
  };
  const supprimer = async (d) => {
    try { await api.supprimer(`/admin/vitrine/demos/${d.id}/`); liste.recharger(); } catch (err) { setErreur(err); }
  };

  return (
    <section className="carte" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2>Démonstrations</h2>
      <p className="discret">Courtes vidéos montrées sur la page Réalisations. Sans démo publiée, la vidéo de l'accueil est affichée.</p>
      <Erreur erreur={liste.erreur || erreur} />
      {!liste.donnees ? <Chargement /> : liste.donnees.map((d) => (
        <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--filet-2)' }}>
          <span style={{ flex: 1 }}><strong>{d.titre}</strong><br />
            <span className="discret">{d.video ? 'Fichier vidéo' : 'Lien externe'}{d.duree ? ` · ${d.duree}` : ''}</span></span>
          <Interrupteur actif={d.publie} libelle={`Publier ${d.titre}`} onChange={() => basculer(d)} />
          <button type="button" className="bouton-icone" aria-label={`Supprimer ${d.titre}`} onClick={() => supprimer(d)}><Icone nom="corbeille" taille={15} /></button>
        </div>
      ))}
      {liste.donnees?.length === 0 && <p className="discret">Aucune démonstration pour l'instant.</p>}
      <form onSubmit={ajouter} style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8 }}>
        <div className="champs-ligne">
          <Champ libelle="Titre de la démo" placeholder="Ex. : pose d'un sol autolissant à Bonapriso" value={form.titre}
            onChange={(e) => setForm({ ...form, titre: e.target.value })} />
          <Champ libelle="Durée" placeholder="1:20" value={form.duree} onChange={(e) => setForm({ ...form, duree: e.target.value })} />
        </div>
        <Champ libelle="Fichier vidéo (MP4 ou WebM)" type="file" accept="video/mp4,video/webm"
          onChange={(e) => setFichiers({ ...fichiers, video: e.target.files[0] || null })} />
        <Champ libelle="Ou lien de la vidéo (YouTube…)" type="url" placeholder="https://" value={form.lien}
          onChange={(e) => setForm({ ...form, lien: e.target.value })} />
        <Champ libelle="Image d'aperçu (facultatif)" type="file" accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setFichiers({ ...fichiers, miniature: e.target.files[0] || null })} />
        <button type="submit" className="bouton petit" style={{ alignSelf: 'flex-start' }}
          disabled={envoi || !form.titre || (!fichiers.video && !form.lien)}>{envoi ? 'Envoi…' : 'Publier la démo'}</button>
      </form>
    </section>
  );
}
