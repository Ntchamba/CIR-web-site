// Jitsi JaaS : le script externe n'est chargé qu'au lancement d'un appel (jamais au chargement du site).
const DOMAINE = /^([a-z0-9-]+\.)*8x8\.vc$/i; // JaaS uniquement : le script n'est jamais chargé depuis un autre domaine
const APP_ID = /^[A-Za-z0-9_-]{1,128}(\/[A-Za-z0-9_-]{1,128})*$/;

let enCours = null;

/** Charge `https://<domaine>/<app_id>/external_api.js` et renvoie la classe JitsiMeetExternalAPI. */
export function chargerJitsi({ domaine, app_id: appId }) {
  if (!DOMAINE.test(String(domaine)) || !APP_ID.test(String(appId))) return Promise.reject(new Error('jitsi_invalide'));
  if (window.JitsiMeetExternalAPI) return Promise.resolve(window.JitsiMeetExternalAPI);
  if (enCours) return enCours;
  enCours = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://${domaine}/${appId}/external_api.js`;
    script.async = true;
    script.onload = () => {
      if (window.JitsiMeetExternalAPI) resolve(window.JitsiMeetExternalAPI);
      else reject(new Error('jitsi_indisponible'));
    };
    script.onerror = () => {
      script.remove();
      reject(new Error('jitsi_indisponible'));
    };
    document.head.appendChild(script);
  }).finally(() => {
    enCours = null;
  });
  return enCours;
}
