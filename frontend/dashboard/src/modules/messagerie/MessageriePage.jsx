// Messagerie instantanée de l'équipe : toutes les conversations, les non lues en premier.
import { Link, useParams } from 'react-router-dom';

import Entete from '@/components/layout/Entete.jsx';
import Chargement from '@/components/ui/Chargement.jsx';
import { Erreur } from '@/components/ui/elements.jsx';
import useApi from '@/hooks/useApi.js';
import { api, resultats } from '@/lib/api.js';
import { depuis } from '@shared/format.js';

import FilMessages from './FilMessages.jsx';

export default function MessageriePage() {
  const { id } = useParams();
  const liste = useApi((s) => api.get('/admin/messagerie/conversations/?taille=100', { signal: s }).then(resultats), [id]);
  const conversations = liste.donnees || [];
  const active = id ? Number(id) : conversations[0]?.id;
  const choisie = conversations.find((c) => c.id === active);

  return (
    <>
      <Entete titre="Messagerie" intro="Répondez aux clients en direct ; les conversations non lues sont en tête." />
      <div className="coque-contenu">
        <Erreur erreur={liste.erreur} reessayer={liste.recharger} />
        {liste.chargement && !liste.donnees ? <Chargement /> : (
          <div className="rangee">
            <nav aria-label="Conversations" style={{ flex: '1 1 300px', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {conversations.length === 0 && <p className="vide">Aucune conversation.</p>}
              {conversations.map((c) => (
                <Link key={c.id} to={`/messagerie/${c.id}`} className="carte"
                  style={{ padding: 14, textDecoration: 'none', color: 'inherit', borderColor: c.id === active ? 'var(--bleu)' : undefined, borderWidth: c.id === active ? 2 : 1 }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong>{c.client_nom}</strong>
                    {c.non_lus > 0 && <span className="pastille">{c.non_lus}</span>}
                  </span>
                  <span className="discret" style={{ display: 'block' }}>{c.commande_numero ? `Commande ${c.commande_numero}` : c.sujet}</span>
                  <span className="discret" style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.dernier_message?.texte || '—'}
                  </span>
                  <span className="discret" style={{ fontSize: 12 }}>{depuis(c.modifie_le)}</span>
                </Link>
              ))}
            </nav>
            <div style={{ flex: '999 1 480px', minWidth: 0 }}>
              {active ? (
                <>
                  {choisie?.commande_numero && (
                    <p style={{ marginBottom: 10 }}><Link to={`/commandes/${choisie.commande_numero}`}>Ouvrir la commande {choisie.commande_numero}</Link></p>
                  )}
                  <FilMessages key={active} conversationId={active} titre={choisie ? `${choisie.client_nom} · ${choisie.sujet}` : undefined} />
                </>
              ) : <p className="vide">Choisissez une conversation.</p>}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
