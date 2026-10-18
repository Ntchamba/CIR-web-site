// BF-10 : nouvelle commande (/commandes/nouvelle). Une commande exige un compte ET une adresse complète : sinon le
// formulaire n'est pas affiché (message et lien vers /compte). Le serveur revérifie (403 `adresse_incomplete`).
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { erreursChamps } from '@partage/api/client.js';
import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import usePageMeta from '@partage/utils/usePageMeta.js';

import { useTraduction } from '@/i18n/index.js';
import { adresseComplete } from '@/modules/compte/adresse.js';
import { useAuth } from '@/modules/compte/AuthContext.jsx';
import { useSelection } from '@/modules/selection/SelectionContext.jsx';

import * as commandes from './api.js';
import { adresseIncomplete, DESCRIPTION_MAX, nombreOuVide, TYPES_BATIMENT, validerCommande } from './regles.js';
import { useLignesNouvelleCommande } from './useCommandes.js';
import styles from './Commandes.module.css';

function AdresseManquante() {
  const { t } = useTraduction();
  return (
    <EtatVide titre={t('commandes.nouvelle.adresseIncomplete.titre')} niveau={1}
      action={<Bouton as={Link} to="/compte">{t('commandes.nouvelle.adresseIncomplete.action')}</Bouton>}>
      {t('commandes.nouvelle.adresseIncomplete.texte')}
    </EtatVide>
  );
}

export default function NouvelleCommandePage() {
  const { t } = useTraduction();
  usePageMeta(t('commandes.nouvelle.titre'));
  const { utilisateur } = useAuth();
  const selection = useSelection();
  const naviguer = useNavigate();
  const [parametres] = useSearchParams();
  const source = useLignesNouvelleCommande(parametres.get('produit') || '', parametres.get('design') || '');
  const [form, setForm] = useState({ type_batiment: '', surface_m2: '', description: '' });
  const [erreurs, setErreurs] = useState({});
  const [etat, setEtat] = useState({ envoi: false, erreur: null, adresse: false });

  if (!adresseComplete(utilisateur) || etat.adresse) {
    return <div className="conteneur section"><AdresseManquante /></div>;
  }

  const changer = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const horsLigne = source.lignes.some((l) => !l.disponible);
  const sansProduit = !source.chargement && !source.erreur && source.lignes.length === 0;

  async function envoyer(e) {
    e.preventDefault();
    const locales = validerCommande(form);
    setErreurs(locales);
    if (Object.keys(locales).length) {
      setEtat({ envoi: false, erreur: t('commandes.nouvelle.erreurs.incomplet'), adresse: false });
      return;
    }
    const corps = { type_batiment: form.type_batiment };
    const surface = nombreOuVide(form.surface_m2);
    if (surface !== null) corps.surface_m2 = surface;
    if (form.description.trim()) corps.description = form.description.trim();
    if (source.depuisSelection) corps.depuis_selection = true;
    else corps.lignes = source.lignes.map((l) => (l.design ? { produit: l.produit, design: l.design } : { produit: l.produit }));

    setEtat({ envoi: true, erreur: null, adresse: false });
    try {
      const commande = await commandes.creer(corps);
      if (source.depuisSelection) selection.rafraichir();
      naviguer(`/commandes/${commande.id}`);
    } catch (erreur) {
      if (adresseIncomplete(erreur)) {
        setEtat({ envoi: false, erreur: null, adresse: true });
        return;
      }
      setErreurs(erreursChamps(erreur));
      setEtat({ envoi: false, erreur: erreur?.statut === 429 ? t('commandes.nouvelle.erreurs.quota') : erreur, adresse: false });
    }
  }

  return (
    <div className="conteneur section">
      <h1 className="titre-page">{t('commandes.nouvelle.titre')}</h1>
      <p className={styles.intro}>{t('commandes.nouvelle.intro')}</p>

      {source.chargement && !source.donnees && <Chargement />}
      {source.erreur && (
        source.erreur.statut === 404 && !source.depuisSelection
          ? <MessageErreur erreur={t('commandes.nouvelle.produitIntrouvable')} />
          : <MessageErreur erreur={source.erreur} reessayer={source.recharger} />
      )}

      {sansProduit && (
        <EtatVide titre={t('commandes.nouvelle.sansProduit.titre')}
          action={<Bouton as={Link} to="/catalogue">{t('commandes.nouvelle.sansProduit.catalogue')}</Bouton>}>
          {t('commandes.nouvelle.sansProduit.texte')}
        </EtatVide>
      )}

      {source.lignes.length > 0 && (
        <form onSubmit={envoyer} noValidate className={styles.formCommande}>
          <section aria-labelledby="titre-produits-commande" className={styles.bloc}>
            <h2 id="titre-produits-commande">{t('commandes.detail.produits')}</h2>
            <ul className={styles.liste}>
              {source.lignes.map((l) => (
                <li key={l.cle} className={styles.ligneSimple}>
                  <strong>{l.nom}</strong>
                  {l.reference && <span className={styles.meta}>{l.reference}</span>}
                  {l.designNom && <span className={styles.meta}>{t('commandes.detail.design', { nom: l.designNom })}</span>}
                  {!l.disponible && <span className={styles.alerte}>{t('selection.horsLigne')}</span>}
                </li>
              ))}
            </ul>
            {source.depuisSelection && (
              <Link to="/selection" className={styles.lienDiscret}>{t('commandes.nouvelle.modifierSelection')}</Link>
            )}
            {horsLigne && <p className={styles.alerte} role="alert">{t('selection.retirerHorsLigne')}</p>}
          </section>

          <section aria-labelledby="titre-chantier-commande" className={styles.bloc}>
            <h2 id="titre-chantier-commande">{t('commandes.nouvelle.chantier')}</h2>
            <Champ libelle={t('commandes.nouvelle.type')} name="type_batiment" required value={form.type_batiment}
              onChange={changer} erreur={erreurs.type_batiment}
              options={[['', t('commandes.nouvelle.typeChoisir')], ...TYPES_BATIMENT.map((b) => [b, t(`commandes.types.${b}`)])]} />
            <Champ libelle={t('commandes.nouvelle.surface')} name="surface_m2" type="number" inputMode="decimal" min="0" step="0.01"
              value={form.surface_m2} onChange={changer} erreur={erreurs.surface_m2} aide={t('commandes.nouvelle.surfaceAide')} />
            <Champ libelle={t('commandes.nouvelle.description')} name="description" multiligne maxLength={DESCRIPTION_MAX}
              value={form.description} onChange={changer} erreur={erreurs.description}
              aide={t('commandes.nouvelle.descriptionAide', { n: form.description.length, max: DESCRIPTION_MAX })} />
            {erreurs.lignes && <p className={styles.alerte}>{erreurs.lignes}</p>}
            <div className={styles.adresseChantier}>
              <strong>{t('commandes.nouvelle.adresse')}</strong>
              <span>{utilisateur.adresse_formatee}</span>
              <Link to="/compte" className={styles.lienDiscret}>{t('commandes.nouvelle.adresseModifier')}</Link>
            </div>
          </section>

          <div aria-live="polite">
            <MessageErreur erreur={etat.erreur} />
          </div>
          <div className={styles.rangee}>
            <Bouton type="submit" chargement={etat.envoi} disabled={horsLigne}>{t('commandes.nouvelle.envoyer')}</Bouton>
            <Bouton as={Link} to="/commandes" variante="contour">{t('commandes.nouvelle.annuler')}</Bouton>
          </div>
        </form>
      )}
    </div>
  );
}
