// BF-12 : propositions de l'équipe, acceptation ou refus, contre-proposition du client.
import { useState } from 'react';

import Bouton from '@/components/ui/Bouton.jsx';
import Champ from '@/components/ui/Champ.jsx';
import MessageErreur from '@/components/ui/MessageErreur.jsx';
import { date, montant, prix } from '@shared/format.js';

import * as commandes from './api.js';
import styles from './Commandes.module.css';

export default function Negociation({ commande, surMiseAJour }) {
  const [form, setForm] = useState({ prix_m2: '', message: '' });
  const [ouvert, setOuvert] = useState(false);
  const [envoi, setEnvoi] = useState(null);
  const [erreur, setErreur] = useState(null);
  const enAttente = commande.propositions.find((p) => p.etat === 'en_attente' && p.de_l_equipe);
  const close = ['contrat_signe', 'travaux', 'terminee', 'annulee'].includes(commande.statut);

  async function agir(nom, action) {
    setEnvoi(nom);
    setErreur(null);
    try { surMiseAJour(await action()); setOuvert(false); setForm({ prix_m2: '', message: '' }); }
    catch (e) { setErreur(e); }
    finally { setEnvoi(null); }
  }

  return (
    <section className={styles.negociation} aria-labelledby="titre-nego">
      <h3 id="titre-nego">Négociation</h3>
      {commande.propositions.length === 0 && (
        <p className={styles.aide}>L'équipe étudie votre demande et vous envoie une proposition de prix et de délai.</p>
      )}
      <ol className={styles.propositions}>
        {commande.propositions.map((p) => (
          <li key={p.id} className={p.de_l_equipe ? styles.propEquipe : styles.propClient}>
            <span className={styles.propAuteur}>{p.de_l_equipe ? 'Équipe CIR' : 'Vous'} · {date(p.cree_le)} · {p.etat_libelle}</span>
            {(p.prix_m2 || p.montant_total) && (
              <span className={styles.propPrix}>
                {p.prix_m2 && prix(p.prix_m2, 'm2')}{p.prix_m2 && p.montant_total && ' · '}
                {p.montant_total && `Total ${montant(p.montant_total)}`}
                {p.delai_jours && ` · intervention sous ${p.delai_jours} jours`}
              </span>
            )}
            {p.message && <span>{p.message}</span>}
          </li>
        ))}
      </ol>

      {commande.montant_convenu && <p className={styles.convenu}>Montant convenu : {montant(commande.montant_convenu)}</p>}
      <MessageErreur erreur={erreur} />

      {!close && (
        <div className={styles.negoActions}>
          {enAttente && (
            <>
              <Bouton chargement={envoi === 'accepter'}
                onClick={() => agir('accepter', () => commandes.repondre(commande.numero, enAttente.id, true))}>
                Accepter la proposition
              </Bouton>
              <Bouton variante="contour" chargement={envoi === 'refuser'}
                onClick={() => agir('refuser', () => commandes.repondre(commande.numero, enAttente.id, false))}>
                Refuser
              </Bouton>
            </>
          )}
          <Bouton variante="texte" onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert}>
            {ouvert ? 'Annuler' : 'Proposer un autre prix'}
          </Bouton>
        </div>
      )}

      {ouvert && (
        <form className={styles.contre}
          onSubmit={(e) => { e.preventDefault(); agir('proposer', () => commandes.contreProposition(commande.numero, {
            prix_m2: form.prix_m2 || null, message: form.message })); }}>
          <Champ libelle="Prix souhaité (FCFA / m²)" inputMode="numeric" value={form.prix_m2}
            onChange={(e) => setForm({ ...form, prix_m2: e.target.value.replace(/\D/g, '') })} />
          <Champ libelle="Message" multiligne rows={3} value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })} />
          <Bouton type="submit" chargement={envoi === 'proposer'}>Envoyer ma proposition</Bouton>
        </form>
      )}
    </section>
  );
}
