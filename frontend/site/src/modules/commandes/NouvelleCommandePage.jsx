// BF-09, BF-10 : passer commande à partir de la sélection (adresse obligatoire).
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import Bouton from '@/components/ui/Bouton.jsx';
import Champ from '@/components/ui/Champ.jsx';
import EtatVide from '@/components/ui/EtatVide.jsx';
import MessageErreur from '@/components/ui/MessageErreur.jsx';
import usePageMeta from '@/hooks/usePageMeta.js';
import { prix } from '@shared/format.js';

import { useAuth } from '../compte/AuthContext.jsx';
import FormulaireAdresse, { ADRESSE_VIDE } from '../compte/FormulaireAdresse.jsx';
import { useSelection } from '../selection/SelectionContext.jsx';
import * as commandes from './api.js';
import styles from './Commandes.module.css';

const TYPES = [['maison', 'Une maison'], ['industrie', 'Une industrie'], ['entreprise', 'Une entreprise']];

export default function NouvelleCommandePage() {
  usePageMeta('Nouvelle commande');
  const { utilisateur, mettreAJour } = useAuth();
  const { elements, retirer, recharger } = useSelection();
  const [parametres] = useSearchParams();
  const naviguer = useNavigate();
  const negocier = parametres.get('negocier') === '1';

  const [surfaces, setSurfaces] = useState({});
  const [form, setForm] = useState({ type_batiment: utilisateur.type_client || 'maison', date_souhaitee: '',
    message: negocier ? 'Prix souhaité : … FCFA / m². ' : '', sur_mesure: false });
  const [adresse, setAdresse] = useState(utilisateur.adresse || ADRESSE_VIDE);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);

  useEffect(() => { recharger().catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function commander(e) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      if (!utilisateur.a_une_adresse) await mettreAJour({ adresse });
      const lignes = elements.map((el) => ({ produit: el.produit, surface_m2: surfaces[el.produit] || el.surface_m2 || null }));
      const commande = await commandes.creer({ ...form, date_souhaitee: form.date_souhaitee || null, lignes });
      await recharger();
      naviguer(`/commandes/${commande.numero}`);
    } catch (err) {
      setErreur(err);
    } finally {
      setEnvoi(false);
    }
  }

  if (elements.length === 0 && !form.sur_mesure) {
    return (
      <div className="conteneur section">
        <EtatVide titre="Votre sélection est vide" action={
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Bouton vers="/catalogue">Parcourir le catalogue</Bouton>
            <Bouton variante="contour" onClick={() => setForm({ ...form, sur_mesure: true })}>Demander un design sur mesure</Bouton>
          </div>}>
          Ajoutez un ou plusieurs designs depuis le catalogue, ou demandez un rendu sur mesure.
        </EtatVide>
      </div>
    );
  }

  return (
    <div className={`conteneur ${styles.nouvelle}`}>
      <h1 className="titre-page">Nouvelle commande</h1>
      <form onSubmit={commander} className={styles.nouvelleGrille}>
        <section className={styles.bloc} aria-labelledby="titre-selection">
          <h2 id="titre-selection">Ma sélection</h2>
          {elements.length === 0 && <p className={styles.aide}>Design sur mesure : décrivez votre projet ci-contre.</p>}
          <ul className={styles.selection}>
            {elements.map((el) => {
              const p = el.produit_detail;
              return (
                <li key={el.produit}>
                  {p?.vignette && <img src={p.vignette} alt="" width="64" height="64" />}
                  <div className={styles.selectionTexte}>
                    <Link to={`/catalogue/${el.produit}`}>{p?.nom || el.produit}</Link>
                    {p && <span>{prix(p.prix, p.unite_prix)}</span>}
                  </div>
                  <label className={styles.surface}>
                    <span>Surface (m²)</span>
                    <input inputMode="decimal" value={surfaces[el.produit] ?? el.surface_m2 ?? ''}
                      onChange={(e) => setSurfaces({ ...surfaces, [el.produit]: e.target.value.replace(',', '.') })} />
                  </label>
                  <button type="button" className={styles.retirer} onClick={() => retirer(el.produit)}
                    aria-label={`Retirer ${p?.nom || el.produit}`}>Retirer</button>
                </li>
              );
            })}
          </ul>
          <Bouton vers="/catalogue" variante="texte">Ajouter d'autres designs</Bouton>
        </section>

        <section className={styles.bloc} aria-labelledby="titre-projet">
          <h2 id="titre-projet">Votre projet</h2>
          <Champ libelle="Pour" options={TYPES} value={form.type_batiment}
            onChange={(e) => setForm({ ...form, type_batiment: e.target.value })} />
          <Champ libelle="Date souhaitée (facultatif)" type="date" value={form.date_souhaitee}
            onChange={(e) => setForm({ ...form, date_souhaitee: e.target.value })} />
          <Champ libelle="Description du projet" multiligne rows={4} value={form.message}
            aide={negocier ? 'Indiquez le prix que vous souhaitez : la négociation se poursuit avec l’équipe.' : 'Pièces, état du sol, couleurs souhaitées…'}
            onChange={(e) => setForm({ ...form, message: e.target.value })} />
          <label className={styles.case}>
            <input type="checkbox" checked={form.sur_mesure} onChange={(e) => setForm({ ...form, sur_mesure: e.target.checked })} />
            Je souhaite un rendu particulier (design sur mesure)
          </label>

          {!utilisateur.a_une_adresse ? (
            <fieldset className={styles.adresse}>
              <legend>Adresse du chantier</legend>
              <p className={styles.aide}>Obligatoire pour commander : elle sera enregistrée dans votre compte.</p>
              <FormulaireAdresse valeur={adresse} onChange={setAdresse} />
            </fieldset>
          ) : (
            <p className={styles.aide}>
              Adresse du chantier : {utilisateur.adresse.rue_repere}, {utilisateur.adresse.quartier}, {utilisateur.adresse.ville}
              {' '}(<Link to="/compte/profil">modifier</Link>)
            </p>
          )}

          <MessageErreur erreur={erreur} />
          <Bouton type="submit" chargement={envoi}>Envoyer ma commande</Bouton>
          <p className={styles.aide}>Aucun paiement maintenant : l'équipe vous envoie d'abord une proposition de prix.</p>
        </section>
      </form>
    </div>
  );
}
