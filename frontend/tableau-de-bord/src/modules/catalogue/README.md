# Module `catalogue` (tableau de bord)

**Vague 1, Vitrine** · Besoins : BF-01, BF-05, BF-06, BF-14 · API : `/api/admin/catalogue/` (contrat `docs/taches/vague-1-contrat-api.md`)

Gabarit commun : <Module>Page.jsx, composants/, api.js, use<Module>.js, <Module>.module.css

Fichiers :

- `CataloguePage.jsx` : titre, sous-navigation, sous-pages `/catalogue` (produits) et `/catalogue/familles`
- `composants/ListeProduits.jsx` : filtres (recherche, famille, en ligne / hors ligne), tableau, pagination
- `composants/TiroirProduit.jsx` : fiche du produit dans un tiroir (`versFormulaire`, `validerProduit`, `versDonnees`)
- `composants/EditeurLignes.jsx` : liste ordonnée traduite (base des deux éditeurs suivants)
- `composants/EditeurCouches.jsx` : plan de coupe (surface → support, épaisseur) avec aperçu
- `composants/EditeurCaracteristiques.jsx` : tableau des indicateurs techniques
- `composants/GestionImages.jsx`, `composants/GestionDesigns.jsx` : photos et designs (envois immédiats, multipart)
- `composants/ListeFamilles.jsx`, `composants/TiroirFamille.jsx` : familles
- `api.js`, `useCatalogue.js` (`useFamilles`, `useProduit`, `useProduitsChoix` pour les autres modules), `Catalogue.module.css`

Tâches :

- [x] Liste filtrable des produits (famille, en ligne / hors ligne, recherche différée), pagination
- [x] Tiroir produit : textes traduits par onglets, famille, référence, prix facultatif (vide = « Prix sur devis ») et unité, usages, mise en ligne, à la une, nouveauté, ordre
- [x] Caractéristiques et couches (plan de coupe) : ajout, ordre, retrait, traductions ; listes remplacées en entier
- [x] Photos (texte alternatif traduit, ordre renuméroté sur le serveur à chaque déplacement, vignette = première) et designs (nom traduit, couleur, image facultative et retirable), après création du produit
- [x] Familles : nombres de produits rechargés après création, suppression ou changement de famille d'un produit ; création, modification, suppression avec confirmation (refus du serveur affiché)
- [x] Erreurs 400 sous les champs, états de chargement, vides et d'erreur ; `langues_incompletes` affichées
- [x] Tests Vitest de base (`CataloguePage.test.jsx`)
- [ ] Suite de tests complète (agent `tableau-de-bord-testeur`)
