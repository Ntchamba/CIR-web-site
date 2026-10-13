// Textes de l'accueil, vidéo de fond et coordonnées affichées sur tout le site.
import { useEffect, useRef, useState } from 'react';

import Chargement from '@/components/ui/Chargement.jsx';
import Icone from '@/components/ui/Icone.jsx';
import { Champ, Erreur } from '@/components/ui/elements.jsx';
import useApi from '@/hooks/useApi.js';
import { api, URL_SITE } from '@/lib/api.js';

const CHAMPS = [['titre', "Titre de l'accueil"], ['accroche', "Texte d'accroche", true], ['telephone', 'Téléphone'],
  ['whatsapp', 'WhatsApp'], ['email', 'E-mail de contact'], ['adresse', 'Adresse'], ['texte_partenaire', 'Texte partenaire']];

export default function SectionAccueil() {
  const contenu = useApi((s) => api.get('/admin/contenus/accueil/', { signal: s }), []);
  const [form, setForm] = useState(null);
  const [etat, setEtat] = useState({ envoi: false, erreur: null, ok: '' });
  const fichier = useRef(null);
  useEffect(() => { if (contenu.donnees) setForm(contenu.donnees); }, [contenu.donnees]);

  async function enregistrer() {
    setEtat({ envoi: true, erreur: null, ok: '' });
    const { video, ...textes } = form;
    try { setForm(await api.patch('/admin/contenus/accueil/', textes)); setEtat({ envoi: false, erreur: null, ok: 'Textes enregistrés.' }); }
    catch (erreur) { setEtat({ envoi: false, erreur, ok: '' }); }
  }

  async function remplacerVideo(e) {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const donnees = new FormData();
    donnees.append('video', f);
    setEtat({ envoi: true, erreur: null, ok: '' });
    try { setForm(await api.envoyerFichiers('/admin/contenus/accueil/', donnees, 'PATCH')); setEtat({ envoi: false, erreur: null, ok: 'Vidéo remplacée.' }); }
    catch (erreur) { setEtat({ envoi: false, erreur, ok: '' }); }
  }

  return (
    <section className="carte" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="carte-titre" style={{ marginBottom: 0 }}><h2>Accueil et coordonnées</h2><span className="etiquette">Vidéo jouée une fois</span></div>
      <Erreur erreur={contenu.erreur || etat.erreur} />
      {!form ? <Chargement /> : (
        <>
          <video controls preload="none" poster="/media/marque/logo-cir.webp" style={{ width: '100%', aspectRatio: '16 / 9', background: 'var(--encre)', borderRadius: 12 }}
            src={form.video || `${URL_SITE}/media/accueil/fond.mp4`} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="button" className="bouton secondaire petit" onClick={() => fichier.current?.click()}><Icone nom="envoi" taille={16} />Remplacer la vidéo</button>
            <a className="bouton secondaire petit" href={URL_SITE} target="_blank" rel="noopener noreferrer"><Icone nom="oeil" taille={16} />Voir l'accueil</a>
            <input ref={fichier} type="file" accept="video/mp4,video/webm" hidden onChange={remplacerVideo} />
          </div>
          {CHAMPS.map(([cle, libelle, long]) => (
            <Champ key={cle} libelle={libelle} multiligne={long} rows={long ? 2 : undefined} value={form[cle] || ''}
              onChange={(e) => setForm({ ...form, [cle]: e.target.value })} />
          ))}
          {etat.ok && <p className="succes" role="status">{etat.ok}</p>}
          <button type="button" className="bouton" style={{ alignSelf: 'flex-start' }} disabled={etat.envoi} onClick={enregistrer}>Enregistrer</button>
        </>
      )}
    </section>
  );
}
