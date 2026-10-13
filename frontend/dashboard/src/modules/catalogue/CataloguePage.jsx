// BF-14 : gestion du catalogue (produits, prix, visibilité, mise à la une, photos).
import { useState } from 'react';

import Entete from '@/components/layout/Entete.jsx';
import Chargement from '@/components/ui/Chargement.jsx';
import Icone from '@/components/ui/Icone.jsx';
import { Erreur, Interrupteur, Kpi } from '@/components/ui/elements.jsx';
import useApi from '@/hooks/useApi.js';
import { api, URL_SITE } from '@/lib/api.js';
import { prix, TYPES_BATIMENT } from '@shared/format.js';

import TiroirProduit from './TiroirProduit.jsx';

export default function CataloguePage() {
  const [famille, setFamille] = useState('');
  const [tiroir, setTiroir] = useState(null); // null, 'nouveau' ou un produit
  const familles = useApi((s) => api.get('/admin/catalogue/familles/', { signal: s }), []);
  const resume = useApi((s) => api.get('/admin/catalogue/produits/resume/', { signal: s }), []);
  const liste = useApi((s) => api.get(`/admin/catalogue/produits/?taille=100${famille ? `&famille=${famille}` : ''}`, { signal: s }), [famille]);
  const [erreur, setErreur] = useState(null);

  const basculer = async (produit, champ) => {
    setErreur(null);
    try {
      const maj = await api.patch(`/admin/catalogue/produits/${produit.id}/`, { [champ]: !produit[champ] });
      liste.modifier((d) => ({ ...d, results: d.results.map((p) => (p.id === maj.id ? maj : p)) }));
      resume.recharger();
    } catch (e) { setErreur(e); }
  };
  const apresEnregistrement = () => { liste.recharger(); resume.recharger(); familles.recharger(); };

  return (
    <>
      <Entete titre="Catalogue" intro="Ajoutez, modifiez et mettez en avant les produits proposés aux clients.">
        <button type="button" className="bouton" onClick={() => setTiroir('nouveau')}><Icone nom="plus" taille={18} />Ajouter un produit</button>
      </Entete>
      <div className="coque-contenu">
        {resume.donnees && (
          <div className="grille-kpi">
            <Kpi libelle="Produits en ligne" valeur={resume.donnees.en_ligne} note={`sur ${resume.donnees.total} au catalogue`} />
            <Kpi libelle="À la une de l'accueil" valeur={resume.donnees.a_la_une} note="Affichés dans « Produits à la une »" />
            <Kpi libelle="Brouillons" valeur={resume.donnees.brouillons} note="Non visibles par les clients" />
          </div>
        )}
        <div className="filtres" role="group" aria-label="Famille">
          <button type="button" className="filtre" aria-pressed={!famille} onClick={() => setFamille('')}>Toutes</button>
          {(familles.donnees || []).map((f) => (
            <button key={f.slug} type="button" className="filtre" aria-pressed={famille === f.slug} onClick={() => setFamille(f.slug)}>
              {f.nom}<span className="nb">{f.nb_produits}</span>
            </button>
          ))}
        </div>
        <Erreur erreur={liste.erreur || erreur} reessayer={liste.erreur ? liste.recharger : undefined} />
        <section className="carte" style={{ padding: '8px 0' }}>
          {liste.chargement && !liste.donnees ? <Chargement /> : (
            <div className="tableau-boite">
              <table className="tableau" style={{ minWidth: 900 }}>
                <thead><tr><th>Produit</th><th>Famille</th><th>Usage</th><th>Prix</th><th>En ligne</th><th>À la une</th><th><span className="visuellement-cache">Actions</span></th></tr></thead>
                <tbody>
                  {(liste.donnees?.results || []).map((p) => (
                    <tr key={p.id}>
                      <td>
                        <span className="cellule-produit">
                          {p.vignette ? <img className="vignette" src={p.vignette} alt="" /> : <span className="vignette" />}
                          <span><strong>{p.nom}</strong><br /><span className="mono discret">{p.reference || '—'}</span></span>
                        </span>
                      </td>
                      <td>{p.famille_nom}</td>
                      <td className="discret">{[p.pour_maison && 'maison', p.pour_industrie && 'industrie', p.pour_entreprise && 'entreprise', p.pour_exterieur && 'exterieur']
                        .filter(Boolean).map((u) => TYPES_BATIMENT[u]).join(' · ')}</td>
                      <td className="mono" style={{ whiteSpace: 'nowrap' }}>{prix(p.prix, p.unite_prix)}</td>
                      <td><Interrupteur actif={p.en_ligne} libelle={`Visible sur le site : ${p.nom}`} onChange={() => basculer(p, 'en_ligne')} /></td>
                      <td><Interrupteur actif={p.a_la_une} libelle={`À la une : ${p.nom}`} onChange={() => basculer(p, 'a_la_une')} /></td>
                      <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                        <button type="button" className="bouton-icone" aria-label={`Modifier ${p.nom}`} onClick={() => setTiroir(p)}><Icone nom="crayon" taille={16} /></button>{' '}
                        <a className="bouton-icone" aria-label={`Voir ${p.nom} sur le site`} href={`${URL_SITE}/catalogue/${p.slug}`} target="_blank" rel="noopener noreferrer"><Icone nom="oeil" taille={16} /></a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      {tiroir && (
        <TiroirProduit produit={tiroir === 'nouveau' ? null : tiroir} familles={familles.donnees || []}
          onFermer={() => setTiroir(null)} onEnregistre={apresEnregistrement} />
      )}
    </>
  );
}
