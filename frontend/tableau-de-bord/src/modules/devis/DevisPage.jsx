// BF-11, BF-12 : /devis, deux onglets. « Devis » (liste, état, total, commande liée) et « Demandes de rendu »
// (boîte de réception des demandes des clients). Un devis se crée depuis une commande ou une demande.

import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import usePageMeta from '@partage/utils/usePageMeta.js';

import Onglets from '@/composants/Onglets.jsx';
import gestion from '@/composants/Gestion.module.css';
import { TAILLE_PAGE } from '@/composants/useListe.js';
import { useTraduction } from '@/i18n/index.js';

import BoiteDemandesRendu from './composants/BoiteDemandesRendu.jsx';
import ListeDevis from './composants/ListeDevis.jsx';
import { ETATS_RENDU } from './composants/TiroirDemandeRendu.jsx';
import useDevis from './useDevis.js';
import styles from './Devis.module.css';

const ETATS_DEVIS = ['brouillon', 'envoye', 'accepte', 'refuse', 'remplace'];

export default function DevisPage() {
  const { t } = useTraduction();
  usePageMeta(t('devis.titre'));
  const {
    onglet, liste, resume, rechargerResume, page, etat, saisie, changerSaisie, choisirOnglet, choisirEtat,
    allerALaPage, effacer, filtre,
  } = useDevis();
  const pages = Math.max(1, Math.ceil(liste.total / TAILLE_PAGE));
  const etats = onglet === 'devis' ? ETATS_DEVIS : ETATS_RENDU;
  const options = [
    ['', t('devis.tousEtats')],
    ...etats.map((c) => [c, onglet === 'devis'
      ? t(`devis.etats.${c}`)
      : `${t(`devis.demandes.etats.${c}`)}${typeof resume[c] === 'number' ? ` (${resume[c]})` : ''}`]),
  ];

  return (
    <div className={styles.page}>
      <div>
        <h1 className="titre-page">{t('devis.titre')}</h1>
        <p className="sous-titre-page">{t('devis.sousTitre')}</p>
      </div>

      <Onglets libelle={t('devis.onglets')} idBase="devis" actif={onglet} surChoix={choisirOnglet}
        onglets={[
          { cle: 'devis', libelle: t('devis.ongletDevis') },
          { cle: 'demandes', libelle: t('devis.ongletDemandes'), nombre: resume.nouvelle, urgent: true },
        ]}>
        <form className={`carte ${styles.filtres}`} role="search" aria-label={t('devis.recherche')}
          onSubmit={(e) => e.preventDefault()}>
          <Champ libelle={t('devis.rechercher')} name="q" type="search" value={saisie} autoComplete="off"
            onChange={(e) => changerSaisie(e.target.value)} />
          <Champ libelle={t('devis.etat')} name="etat" value={etat} options={options}
            onChange={(e) => choisirEtat(e.target.value)} />
          {(filtre || saisie) && <Bouton variante="texte" onClick={effacer}>{t('devis.effacer')}</Bouton>}
        </form>

        {onglet === 'devis'
          ? <ListeDevis liste={liste} filtre={filtre} effacer={effacer} />
          : <BoiteDemandesRendu liste={liste} filtre={filtre} effacer={effacer} apresModification={rechargerResume} />}

        {(liste.precedente || liste.suivante) && (
          <nav className={gestion.pagination} aria-label={t('devis.pagination')}>
            <Bouton variante="contour" taille="petit" disabled={!liste.precedente} onClick={() => allerALaPage(page - 1)}>
              {t('pagination.precedente')}
            </Bouton>
            <span>{t('pagination.pageSur', { page, pages })}</span>
            <Bouton variante="contour" taille="petit" disabled={!liste.suivante} onClick={() => allerALaPage(page + 1)}>
              {t('pagination.suivante')}
            </Bouton>
          </nav>
        )}
      </Onglets>
    </div>
  );
}
