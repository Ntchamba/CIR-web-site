// MODULE À VENIR : paiements par compte bancaire (voir docs/modules-a-venir.md).
import Entete from '@/components/layout/Entete.jsx';
import { BientotDisponible } from '@/components/ui/elements.jsx';

export default function PaiementsPage() {
  return (
    <>
      <Entete titre="Paiements" intro="Suivi des paiements des commandes." />
      <div className="coque-contenu">
        <BientotDisponible titre="Paiement par compte bancaire">
          <p>Cet espace affichera les paiements reçus pour chaque commande au contrat signé : montant, date,
            référence de la banque, statut. L'équipe pourra aussi y enregistrer à la main un virement reçu.</p>
          <p className="discret">Back-end prévu : <span className="mono">backend/apps/payments</span>. Aucune donnée bancaire ne sera stockée par le CIR.</p>
        </BientotDisponible>
      </div>
    </>
  );
}
