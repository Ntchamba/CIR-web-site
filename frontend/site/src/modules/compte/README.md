# Module `compte` (site public)

**Vague 0, Socle** · Besoins : BF-08, BF-17, BNF-01, BNF-06

Gabarit commun : <Module>Page.jsx, composants/, api.js, use<Module>.js, <Module>.module.css

- [x] `AuthContext.jsx` : `AuthProvider`, `useAuth()` → `{ utilisateur, pret, connecte, seConnecter(email, motDePasse), sInscrire(donnees), seDeconnecter(), mettreAJour(donnees) }`
- [x] `ConnexionPage.jsx` (`/connexion?suite=…`)
- [x] `InscriptionPage.jsx` (`/inscription`) : nom complet, e-mail, téléphone (facultatif), mot de passe, **adresse obligatoire**
- [x] `ProfilPage.jsx` (`/compte`) : coordonnées et adresse modifiables, e-mail en lecture seule, déconnexion
- [x] `FormulaireAdresse.jsx` : ville, quartier, rue ou repère (obligatoires)
- [x] `RouteProtegee.jsx` : renvoie vers `/connexion?suite=<page>` si le client n'est pas connecté
- [x] `api.js` (appels), `adresse.js` (règles d'adresse, `adresseComplete`, `prenomDe`, `initialesDe`),
  `validation.js` (contrôles avant envoi), `suite.js` (`cheminDeSuite` : redirections internes seulement),
  `Compte.module.css`
- [x] Tests Vitest + Testing Library (agent `site-testeur`)

Le serveur revérifie tout (adresse, mot de passe, unicité de l'e-mail) ; ses erreurs par champ s'affichent
sous le champ concerné.
