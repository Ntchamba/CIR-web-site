// BF-17 : accès des administrateurs au tableau de bord (réservé aux super-administrateurs).
import { useState } from 'react';

import Entete from '@/components/layout/Entete.jsx';
import Chargement from '@/components/ui/Chargement.jsx';
import { Champ, Erreur, Interrupteur } from '@/components/ui/elements.jsx';
import useApi from '@/hooks/useApi.js';
import { api, resultats } from '@/lib/api.js';
import { useAuth } from '@/modules/auth/AuthContext.jsx';
import { date } from '@shared/format.js';

const VIDE = { nom_complet: '', email: '', telephone: '', password: '', is_superuser: false };

export default function EquipePage() {
  const { utilisateur } = useAuth();
  const liste = useApi((s) => api.get('/admin/comptes/equipe/?taille=100', { signal: s }).then(resultats), []);
  const [form, setForm] = useState(VIDE);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const champ = (nom) => ({ value: form[nom], onChange: (e) => setForm({ ...form, [nom]: e.target.value }) });

  async function ajouter(e) {
    e.preventDefault();
    setEnvoi(true); setErreur(null);
    try { await api.post('/admin/comptes/equipe/', form); setForm(VIDE); liste.recharger(); }
    catch (err) { setErreur(err); }
    finally { setEnvoi(false); }
  }
  const modifier = async (membre, changements) => {
    setErreur(null);
    try { await api.patch(`/admin/comptes/equipe/${membre.id}/`, changements); liste.recharger(); } catch (err) { setErreur(err); }
  };

  if (!utilisateur?.is_superuser) {
    return (
      <>
        <Entete titre="Équipe" />
        <div className="coque-contenu"><p className="carte">Seul un super-administrateur peut gérer les accès de l'équipe.</p></div>
      </>
    );
  }

  return (
    <>
      <Entete titre="Équipe" intro="Les membres du CIR qui ont accès au tableau de bord." />
      <div className="coque-contenu">
        <Erreur erreur={liste.erreur || erreur} />
        <section className="carte" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h2>Membres</h2>
          {!liste.donnees ? <Chargement /> : liste.donnees.map((m) => {
            const moi = m.id === utilisateur.id;
            return (
              <div key={m.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--filet-2)' }}>
                <span style={{ flex: '1 1 220px' }}>
                  <strong>{m.nom_complet}</strong>{moi && <span className="discret"> (vous)</span>}<br />
                  <span className="discret">{m.email} · {m.last_login ? `dernière connexion le ${date(m.last_login)}` : 'jamais connecté'}</span>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="discret">Super-administrateur</span>
                  <Interrupteur actif={m.is_superuser} libelle={`Super-administrateur : ${m.nom_complet}`}
                    onChange={(v) => !moi && modifier(m, { is_superuser: v })} />
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="discret">Accès actif</span>
                  <Interrupteur actif={m.is_active} libelle={`Accès actif : ${m.nom_complet}`}
                    onChange={(v) => !moi && modifier(m, { is_active: v })} />
                </span>
              </div>
            );
          })}
        </section>

        <section className="carte">
          <h2>Ajouter un membre</h2>
          <form onSubmit={ajouter} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12, maxWidth: 560 }}>
            <Champ libelle="Nom complet" {...champ('nom_complet')} required />
            <div className="champs-ligne">
              <Champ libelle="Adresse e-mail" type="email" {...champ('email')} required />
              <Champ libelle="Téléphone" type="tel" {...champ('telephone')} />
            </div>
            <Champ libelle="Mot de passe provisoire" type="password" autoComplete="new-password" {...champ('password')} required />
            <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" checked={form.is_superuser} onChange={(e) => setForm({ ...form, is_superuser: e.target.checked })} />
              Super-administrateur (peut aussi gérer l'équipe)
            </label>
            <button type="submit" className="bouton" style={{ alignSelf: 'flex-start' }}
              disabled={envoi || !form.nom_complet || !form.email || !form.password}>{envoi ? 'Ajout…' : 'Donner l’accès'}</button>
          </form>
        </section>
      </div>
    </>
  );
}
