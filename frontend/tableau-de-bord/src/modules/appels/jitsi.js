// Chargement de l'API Jitsi (JaaS) : le script n'est téléchargé qu'au moment de répondre à un appel.
const DOMAINE = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i;
const APP_ID = /^[A-Za-z0-9_-]+$/;

const promesses = new Map();

/** Adresse du script `https://<domaine>/<app_id>/external_api.js`, ou null si les paramètres sont suspects. */
export function adresseScript(domaine, appId) {
  if (!DOMAINE.test(String(domaine || '')) || !APP_ID.test(String(appId || ''))) return null;
  return `https://${domaine}/${appId}/external_api.js`;
}

/** → classe `JitsiMeetExternalAPI` (rejette si le script ne se charge pas). */
export function chargerJitsi(domaine, appId) {
  if (typeof window !== 'undefined' && typeof window.JitsiMeetExternalAPI === 'function') {
    return Promise.resolve(window.JitsiMeetExternalAPI);
  }
  const adresse = adresseScript(domaine, appId);
  if (!adresse) return Promise.reject(new Error('jitsi_parametres'));
  if (!promesses.has(adresse)) {
    promesses.set(adresse, new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = adresse;
      script.async = true;
      script.onload = () => (typeof window.JitsiMeetExternalAPI === 'function'
        ? resolve(window.JitsiMeetExternalAPI) : reject(new Error('jitsi_absent')));
      script.onerror = () => { promesses.delete(adresse); script.remove(); reject(new Error('jitsi_script')); };
      document.head.appendChild(script);
    }));
  }
  return promesses.get(adresse);
}
