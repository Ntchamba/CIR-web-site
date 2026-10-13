// Ajout ou modification d'un produit : textes, prix, usages, fiche technique, photos (converties en WebP).
import { useRef, useState } from 'react';

import Tiroir from '@/components/ui/Tiroir.jsx';
import Icone from '@/components/ui/Icone.jsx';
import { Champ, Erreur, Interrupteur } from '@/components/ui/elements.jsx';
import { api } from '@/lib/api.js';

const VIDE = {
  nom: '', reference: '', famille: '', accroche: '', description: '', prix: '', unite_prix: 'm2',
  pour_maison: true, pour_industrie: false, pour_entreprise: false, pour_exterieur: false,
  durabilite: '', beaute: '', confort: '', mise_en_oeuvre: '', en_ligne: false, a_la_une: false, est_nouveau: false,
  caracteristiques: [{ libelle: 'Épaisseur', valeur: '' }, { libelle: 'Séchage', valeur: '' }],
};
const USAGES = [['pour_maison', 'Maison'], ['pour_industrie', 'Industrie'], ['pour_entreprise', 'Entreprise'], ['pour_exterieur', 'Extérieur']];
const UNITES = [['m2', 'FCFA / m²'], ['kg', 'FCFA / kg'], ['pose', 'FCFA / m², pose comprise']];

export default function TiroirProduit({ produit, familles, onFermer, onEnregistre }) {
  const [form, setForm] = useState(() => (produit ? { ...VIDE, ...produit, prix: produit.prix ?? '' } : { ...VIDE, famille: familles[0]?.id || '' }));
  const [images, setImages] = useState(produit?.images || []);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const fichier = useRef(null);
  const [enAttente, setEnAttente] = useState([]); // photos choisies avant la création du produit

  const champ = (nom) => ({ value: form[nom] ?? '', onChange: (e) => setForm({ ...form, [nom]: e.target.value }) });

  async function envoyerPhotos(id, liste) {
    if (!liste.length) return [];
    const donnees = new FormData();
    liste.forEach((f) => donnees.append('image', f));
    return api.envoyerFichiers(`/admin/catalogue/produits/${id}/images/`, donnees);
  }

  async function ajouterPhotos(e) {
    const liste = [...e.target.files];
    e.target.value = '';
    if (!produit) { setEnAttente((a) => [...a, ...liste]); return; }
    try { const nouvelles = await envoyerPhotos(produit.id, liste); setImages((i) => [...i, ...nouvelles]); onEnregistre(); }
    catch (err) { setErreur(err); }
  }

  async function supprimerPhoto(id) {
    try { await api.supprimer(`/admin/catalogue/produits/${produit.id}/images/${id}/`); setImages((i) => i.filter((x) => x.id !== id)); onEnregistre(); }
    catch (err) { setErreur(err); }
  }

  async function enregistrer() {
    setEnvoi(true); setErreur(null);
    const corps = { ...form, prix: form.prix === '' ? null : form.prix,
      caracteristiques: form.caracteristiques.filter((c) => c.libelle && c.valeur) };
    delete corps.images; delete corps.vignette;
    try {
      const enregistre = produit
        ? await api.patch(`/admin/catalogue/produits/${produit.id}/`, corps)
        : await api.post('/admin/catalogue/produits/', corps);
      if (!produit) await envoyerPhotos(enregistre.id, enAttente);
      onEnregistre();
      onFermer();
    } catch (err) { setErreur(err); }
    finally { setEnvoi(false); }
  }

  const caracteristique = (i, cle, valeur) => setForm({ ...form,
    caracteristiques: form.caracteristiques.map((c, j) => (j === i ? { ...c, [cle]: valeur } : c)) });

  return (
    <Tiroir titre={produit ? `Modifier : ${produit.nom}` : 'Ajouter un produit'} onFermer={onFermer}
      pied={<>
        <button type="button" className="bouton secondaire" onClick={onFermer}>Annuler</button>
        <button type="button" className="bouton" onClick={enregistrer} disabled={envoi || !form.nom || !form.famille}>
          {envoi ? 'Enregistrement…' : 'Enregistrer le produit'}
        </button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontWeight: 500, fontSize: 14 }}>Photos du produit</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {images.map((im) => (
            <span key={im.id} style={{ position: 'relative' }}>
              <img src={im.image} alt="" style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 12 }} />
              <button type="button" className="bouton-icone" aria-label="Supprimer la photo" onClick={() => supprimerPhoto(im.id)}
                style={{ position: 'absolute', top: 4, right: 4, width: 30, height: 30 }}><Icone nom="corbeille" taille={14} /></button>
            </span>
          ))}
          {enAttente.map((f) => <span key={f.name} className="discret" style={{ width: 96, height: 96, borderRadius: 12, background: 'var(--fond)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, padding: 6, textAlign: 'center', overflow: 'hidden' }}>{f.name}</span>)}
          <button type="button" onClick={() => fichier.current?.click()}
            style={{ width: 96, height: 96, border: '1.5px dashed var(--champ)', borderRadius: 12, background: 'var(--fond)', color: 'var(--encre-2)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12 }}>
            <Icone nom="envoi" />Ajouter
          </button>
          <input ref={fichier} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={ajouterPhotos} />
        </div>
        <span className="discret" style={{ fontSize: 13 }}>JPG, PNG ou WebP, 5 Mo au plus. Converties automatiquement en WebP léger. La première sert de vignette.</span>
      </div>

      <Champ libelle="Nom du produit" {...champ('nom')} required />
      <div className="champs-ligne">
        <Champ libelle="Référence Jiuye" placeholder="YD-…" {...champ('reference')} />
        <Champ libelle="Famille" options={familles.map((f) => [f.id, f.nom])} {...champ('famille')} />
      </div>
      <div className="champs-ligne">
        <Champ libelle="Prix (vide = sur devis)" inputMode="numeric" value={form.prix}
          onChange={(e) => setForm({ ...form, prix: e.target.value.replace(/\D/g, '') })} />
        <Champ libelle="Unité" options={UNITES} {...champ('unite_prix')} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontWeight: 500, fontSize: 14 }}>Pour quels bâtiments</span>
        <div className="filtres">
          {USAGES.map(([cle, libelle]) => (
            <button key={cle} type="button" className="filtre" aria-pressed={form[cle]} onClick={() => setForm({ ...form, [cle]: !form[cle] })}>{libelle}</button>
          ))}
        </div>
      </div>
      <Champ libelle="Accroche (une phrase)" {...champ('accroche')} />
      <Champ libelle="Présentation" multiligne rows={3} {...champ('description')} />
      <Champ libelle="Durabilité" multiligne rows={2} {...champ('durabilite')} />
      <Champ libelle="Beauté" multiligne rows={2} {...champ('beaute')} />
      <Champ libelle="Confort" multiligne rows={2} {...champ('confort')} />
      <Champ libelle="Mise en œuvre" multiligne rows={2} {...champ('mise_en_oeuvre')} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontWeight: 500, fontSize: 14 }}>Caractéristiques techniques</span>
        {form.caracteristiques.map((c, i) => (
          <div key={i} className="champs-ligne" style={{ alignItems: 'flex-end' }}>
            <Champ libelle="Libellé" value={c.libelle} onChange={(e) => caracteristique(i, 'libelle', e.target.value)} />
            <Champ libelle="Valeur" value={c.valeur} onChange={(e) => caracteristique(i, 'valeur', e.target.value)} />
            <button type="button" className="bouton-icone" style={{ flex: '0 0 40px' }} aria-label="Retirer cette ligne"
              onClick={() => setForm({ ...form, caracteristiques: form.caracteristiques.filter((_, j) => j !== i) })}><Icone nom="corbeille" taille={15} /></button>
          </div>
        ))}
        <button type="button" className="bouton secondaire petit" style={{ alignSelf: 'flex-start' }}
          onClick={() => setForm({ ...form, caracteristiques: [...form.caracteristiques, { libelle: '', valeur: '' }] })}>Ajouter une ligne</button>
      </div>

      <div style={{ padding: 16, borderRadius: 12, background: 'var(--fond)', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[['en_ligne', 'Visible sur le site', 'Sinon, enregistré comme brouillon'], ['a_la_une', 'Mettre à la une', "Affiché dans « Produits à la une » de l'accueil"],
          ['est_nouveau', 'Nouveauté', 'Étiquette « Nouveau » sur la vignette']].map(([cle, titre, aide]) => (
          <div key={cle} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span><strong style={{ fontWeight: 500 }}>{titre}</strong><br /><span className="discret" style={{ fontSize: 13 }}>{aide}</span></span>
            <Interrupteur actif={form[cle]} libelle={titre} onChange={(v) => setForm({ ...form, [cle]: v })} />
          </div>
        ))}
      </div>
      <Erreur erreur={erreur} />
    </Tiroir>
  );
}
