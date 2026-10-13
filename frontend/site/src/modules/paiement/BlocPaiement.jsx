// MODULE À VENIR : paiement par compte bancaire.
// Emplacement réservé dans le détail d'une commande, une fois le contrat signé.
import BientotDisponible from '@/components/ui/BientotDisponible.jsx';
import { montant } from '@shared/format.js';

export default function BlocPaiement({ commande }) {
  if (!['contrat_signe', 'travaux', 'terminee'].includes(commande.statut)) return null;
  return (
    <BientotDisponible titre="Paiement par compte bancaire">
      Montant convenu : {montant(commande.montant_convenu)}. Le paiement en ligne arrive bientôt ;
      en attendant, l'équipe vous indique les modalités de règlement dans la messagerie.
    </BientotDisponible>
  );
}
