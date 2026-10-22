// Panneau « Commander ou personnaliser » (maquettes) : tiroir à droite (ordinateur) ou feuille du bas (téléphone) avec
// la couleur, la surface, le type de bâtiment, « Lancer la commande » et les actions : négocier, message, WhatsApp, appel,
// rendu particulier, devis, visite, fiche technique, réalisations. Fermer : bouton, voile, Échap ; le focus revient au
// bouton qui l'a ouvert. Modal : le focus reste dans le panneau tant qu'il est ouvert.
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import Icone from '@partage/ui/Icone.jsx';
import { prix } from '@partage/utils/format.js';

import { useEcranTelephone } from '@/app/preferences.js';
import { useTraduction } from '@/i18n/index.js';
import { useCoordonnees } from '@/layout/contenus.js';
import { lienWhatsApp } from '@/layout/coordonnees.js';
import { TYPES_BATIMENT } from '@/modules/commandes/regles.js';
import { useAuth } from '@/modules/compte/AuthContext.jsx';
import BoutonSelection from '@/modules/selection/composants/BoutonSelection.jsx';

const FOCALISABLES = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** `designId` / `onDesign` : couleur choisie, partagée avec le bouton « Sélectionner ce produit » de la fiche. */
export default function PanneauOptions({ produit, ouvert, onFermer, designId = '', onDesign = () => {} }) {
  const { t } = useTraduction();
  const telephone = useEcranTelephone();
  const naviguer = useNavigate();
  const { utilisateur } = useAuth();
  const { telephone: tel, whatsapp } = useCoordonnees();
  const idTitre = useId();
  const racine = useRef(null);
  const designs = produit.designs || [];
  const [surface, setSurface] = useState('');
  const [type, setType] = useState('maison');
  const design = designs.find((d) => String(d.id) === designId) || null;
  const nomProduit = [produit.reference, produit.nom].filter(Boolean).join(' ');
  const message = design
    ? t('produit.options.messageDesign', { produit: nomProduit, design: design.nom })
    : t('produit.options.message', { produit: nomProduit });
  const requete = (extra = {}) => {
    const p = new URLSearchParams({ produit: produit.slug, ...(design ? { design: String(design.id) } : {}), ...extra });
    return p.toString();
  };

  // Focus : à l'ouverture dans le panneau ; Tab reste dans le panneau ; Échap ferme.
  useEffect(() => {
    if (!ouvert) return undefined;
    const precedent = document.activeElement;
    racine.current?.querySelector('button')?.focus();
    const surTouche = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onFermer(); return; }
      if (e.key !== 'Tab' || !racine.current) return;
      const liste = [...racine.current.querySelectorAll(FOCALISABLES)].filter((x) => !x.closest('[hidden]'));
      if (!liste.length) return;
      const premier = liste[0];
      const dernier = liste[liste.length - 1];
      if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus(); }
      else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
    };
    document.addEventListener('keydown', surTouche);
    return () => {
      document.removeEventListener('keydown', surTouche);
      precedent?.focus?.();
    };
  }, [ouvert, onFermer]);

  if (!ouvert) return null;

  function lancer(e) {
    e.preventDefault();
    const extra = { type };
    if (surface) extra.surface = surface;
    naviguer(`/commandes/nouvelle?${requete(extra)}`);
  }

  const actions = [
    ['negocier', <Link key="n" to={`/commandes/nouvelle?${requete({ type })}`}>{t('produit.panneau.negocier')}</Link>],
    ['message', <Link key="m" to="/messages">{t('produit.panneau.message')}</Link>],
    ['whatsapp', <a key="w" href={lienWhatsApp(whatsapp.affichage, message)} target="_blank" rel="noopener noreferrer">{t('produit.panneau.whatsapp')}</a>],
    ['appeler', <a key="a" href={tel.lien}>{t('produit.panneau.appeler')}</a>],
    ['rendu', <Link key="r" to={`/devis/demande?${requete()}`}>{t('produit.panneau.rendu')}</Link>],
    ['devis', <Link key="d" to="/contact">{t('produit.panneau.devis')}</Link>],
    ['visite', <Link key="v" to="/contact">{t('produit.panneau.visite')}</Link>],
    ['fiche', <a key="f" href="#fiche-technique" onClick={onFermer}>{t('produit.panneau.fiche')}</a>],
    ['realisations', <Link key="re" to="/realisations">{t('produit.panneau.realisations')}</Link>],
    ...(telephone ? [['demo', <Link key="de" to="/realisations#demos">{t('produit.panneau.demo')}</Link>]] : []),
  ];

  return (
    <>
      <div className="m-voile-panneau" onClick={onFermer} aria-hidden="true" />
      <aside ref={racine} className="m-panneau" role="dialog" aria-modal="true" aria-labelledby={idTitre}>
        <button type="button" className="fermer" onClick={onFermer} aria-label={t('produit.panneau.fermer')}>
          <Icone nom="fermer" taille={20} epaisseur={2} />
        </button>
        <span className="m-surtitre">{[produit.reference, produit.famille?.nom].filter(Boolean).join(' · ')}</span>
        <h2 id={idTitre}>{produit.nom}</h2>
        <div className="prix-p">{prix(produit.prix, produit.unite_prix)}</div>
        <div className="note">{t('produit.panneau.note')}</div>

        <form onSubmit={lancer}>
          {designs.length > 0 && (
            <label className="m-etiquette">
              {t('produit.panneau.couleur')}
              <select name="design" value={designId} onChange={(e) => onDesign(e.target.value)}>
                <option value="">{t('produit.panneau.choisir')}</option>
                {designs.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}
              </select>
            </label>
          )}
          <label className="m-etiquette">
            {t('produit.panneau.surface')}
            <input type="number" name="surface" min="1" inputMode="decimal" placeholder={t('produit.panneau.exempleSurface')}
              value={surface} onChange={(e) => setSurface(e.target.value)} />
          </label>
          <div className="m-puces" role="group" aria-label={t('produit.panneau.typeBatiment')}>
            {TYPES_BATIMENT.map((b) => (
              <button key={b} type="button" aria-pressed={type === b} onClick={() => setType(b)}>{t(`usages.${b}`)}</button>
            ))}
          </div>
          {!utilisateur?.est_equipe && <button type="submit" className="m-btn plein">{t('produit.panneau.lancer')}</button>}
        </form>

        {telephone && (
          <div style={{ marginBottom: 16 }}>
            <BoutonSelection produit={produit.id} design={design?.id ?? null} nom={produit.nom} apparence="panneau" lienSiAjoute={false} />
          </div>
        )}

        <ul className="m-liste-liens">
          {actions.map(([cle, element]) => <li key={cle}>{element}</li>)}
        </ul>
      </aside>
    </>
  );
}
