// MODULE À VENIR : appels entre les clients et l'équipe (voir docs/modules-a-venir.md).
import Entete from '@/components/layout/Entete.jsx';
import { BientotDisponible } from '@/components/ui/elements.jsx';

export default function AppelsPage() {
  return (
    <>
      <Entete titre="Appels" intro="Appels entrants et sortants avec les clients." />
      <div className="coque-contenu">
        <BientotDisponible titre="Téléphonie">
          <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li><strong>Téléphonie locale</strong> : appels par Orange et MTN au Cameroun.</li>
            <li><strong>Téléphonie internationale</strong> : clients des autres pays d'Afrique, où Orange et MTN sont aussi les principaux opérateurs.</li>
            <li><strong>Demandes de rappel</strong> : déjà reçues aujourd'hui dans « Demandes de contact » (objet « Être rappelé »).</li>
          </ul>
          <p className="discret">Back-end prévu : <span className="mono">backend/apps/telephony</span>.</p>
        </BientotDisponible>
      </div>
    </>
  );
}
