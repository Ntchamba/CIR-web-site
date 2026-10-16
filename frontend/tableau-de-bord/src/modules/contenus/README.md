# Module `contenus` (tableau de bord)

**Vague 1, Vitrine** · Besoins : BF-15, O2 · API : `/api/admin/contenus/`

Gabarit commun : <Module>Page.jsx, composants/, api.js, use<Module>.js, <Module>.module.css

Fichiers :

- `ContenusPage.jsx` : sous-routes `/contenus` (accueil), `/contenus/bandeaux`, `/contenus/sphere`
- `SectionAccueil.jsx` (+ `composants/EditeurTelephones.jsx`) : titre, accroche, texte partenaire traduits ; vidéo de fond (30 Mo) et image ; téléphones, WhatsApp, e-mail, adresse. Textes en PATCH JSON, puis fichiers en PATCH multipart s'il y en a
- `SectionBandeaux.jsx`, `composants/TiroirBandeau.jsx` : texte traduit, lien interne (`^/(?!/)[^\s\\]*$`, comme le serveur), actif, début / fin en `YYYY-MM-DD` (jour de fin inclus, fin = début permis ; dates affichées sans conversion UTC), ordre
- `SectionSphere.jsx`, `composants/TiroirPhotoSphere.jsx` : photos, texte alternatif traduit, produit lié, ordre (`POST sphere/ordre/`)
- `api.js`, `useContenus.js` (`useBandeaux`, `useSphere`, `etatBandeau`), `Contenus.module.css`

Tâches :

- [x] Accueil : formulaire complet, champs vides laissés au texte par défaut du site
- [x] Bandeaux : liste (état affiché / programmé / terminé / désactivé), création, modification, suppression
- [x] Sphère : ajout, modification, ordre, suppression
- [x] Erreurs 400 sous les champs, états de chargement et vides, `langues_incompletes`
- [x] Tests Vitest de base (`ContenusPage.test.jsx`)
- [ ] Suite de tests complète (agent `tableau-de-bord-testeur`)
