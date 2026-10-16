// Familles du catalogue : liste (nombre de produits, traductions à compléter), création, modification,
// suppression avec confirmation (refusée par le serveur si la famille a encore des produits).
import { useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';

import { useTraduction } from '@/i18n/index.js';
import BoutonSupprimer from '@/composants/BoutonSupprimer.jsx';
import { PastilleTraductions } from '@/composants/OngletsLangues.jsx';
import gestion from '@/composants/Gestion.module.css';

import { supprimerFamille } from '../api.js';
import TiroirFamille from './TiroirFamille.jsx';

export default function ListeFamilles({ etat }) {
  const { t } = useTraduction();
  const { familles, chargement, erreur, recharger, remplacer, retirer } = etat;
  const [ouverte, setOuverte] = useState(null); // null : fermé ; 'nouvelle' ; ou la famille
  const [annonce, setAnnonce] = useState('');

  return (
    <section className={gestion.page} aria-labelledby="titre-familles">
      <div className={gestion.entete}>
        <h2 id="titre-familles" className={gestion.titreCarte}>{t('catalogue.familles.titre')}</h2>
        <Bouton onClick={() => { setOuverte('nouvelle'); setAnnonce(''); }}>{t('catalogue.familles.ajouter')}</Bouton>
      </div>
      <p className="visuellement-cache" role="status" aria-live="polite">{annonce}</p>
      {annonce && <p className={gestion.succes}>{annonce}</p>}

      {chargement ? (
        <Chargement texte={t('catalogue.familles.chargement')} />
      ) : erreur ? (
        <MessageErreur erreur={erreur} reessayer={recharger} />
      ) : familles.length === 0 ? (
        <EtatVide titre={t('catalogue.familles.vide')}>{t('catalogue.familles.videTexte')}</EtatVide>
      ) : (
        <div className={`carte ${gestion.tableau}`}>
          <table>
            <caption className="visuellement-cache">{t('catalogue.familles.legende')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('catalogue.familles.colonnes.famille')}</th>
                <th scope="col">{t('catalogue.familles.colonnes.produits')}</th>
                <th scope="col">{t('catalogue.familles.colonnes.ordre')}</th>
                <th scope="col">{t('catalogue.familles.colonnes.traductions')}</th>
                <th scope="col"><span className="visuellement-cache">{t('catalogue.familles.colonnes.actions')}</span></th>
              </tr>
            </thead>
            <tbody>
              {familles.map((f) => (
                <tr key={f.id}>
                  <td>
                    <button type="button" className={gestion.nom} onClick={() => setOuverte(f)}>{f.nom}</button>
                    {f.description && <span className={gestion.secondaire}>{f.description}</span>}
                  </td>
                  <td>{t('catalogue.familles.nombreProduits', { n: f.nombre_produits ?? 0 })}</td>
                  <td>{f.ordre ?? 0}</td>
                  <td>{f.langues_incompletes?.length ? <PastilleTraductions langues={f.langues_incompletes} />
                    : <span className={`${gestion.pastille} ${gestion.ok}`}>{t('langues.complet')}</span>}</td>
                  <td className={gestion.actions}>
                    <BoutonSupprimer nom={f.nom} surConfirmation={async () => {
                      await supprimerFamille(f.id);
                      retirer(f.id);
                      setAnnonce(t('catalogue.familles.supprimee', { nom: f.nom }));
                    }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ouverte && (
        <TiroirFamille famille={ouverte === 'nouvelle' ? null : ouverte} surFermeture={() => setOuverte(null)}
          surEnregistrement={(famille) => {
            remplacer(famille);
            setOuverte(null);
            setAnnonce(t('catalogue.familles.enregistree', { nom: famille.nom }));
          }} />
      )}
    </section>
  );
}
