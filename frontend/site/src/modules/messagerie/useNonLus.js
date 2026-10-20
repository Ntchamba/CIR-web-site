// Nombre de messages non lus (pastille de l'en-tête et de l'onglet Messages), tenu à jour par le fond en direct.
import { useDirect } from '@/modules/notifications/FondDirect.jsx';

export default function useNonLus() {
  return useDirect().nonLusMessages;
}
