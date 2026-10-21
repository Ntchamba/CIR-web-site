// Contexte de page envoyé à l'assistant : fiche produit ou détail de commande (référence), sinon la page.
// Petit module sans React ni réseau : les pages le renseignent sans charger le code de l'assistant.
// La référence n'est qu'un indice : le serveur la revérifie toujours.
import { useEffect } from 'react';

let courant = null;

export function definirContexte(contexte) {
  courant = contexte;
}

/** → {type, reference?} */
export function lireContexte() {
  return courant ? { ...courant } : { type: 'page' };
}

/** Une page signale son contexte tant qu'elle est affichée (`type` : 'produit' | 'commande'). */
export function useContexteAssistant(type, reference) {
  useEffect(() => {
    if (!type || !reference) return undefined;
    const contexte = { type, reference: String(reference) };
    definirContexte(contexte);
    return () => {
      if (courant === contexte) definirContexte(null);
    };
  }, [type, reference]);
}
